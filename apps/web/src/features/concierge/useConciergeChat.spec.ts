import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SseEvent } from './types';

// ─── Mock streamMessages ──────────────────────────────────────────────────────

vi.mock('./streamMessages', () => ({
  streamMessages: vi.fn(),
}));

// ─── Helper: async generator from events array ────────────────────────────────

async function* makeEventStream(events: SseEvent[]): AsyncGenerator<SseEvent> {
  for (const event of events) {
    yield event;
  }
}

// ─── Import after mocks ───────────────────────────────────────────────────────

import { sendMessage } from './useConciergeChat';
import { streamMessages as streamMessagesMock } from './streamMessages';
import { useConciergeStore } from './concierge.store';

const mockStream = streamMessagesMock as ReturnType<typeof vi.fn>;

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useConciergeStore.setState({
    messages: [],
    isStreaming: false,
    csrfToken: null,
    isOverLimit: false,
    isCircuitBreaker: false,
  });
  mockStream.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sendMessage (useConciergeChat)', () => {
  it('Test 1: creates a user message AND an empty streaming assistant placeholder', async () => {
    mockStream.mockReturnValue(makeEventStream([]));

    await sendMessage('hola', useConciergeStore.getState(), 'test-csrf');

    const { messages } = useConciergeStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].text).toBe('hola');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].isStreaming).toBe(false); // done after stream ends
  });

  it('Test 2: content_delta events accumulate text on assistant placeholder', async () => {
    mockStream.mockReturnValue(
      makeEventStream([
        { type: 'content_delta', text: 'Hola' },
        { type: 'content_delta', text: ', mundo' },
      ]),
    );

    await sendMessage('hi', useConciergeStore.getState(), 'test-csrf');

    const { messages } = useConciergeStore.getState();
    const assistant = messages.find((m) => m.role === 'assistant')!;
    expect(assistant.text).toBe('Hola, mundo');
  });

  it('Test 3: tool_result with venue shape attaches venue data to message', async () => {
    const venueResult = {
      venues: [
        {
          id: 'v1',
          name: 'Restaurante La Mesa',
          type: 'RESTAURANT',
          rating: 4.5,
          distanceKm: 1.2,
          photoUrl: null,
          mapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=4.5,-74.0',
          phone: '+571234567890',
          reservationUrl: null,
          address: 'Calle 123',
        },
      ],
    };

    mockStream.mockReturnValue(
      makeEventStream([
        {
          type: 'tool_result',
          toolName: 'search_venues',
          toolCallId: 'call_1',
          result: venueResult,
        },
      ]),
    );

    await sendMessage('restaurantes', useConciergeStore.getState(), 'test-csrf');

    const { messages } = useConciergeStore.getState();
    const assistant = messages.find((m) => m.role === 'assistant')!;
    expect(assistant.toolResults).toBeDefined();
    expect(assistant.toolResults!.length).toBeGreaterThan(0);
  });

  it('Test 4: budget_exceeded event sets isCircuitBreaker + appends friendly message', async () => {
    mockStream.mockReturnValue(
      makeEventStream([
        { type: 'budget_exceeded', message: 'Límite diario alcanzado' },
      ]),
    );

    await sendMessage('test', useConciergeStore.getState(), 'test-csrf');

    const state = useConciergeStore.getState();
    expect(state.isCircuitBreaker).toBe(true);
    const assistant = state.messages.find((m) => m.role === 'assistant')!;
    expect(assistant.text).toContain('descansando');
  });

  it('Test 5: RATE_LIMITED throw sets isOverLimit + leaves input in disabled state', async () => {
    // eslint-disable-next-line require-yield
    mockStream.mockImplementation(async function* () {
      throw new Error('RATE_LIMITED');
    });

    await sendMessage('test', useConciergeStore.getState(), 'test-csrf');

    const state = useConciergeStore.getState();
    expect(state.isOverLimit).toBe(true);
    expect(state.isStreaming).toBe(false);
  });
});
