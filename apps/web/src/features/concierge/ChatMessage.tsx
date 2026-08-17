import ReactMarkdown from 'react-markdown';
import { VenueCard } from './VenueCard';
import type { ConciergeMessage } from './types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: ConciergeMessage;
}

// ─── Streaming indicator ──────────────────────────────────────────────────────

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-1 ml-1" aria-label="Concierge escribiendo">
      <span className="w-1.5 h-1.5 bg-ink-4 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 bg-ink-4 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 bg-ink-4 rounded-full animate-bounce" />
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ChatMessage — renders a single chat message bubble.
 *
 * User messages: right-aligned, blue background.
 * Assistant messages: left-aligned, gray background, react-markdown rendered.
 * Tool results (venues): rendered as VenueCard grid below the assistant text.
 *
 * XSS safety: react-markdown WITHOUT rehypeRaw / dangerouslySetInnerHTML.
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Text bubble */}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm sm:text-base leading-relaxed ${
          isUser
            ? 'bg-terracotta text-warm-white rounded-br-sm'
            : 'bg-warm-white text-ink-1 border border-warm-line rounded-bl-sm'
        }`}
      >
        {isUser ? (
          <p>{message.text}</p>
        ) : (
          <>
            {message.text && (
              <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                <ReactMarkdown>{message.text}</ReactMarkdown>
              </div>
            )}
            {message.isStreaming && !message.text && <StreamingDots />}
            {message.isStreaming && message.text && <StreamingDots />}
          </>
        )}
      </div>

      {/* Error box */}
      {message.error && (
        <div className="max-w-[85%] rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {message.error}
        </div>
      )}

      {/* Venue cards — below assistant text */}
      {!isUser && message.toolResults && message.toolResults.length > 0 && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          {message.toolResults.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      )}
    </div>
  );
}
