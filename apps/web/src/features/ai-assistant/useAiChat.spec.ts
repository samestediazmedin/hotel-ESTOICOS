import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiChatStore } from './ai-chat.store';
import type { SseEvent } from './types';

// ─── Mock streamMessages ──────────────────────────────────────────────────────

vi.mock('./streamMessages', () => ({
  streamMessages: vi.fn(),
}));

// ─── Mock auth store ──────────────────────────────────────────────────────────

vi.mock('@/features/auth/auth.store', () => ({
  useAuthStore: (selector: (s: { accessToken: string | null }) => unknown) =>
    selector({ accessToken: 'mock-token' }),
}));

// ─── Mock react-router-dom navigate ──────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// ─── Helper: async generator from events array ────────────────────────────────

async function* makeEventStream(events: SseEvent[]): AsyncGenerator<SseEvent> {
  for (const event of events) {
    yield event;
  }
}

// ─── Import after mocks ───────────────────────────────────────────────────────

import { sendMessage as sendMessageFn } from './useAiChat';
import { streamMessages as streamMessagesMock } from './streamMessages';

const mockStream = streamMessagesMock as ReturnType<typeof vi.fn>;

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset Zustand store state
  useAiChatStore.setState({
    isOpen: false,
    activeConversationId: null,
    messages: [],
    isStreaming: false,
    contextPanel: { activeContext: null, sources: [], suggestedActions: [] },
  });
  mockStream.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sendMessage (useAiChat)', () => {
  it('Test 1: creates a user message AND an empty streaming assistant message', async () => {
    mockStream.mockReturnValue(makeEventStream([]));

    await sendMessageFn('hola', null, 'mock-token');

    const { messages } = useAiChatStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].text).toBe('hola');
    expect(messages[0].isStreaming).toBe(false);
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].isStreaming).toBe(false); // done after stream ends
  });

  it('Test 2: content_delta events are appended to the assistant message', async () => {
    mockStream.mockReturnValue(
      makeEventStream([
        { type: 'content_delta', text: 'Hola' },
        { type: 'content_delta', text: ', mundo' },
      ]),
    );

    await sendMessageFn('hi', null, 'mock-token');

    const { messages } = useAiChatStore.getState();
    const assistant = messages.find((m) => m.role === 'assistant')!;
    expect(assistant.text).toBe('Hola, mundo');
  });

  it('Test 3: tool_result event adds toolResult to assistant message + addSource called', async () => {
    mockStream.mockReturnValue(
      makeEventStream([
        {
          type: 'tool_result',
          toolName: 'get_availability',
          toolCallId: 'call_1',
          result: [{ roomNumber: '101', type: 'SIMPLE' }],
        },
      ]),
    );

    await sendMessageFn('disponibilidad', null, 'mock-token');

    const { messages, contextPanel } = useAiChatStore.getState();
    const assistant = messages.find((m) => m.role === 'assistant')!;
    expect(assistant.toolResults).toHaveLength(1);
    expect(assistant.toolResults[0].toolName).toBe('get_availability');
    expect(contextPanel.sources).toContain('get_availability');
  });

  it('Test 4: message_stop event sets isStreaming false', async () => {
    mockStream.mockReturnValue(
      makeEventStream([
        { type: 'content_delta', text: 'ok' },
        { type: 'message_stop', finishReason: 'stop' },
      ]),
    );

    await sendMessageFn('test', null, 'mock-token');

    const { isStreaming, messages } = useAiChatStore.getState();
    expect(isStreaming).toBe(false);
    const assistant = messages.find((m) => m.role === 'assistant')!;
    expect(assistant.isStreaming).toBe(false);
  });

  it('Test 5: error event adds error text to assistant message and resets streaming', async () => {
    mockStream.mockReturnValue(
      makeEventStream([{ type: 'error', message: 'Backend error' }]),
    );

    await sendMessageFn('test', null, 'mock-token');

    const { isStreaming, messages } = useAiChatStore.getState();
    expect(isStreaming).toBe(false);
    const assistant = messages.find((m) => m.role === 'assistant')!;
    expect(assistant.isStreaming).toBe(false);
    expect(assistant.text).toContain('Backend error');
  });

  it('Test 6: if streamMessages throws, error message appears and isStreaming resets', async () => {
    // eslint-disable-next-line require-yield
    mockStream.mockImplementation(async function* () {
      throw new Error('Network error');
    });

    await sendMessageFn('test', null, 'mock-token');

    const { isStreaming, messages } = useAiChatStore.getState();
    expect(isStreaming).toBe(false);
    const assistant = messages.find((m) => m.role === 'assistant')!;
    expect(assistant.text).toContain('Error');
    expect(assistant.isStreaming).toBe(false);
  });
});
