import type { SseEvent } from './types';

/**
 * streamMessages — async generator consuming the AI assistant SSE stream.
 *
 * CRITICAL: Uses fetch + ReadableStream + Authorization Bearer header.
 * Do NOT use EventSource — the browser spec forbids custom headers on EventSource.
 *
 * @param message    - User message text
 * @param conversationId - Optional existing conversation ID
 * @param token      - JWT access token (placed in Authorization: Bearer header)
 */
export async function* streamMessages(
  message: string,
  conversationId: string | null,
  token: string,
): AsyncGenerator<SseEvent> {
  const url = new URL('/api/ai-assistant/stream', window.location.origin);
  url.searchParams.set('message', message);
  if (conversationId) {
    url.searchParams.set('conversationId', conversationId);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
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
    // We split line by line; a blank line signals an event boundary.
    // The partial last line is kept in the buffer for the next chunk.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;                        // blank separator line
      if (!trimmed.startsWith('data: ')) continue;   // ignore comments, heartbeats
      const json = trimmed.slice(6).trim();
      if (!json || json === '[DONE]') continue;      // OpenAI sentinel
      try {
        yield JSON.parse(json) as SseEvent;
      } catch {
        // Malformed JSON — skip without breaking the stream
      }
    }
  }
}
