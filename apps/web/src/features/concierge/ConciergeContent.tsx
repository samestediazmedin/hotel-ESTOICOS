import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ConciergeHero } from './components/ConciergeHero';
import { fetchCsrfToken } from './concierge.api';
import { useConciergeStore } from './concierge.store';
import { sendMessage } from './useConciergeChat';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConciergeContentProps {
  /**
   * When embedded inside a drawer the container height is managed externally.
   * Pass `embedded` to use h-full instead of h-[calc(100vh-57px)].
   */
  embedded?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ConciergeContent — the chat interface without any page-level layout chrome.
 *
 * Usable in two contexts:
 *  1. Standalone (`embedded=false`, default): renders inside PublicConciergeLayout.
 *     Height accounts for the 57px layout header via calc.
 *  2. Drawer (`embedded=true`): renders inside ConciergeDrawer.
 *     Height fills the drawer body via h-full.
 *
 * CON-01: Accessible to anonymous visitors — no auth check, no staff sidebar.
 * CON-05: Tool results render as VenueCard components inside ChatMessage.
 */
export function ConciergeContent({ embedded = false }: ConciergeContentProps) {
  const store = useConciergeStore();
  const { messages, isStreaming, isOverLimit, isCircuitBreaker, csrfToken } = store;
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Fetch CSRF token on mount ───────────────────────────────────────────

  const { isError: isCsrfError } = useQuery({
    queryKey: ['concierge-csrf'],
    queryFn: async () => {
      const token = await fetchCsrfToken();
      useConciergeStore.getState().setCsrfToken(token);
      return token;
    },
    staleTime: 30 * 60 * 1000, // 30 min (CSRF token valid for session)
    retry: 3,
  });

  // ─── Auto-scroll to bottom ───────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Send handler ────────────────────────────────────────────────────────

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !csrfToken || isStreaming || isOverLimit || isCircuitBreaker) return;

    setInputText('');
    await sendMessage(trimmed, useConciergeStore.getState(), csrfToken);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSend(inputText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend(inputText);
    }
  };

  const inputDisabled = isStreaming || isOverLimit || isCircuitBreaker || !csrfToken;

  const heightClass = embedded ? 'h-full' : 'h-[calc(100vh-57px)]';

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col ${heightClass}`}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
        {/* Empty state — hero with category mosaic */}
        {messages.length === 0 && (
          <ConciergeHero
            onSelectQuery={(q) => void handleSend(q)}
            disabled={inputDisabled}
          />
        )}

        {/* Chat messages */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Status banners */}
      {isOverLimit && (
        <div className="mx-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 text-center">
          Has alcanzado el límite de consultas. Volvé en una hora.
        </div>
      )}
      {isCircuitBreaker && (
        <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 text-center">
          El concierge está descansando por hoy. Volvé mañana.
        </div>
      )}
      {isCsrfError && (
        <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 text-center">
          Error de conexión. Recargá la página.
        </div>
      )}

      {/* Input form — sticky at bottom, large touch target for mobile */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-warm-line bg-warm-white px-4 py-3 flex items-end gap-2"
      >
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            inputDisabled && !isStreaming
              ? 'Chat no disponible'
              : 'Preguntame sobre Bogotá...'
          }
          disabled={inputDisabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-warm-line bg-warm-paper px-4 py-3 text-sm text-ink-1 placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] max-h-32 overflow-y-auto"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        <button
          type="submit"
          disabled={inputDisabled || !inputText.trim()}
          className="shrink-0 rounded-xl bg-terracotta p-3 min-h-[48px] min-w-[48px] flex items-center justify-center text-warm-white hover:bg-terracotta-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Enviar mensaje"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
