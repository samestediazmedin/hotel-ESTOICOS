import ReactMarkdown from 'react-markdown';
import { RichToolResult } from './RichToolResult';
import type { ChatMessage as ChatMessageType } from './types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: ChatMessageType;
}

// ─── Streaming indicator ──────────────────────────────────────────────────────

function StreamingDot() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1" aria-label="escribiendo">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-4 animate-pulse" />
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-4 animate-pulse [animation-delay:150ms]" />
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-4 animate-pulse [animation-delay:300ms]" />
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ChatMessage — renders a single chat message bubble.
 *
 * User: right-aligned, brand-primary background.
 * Assistant: left-aligned, surface background.
 * Tool results rendered inline via RichToolResult.
 * Assistant text goes through ReactMarkdown — NO dangerouslySetInnerHTML, NO rehypeRaw.
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-warm-paper border border-warm-line text-ink-1 ml-auto'
            : 'bg-warm-white border border-warm-line text-ink-1 mr-auto'
        }`}
      >
        {isUser ? (
          /* User message — plain text (no markdown needed) */
          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        ) : (
          /* Assistant message — safe markdown rendering */
          <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2">
            {message.text && (
              <ReactMarkdown>{message.text}</ReactMarkdown>
            )}
            {message.isStreaming && !message.text && (
              <span className="text-ink-3 text-xs italic">Asistente escribiendo</span>
            )}
            {message.isStreaming && <StreamingDot />}
          </div>
        )}

        {/* Tool results rendered inline */}
        {message.toolResults.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {message.toolResults.map((tr, i) => (
              <RichToolResult
                key={`${tr.toolCallId}-${i}`}
                toolName={tr.toolName}
                result={tr.result}
                error={tr.error}
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {message.isError && (
          <div className="mt-2 text-xs text-terracotta bg-terracotta-tint border border-terracotta-soft rounded px-2 py-1">
            Error al obtener la respuesta
          </div>
        )}
      </div>
    </div>
  );
}
