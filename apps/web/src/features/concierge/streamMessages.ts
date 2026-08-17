import type { SseEvent } from './types';

/**
 * streamMessages — async generator consuming the public Concierge SSE stream.
 *
 * CRITICAL: Uses fetch + ReadableStream + X-CSRF-Token header.
 * Do NOT use EventSource — browser EventSource cannot send custom headers.
 * Do NOT add Authorization header — this is a PUBLIC endpoint (no auth).
 *
 * @param message    - User message text
 * @param csrfToken  - Token from GET /api/public/concierge/csrf-token
 */
export async function* streamMessages(
  message: string,
  csrfToken: string,
): AsyncGenerator<SseEvent> {
  // GET-based SSE (NestJS 11 @Sse() only supports GET). CSRF cookie + token
  // remain in place for defense-in-depth, but the chat endpoint is now protected
  // primarily by IpThrottlerGuard (20 msg/hr per IP). The token endpoint still
  // sets the cookie; we send it via credentials: include for backward compat with
  // any future POST-based call.
  const qs = new URLSearchParams({ message }).toString();
  const response = await fetch(`/api/concierge/chat?${qs}`, {
    method: 'GET',
    headers: {
      'X-CSRF-Token': csrfToken,
      Accept: 'text/event-stream',
    },
    credentials: 'include',
  });

  if (response.status === 429) {
    throw new Error('RATE_LIMITED');
  }
  if (response.status === 403) {
    throw new Error('CSRF_INVALID');
  }
  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }
  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Split on newlines — SSE events are separated by blank lines (\n\n).
    // Keep the partial last line in the buffer for the next chunk.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;                        // blank separator line
      if (!trimmed.startsWith('data: ')) continue;   // ignore comments, heartbeats
      const json = trimmed.slice(6).trim();
      if (!json || json === '[DONE]') continue;      // sentinel
      try {
        yield JSON.parse(json) as SseEvent;
      } catch {
        // Malformed JSON — skip without breaking the stream
      }
    }
  }
}
