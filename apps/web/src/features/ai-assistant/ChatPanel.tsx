import { useRef, useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Sparkles, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAiChatStore } from './ai-chat.store';
import { useAiChat } from './useAiChat';
import { ChatMessage } from './ChatMessage';
import { ContextPanel } from './ContextPanel';
import { aiAssistantApi } from './ai-assistant.api';
import type { ConversationDetail } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapBackendMessages(
  messages: ConversationDetail['messages'],
) {
  return messages.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    text: m.content,
    toolResults: [],
    isStreaming: false,
    createdAt: m.createdAt,
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ChatPanel — right-side inline fixed-panel AI assistant.
 *
 * Pattern: inline fixed-panel drawer (same as RoomDrawer, CheckInDrawer).
 * NOT a shadcn Sheet — uses `fixed inset-y-0 right-0` classes directly.
 *
 * Two-column layout:
 *   Left: chat thread (scrollable messages + input)
 *   Right: ContextPanel with 3 sections (CONTEXTO ACTIVO, FUENTES CONSULTADAS, ACCIONES SUGERIDAS)
 *
 * Floating launcher button appears when panel is closed.
 * Both are z-40 to sit above page content but below modals (z-50+).
 */
export function ChatPanel() {
  const {
    isOpen,
    open,
    close,
    messages,
    isStreaming,
    activeConversationId,
    setActiveConversation,
    setMessages,
  } = useAiChatStore();

  const { sendMessage } = useAiChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Scroll to bottom when new messages arrive ──────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Keyboard shortcut: Esc closes the panel ───────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  // ── Conversation list ──────────────────────────────────────────────────────
  const conversationsQuery = useQuery({
    queryKey: ['ai', 'conversations'],
    queryFn: aiAssistantApi.listConversations,
    enabled: isOpen,
    staleTime: 30_000,
  });

  // ── Load existing conversation ─────────────────────────────────────────────
  const loadConvMutation = useMutation({
    mutationFn: aiAssistantApi.loadConversation,
    onSuccess: (conv: ConversationDetail) => {
      setActiveConversation(conv.id);
      setMessages(mapBackendMessages(conv.messages));
    },
  });

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    await sendMessage(text);
  };

  // ── Conversation selector change ──────────────────────────────────────────
  const handleConversationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '') {
      // New conversation
      setActiveConversation(null);
      setMessages([]);
    } else {
      loadConvMutation.mutate(val);
    }
  };

  return (
    <>
      {/* ── Floating launcher button ─────────────────────────────────────── */}
      {!isOpen && (
        <button
          type="button"
          aria-label="Abrir asistente IA"
          onClick={open}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-terracotta text-warm-white shadow-lg hover:bg-terracotta-deep transition-colors"
        >
          <Sparkles className="h-6 w-6" aria-hidden />
        </button>
      )}

      {/* ── Right-side inline fixed panel ───────────────────────────────── */}
      {isOpen && (
        <>
          {/* Backdrop — semi-transparent overlay */}
          <div
            className="fixed inset-0 z-30 bg-ink-1/20 lg:hidden"
            onClick={close}
            aria-hidden="true"
          />

          {/* Panel — inline fixed-panel pattern (NOT shadcn Sheet) */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Asistente IA"
            className="fixed inset-y-0 right-0 z-40 w-full lg:w-[800px] bg-warm-paper shadow-2xl border-l border-warm-line grid grid-cols-1 lg:grid-cols-[60%_40%]"
          >
            {/* ── LEFT column: chat thread ──────────────────────────────── */}
            <div className="flex flex-col min-h-0 border-r border-warm-line">
              {/* Header */}
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-warm-line bg-warm-white px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Sparkles className="h-5 w-5 shrink-0 text-terracotta" aria-hidden />
                  <h2 className="font-display italic text-lg text-ink-1 truncate">
                    Asistente IA
                  </h2>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Conversation selector */}
                  <select
                    aria-label="Historial de conversaciones"
                    value={activeConversationId ?? ''}
                    onChange={handleConversationChange}
                    className="max-w-[180px] h-8 rounded-md border border-warm-line bg-warm-paper px-2 text-xs text-ink-1 focus:outline-none focus:ring-1 focus:ring-terracotta"
                  >
                    <option value="">Nueva conversación</option>
                    {conversationsQuery.data?.map((conv) => (
                      <option key={conv.id} value={conv.id}>
                        {conv.title ?? `Conversación ${conv.id.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>

                  {/* Close button */}
                  <button
                    type="button"
                    aria-label="Cerrar asistente"
                    onClick={close}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:text-ink-1 hover:bg-warm-cream transition-colors"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </header>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {messages.length === 0 && !isStreaming && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                    <Sparkles className="h-10 w-10 text-terracotta opacity-30" aria-hidden />
                    <p className="text-sm text-ink-3 max-w-[260px]">
                      Pregunta sobre disponibilidad, reservas, huéspedes, check-ins o reportes de ocupación.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {[
                        '¿Qué habitaciones están disponibles hoy?',
                        '¿Quién entra hoy?',
                        '¿Cuál es la ocupación esta semana?',
                      ].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setInput(s)}
                          className="border border-warm-line hover:bg-warm-cream text-sm text-ink-2 hover:text-ink-1 rounded-full px-3 py-1.5 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m) => (
                  <ChatMessage key={m.id} message={m} />
                ))}
                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Input form */}
              <form
                onSubmit={handleSubmit}
                className="shrink-0 border-t border-warm-line bg-warm-white px-4 py-4 flex gap-2 items-end"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Pregunta algo al asistente..."
                  disabled={isStreaming}
                  rows={2}
                  className="flex-1 resize-none rounded-md border border-warm-line bg-warm-paper px-3 py-2 text-sm text-ink-1 placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-terracotta disabled:opacity-50"
                />
                <Button
                  type="submit"
                  variant="terracotta"
                  size="sm"
                  disabled={!input.trim() || isStreaming}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Enviar</span>
                </Button>
              </form>
            </div>

            {/* ── RIGHT column: context panel (hidden on mobile) ────────── */}
            <div className="hidden lg:flex flex-col min-h-0 overflow-auto bg-warm-paper">
              <ContextPanel />
            </div>
          </div>
        </>
      )}
    </>
  );
}
