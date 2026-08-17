import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth.store';
import { useAiChatStore } from './ai-chat.store';
import { streamMessages } from './streamMessages';
import type { ChatMessage, SseEvent, SuggestedAction } from './types';

// ─── Context hint derivation ──────────────────────────────────────────────────

/**
 * Derives CONTEXTO ACTIVO string and ACCIONES SUGERIDAS from a tool_result event.
 * Mutates the store directly to update contextPanel.
 */
function applyContextHints(
  store: ReturnType<typeof useAiChatStore.getState>,
  toolName: string,
  result: unknown,
): void {
  if (!result || typeof result !== 'object') return;

  const actions: SuggestedAction[] = [];

  switch (toolName) {
    case 'get_availability': {
      const rows = result as Array<{ checkIn?: string; checkOut?: string }>;
      const first = rows[0];
      if (first?.checkIn && first?.checkOut) {
        store.setActiveContext(`Disponibilidad ${first.checkIn} → ${first.checkOut}`);
      }
      actions.push({ label: 'Nueva reserva', route: '/reservations/new' });
      break;
    }
    case 'find_guest': {
      const guests = result as Array<{ id?: string; fullName?: string }>;
      if (guests.length === 1 && guests[0]?.id) {
        store.setActiveContext(`Huésped: ${guests[0].fullName ?? 'seleccionado'}`);
        actions.push({ label: 'Ver perfil', route: `/guests/${guests[0].id}` });
      }
      break;
    }
    case 'get_reservation': {
      const res = result as { id?: string; roomNumber?: string };
      if (res?.id) {
        store.setActiveContext(`Reserva: ${res.id}`);
        actions.push({ label: 'Ver reserva', route: `/reservations/${res.id}` });
      }
      break;
    }
    case 'get_folio_summary': {
      const folio = result as { reservationId?: string };
      if (folio?.reservationId) {
        store.setActiveContext(`Folio de reserva ${folio.reservationId}`);
        actions.push({ label: 'Ver folio', route: `/folios/${folio.reservationId}` });
      }
      break;
    }
    case 'get_occupancy_kpi': {
      store.setActiveContext('KPIs de ocupación actualizados');
      actions.push({ label: 'Ver dashboard', route: '/dashboard' });
      break;
    }
    case 'get_checkins_today': {
      store.setActiveContext('Check-ins de hoy consultados');
      actions.push({ label: 'Ver reservas', route: '/reservations' });
      break;
    }
    case 'get_checkouts_today': {
      store.setActiveContext('Check-outs de hoy consultados');
      actions.push({ label: 'Ver reservas', route: '/reservations' });
      break;
    }
    default:
      break;
  }

  for (const action of actions) {
    store.addSuggestedAction(action);
  }
}

// ─── Core send logic (exported for testability) ────────────────────────────────

/**
 * Sends a user message and consumes the SSE stream.
 * Updates the Zustand store as events arrive.
 *
 * Exported as a plain async function so unit tests can call it directly
 * without needing renderHook.
 */
export async function sendMessage(
  text: string,
  conversationId: string | null,
  token: string,
): Promise<void> {
  const store = useAiChatStore.getState();
  store.resetContext();

  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    text,
    toolResults: [],
    isStreaming: false,
    createdAt: new Date().toISOString(),
  };
  const assistantMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    text: '',
    toolResults: [],
    isStreaming: true,
    createdAt: new Date().toISOString(),
  };

  store.appendMessage(userMsg);
  store.appendMessage(assistantMsg);
  store.setStreaming(true);

  try {
    for await (const event of streamMessages(text, conversationId, token)) {
      // Re-fetch store on each iteration (Zustand state may have changed)
      const s = useAiChatStore.getState();
      handleSseEvent(s, assistantMsg.id, event);
    }
  } catch (err) {
    const s = useAiChatStore.getState();
    const errMsg = err instanceof Error ? err.message : 'Error desconocido';
    s.appendContentDelta(assistantMsg.id, `\n\n_Error de conexión: ${errMsg}_`);
  } finally {
    const s = useAiChatStore.getState();
    s.markMessageDone(assistantMsg.id);
    s.setStreaming(false);
  }
}

function handleSseEvent(
  store: ReturnType<typeof useAiChatStore.getState>,
  assistantMsgId: string,
  event: SseEvent,
): void {
  switch (event.type) {
    case 'content_delta':
      store.appendContentDelta(assistantMsgId, event.text);
      break;
    case 'tool_call_start':
      store.addSource(event.toolName);
      break;
    case 'tool_result':
      store.addToolResultToMessage(assistantMsgId, {
        toolName: event.toolName,
        toolCallId: event.toolCallId,
        result: event.result,
        error: event.error,
      });
      store.addSource(event.toolName);
      applyContextHints(store, event.toolName, event.result);
      break;
    case 'message_stop':
      // Terminal event — markMessageDone is called in finally block
      break;
    case 'error':
      store.appendContentDelta(assistantMsgId, `\n\n_${event.message}_`);
      break;
    default:
      break;
  }
}

// ─── React hook ───────────────────────────────────────────────────────────────

/**
 * useAiChat — orchestration hook for the AI chat panel.
 *
 * Wraps sendMessage with Zustand store access and React Router navigate.
 * Components use this hook; unit tests call sendMessage directly.
 */
export function useAiChat() {
  const store = useAiChatStore();
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();

  const send = async (text: string) => {
    if (!accessToken) return;
    await sendMessage(text, store.activeConversationId, accessToken);
  };

  const navigateTo = (route: string) => {
    navigate(route);
  };

  return {
    sendMessage: send,
    navigateTo,
    isStreaming: store.isStreaming,
    messages: store.messages,
  };
}
