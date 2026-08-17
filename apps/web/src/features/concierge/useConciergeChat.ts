import { useConciergeStore } from './concierge.store';
import { streamMessages } from './streamMessages';
import type { ConciergeMessage, VenueCardData, SseEvent } from './types';

// ─── Type for store state (for testability) ───────────────────────────────────

type ConciergeStoreState = ReturnType<typeof useConciergeStore.getState>;

// ─── Venue result detection ────────────────────────────────────────────────────

/**
 * Detects whether a tool result contains venue data.
 * Handles two shapes:
 *  - { venues: VenueCardData[] }  (search_venues wraps in "venues" key)
 *  - VenueCardData[]              (direct array)
 */
function extractVenues(result: unknown): VenueCardData[] | null {
  if (!result || typeof result !== 'object') return null;

  // Shape 1: { venues: [...] }
  if ('venues' in result && Array.isArray((result as { venues: unknown }).venues)) {
    const arr = (result as { venues: unknown[] }).venues;
    if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null && 'distanceKm' in arr[0]) {
      return arr as VenueCardData[];
    }
  }

  // Shape 2: direct array
  if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object' && result[0] !== null && 'distanceKm' in result[0]) {
    return result as VenueCardData[];
  }

  return null;
}

// ─── SSE event handler ────────────────────────────────────────────────────────

function handleSseEvent(
  store: ConciergeStoreState,
  assistantMsgId: string,
  event: SseEvent,
): void {
  switch (event.type) {
    case 'content_delta':
      store.appendContentDelta(assistantMsgId, event.text);
      break;

    case 'tool_result': {
      const venues = extractVenues(event.result);
      if (venues && venues.length > 0) {
        store.attachToolResults(assistantMsgId, venues);
      }
      break;
    }

    case 'budget_exceeded':
      // Circuit breaker — friendly Spanish message
      store.setCircuitBreaker(true);
      store.appendContentDelta(
        assistantMsgId,
        '\n\n_El concierge está descansando por hoy. Volvé mañana._',
      );
      break;

    case 'error':
      store.appendContentDelta(assistantMsgId, `\n\n_${event.message}_`);
      break;

    case 'message_stop':
      // Terminal event — markMessageDone handled in finally block
      break;

    default:
      break;
  }
}

// ─── Core send logic (exported for testability) ────────────────────────────────

/**
 * Sends a user message and consumes the SSE stream.
 * Updates the Zustand store as events arrive.
 *
 * Exported as a plain async function so unit tests can call it directly
 * without needing renderHook (Phase 07-03 lesson).
 *
 * @param text       - User message text
 * @param store      - Zustand store state (pass useConciergeStore.getState())
 * @param csrfToken  - Token from /api/public/concierge/csrf-token
 */
export async function sendMessage(
  text: string,
  store: ConciergeStoreState,
  csrfToken: string,
): Promise<void> {
  const userMsg: ConciergeMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    text,
    isStreaming: false,
  };

  const assistantMsg: ConciergeMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    text: '',
    isStreaming: true,
    toolResults: [],
  };

  store.addMessage(userMsg);
  store.addMessage(assistantMsg);
  store.setStreaming(true);

  try {
    for await (const event of streamMessages(text, csrfToken)) {
      // Re-fetch store on each iteration (Zustand state may have changed)
      const s = useConciergeStore.getState();
      handleSseEvent(s, assistantMsg.id, event);
    }
  } catch (err) {
    const s = useConciergeStore.getState();
    const errMsg = err instanceof Error ? err.message : 'Error desconocido';

    if (errMsg === 'RATE_LIMITED') {
      s.setOverLimit(true);
    } else if (errMsg === 'CSRF_INVALID') {
      // Could retry here, for MVP just surface the error
      s.appendContentDelta(assistantMsg.id, '\n\n_Error de autenticación. Recargá la página._');
    } else {
      s.appendContentDelta(assistantMsg.id, `\n\n_Error de conexión: ${errMsg}_`);
    }
  } finally {
    const s = useConciergeStore.getState();
    s.markMessageDone(assistantMsg.id);
    s.setStreaming(false);
  }
}

// ─── React hook ───────────────────────────────────────────────────────────────

/**
 * useConciergeChat — orchestration hook for the public Concierge chat.
 *
 * Wraps sendMessage with Zustand store access.
 * Components use this hook; unit tests call sendMessage directly.
 */
export function useConciergeChat() {
  const store = useConciergeStore();

  const send = async (text: string) => {
    const csrfToken = useConciergeStore.getState().csrfToken;
    if (!csrfToken) return;
    await sendMessage(text, useConciergeStore.getState(), csrfToken);
  };

  return {
    sendMessage: send,
    isStreaming: store.isStreaming,
    messages: store.messages,
    isOverLimit: store.isOverLimit,
    isCircuitBreaker: store.isCircuitBreaker,
  };
}
