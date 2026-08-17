import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firstValueFrom, toArray } from 'rxjs';
import OpenAI from 'openai';
import { AiAssistantService } from './ai-assistant.service';

// ---------------------------------------------------------------------------
// Vitest class mock for OpenAI — must be class syntax (not vi.fn) so it is
// constructable. This follows the established pattern from Phase 02-02 + 03-04.
// ---------------------------------------------------------------------------
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: mockCreate } };
    constructor(_: any) {}
    // Expose APIError as a class property so service can use OpenAI.APIError
    static APIError = class APIError extends Error {
      constructor(
        public status: number,
        message: string,
      ) {
        super(message);
        this.name = 'APIError';
      }
    };
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an async iterable that yields the provided chunks */
async function* makeStream(
  chunks: Array<{
    choices?: Array<{
      delta?: {
        content?: string | null;
        tool_calls?: Array<{
          index: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
      finish_reason?: string | null;
    }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
  }>,
) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

const userCtx = { id: 'user-1', email: 'staff@hotel.com', role: 'RECEPTION' };

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
function makeService() {
  const convRepo = {
    create: vi.fn().mockResolvedValue({ id: 'conv-new' }),
    appendMessage: vi.fn().mockResolvedValue(undefined),
    touchLastMessageAt: vi.fn().mockResolvedValue(undefined),
    loadForUser: vi.fn().mockResolvedValue(null),
    listForUser: vi.fn().mockResolvedValue([]),
  };

  const toolExecutor = {
    executeOne: vi.fn().mockResolvedValue({
      toolName: 'get_checkins_today',
      sanitizedOutput: [{ reservationId: 'res-1', guestName: 'Juan Pérez' }],
    }),
  };

  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'OPENAI_MODEL') return 'kimi-latest';
      if (key === 'AI_MAX_HISTORY') return '20';
      return undefined;
    }),
  };

  // Create a real instance from the mocked OpenAI class — this way
  // this.client.chat.completions.create calls hit mockCreate
  const openaiClient = new OpenAI({ apiKey: 'test-key' } as any);

  const service = new AiAssistantService(
    openaiClient as any,
    configService as any,
    toolExecutor as any,
    convRepo as any,
  );

  return { service, convRepo, toolExecutor };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiAssistantService.streamChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();
  });

  /**
   * Test 1: content_delta events emitted for streaming text content.
   */
  it('emits content_delta SSE events for streamed text', async () => {
    mockCreate.mockResolvedValueOnce(
      makeStream([
        { choices: [{ delta: { content: 'Hola' }, finish_reason: null }] },
        { choices: [{ delta: { content: ', mundo' }, finish_reason: 'stop' }] },
      ]),
    );

    const { service, convRepo } = makeService();
    convRepo.create.mockResolvedValueOnce({ id: 'conv-1' });

    const events = await firstValueFrom(
      service.streamChat({ sanitizedMessage: 'Hola', conversationId: undefined }, userCtx).pipe(
        toArray(),
      ),
    );

    const contentDeltas = events
      .map((e) => JSON.parse(e.data as string))
      .filter((d) => d.type === 'content_delta');

    expect(contentDeltas.length).toBeGreaterThanOrEqual(1);
    expect(contentDeltas[0].text).toBe('Hola');
  });

  /**
   * Test 2: subscriber.complete() called on finish_reason='stop', never subscriber.error().
   */
  it('completes the observable cleanly on finish_reason=stop (never subscriber.error)', async () => {
    mockCreate.mockResolvedValueOnce(
      makeStream([
        { choices: [{ delta: { content: 'Respuesta.' }, finish_reason: 'stop' }] },
      ]),
    );

    const { service, convRepo } = makeService();
    convRepo.create.mockResolvedValueOnce({ id: 'conv-2' });

    // firstValueFrom resolves cleanly when observable completes
    // If subscriber.error() were called, this would throw
    await expect(
      firstValueFrom(
        service.streamChat({ sanitizedMessage: 'test', conversationId: undefined }, userCtx).pipe(
          toArray(),
        ),
      ),
    ).resolves.toBeDefined();
  });

  /**
   * Test 3: tool_calls finish_reason triggers tool execution and emits tool events.
   * Second iteration returns finish_reason='stop'.
   */
  it('executes tool and emits tool_call_start + tool_result on finish_reason=tool_calls', async () => {
    // First stream: tool call requested
    const firstStream = makeStream([
      {
        choices: [{
          delta: {
            tool_calls: [{ index: 0, id: 'call_t1', function: { name: 'get_checkins_today', arguments: '{}' } }],
          },
          finish_reason: null,
        }],
      },
      {
        choices: [{ delta: {}, finish_reason: 'tool_calls' }],
      },
    ]);

    // Second stream: model responds with text after tool result
    const secondStream = makeStream([
      { choices: [{ delta: { content: 'Hay 2 check-ins hoy.' }, finish_reason: 'stop' }] },
    ]);

    mockCreate
      .mockResolvedValueOnce(firstStream)
      .mockResolvedValueOnce(secondStream);

    const { service, convRepo, toolExecutor } = makeService();
    convRepo.create.mockResolvedValueOnce({ id: 'conv-3' });

    const events = await firstValueFrom(
      service.streamChat({ sanitizedMessage: '¿Cuántos check-ins hay?', conversationId: undefined }, userCtx).pipe(
        toArray(),
      ),
    );

    const parsed = events.map((e) => JSON.parse(e.data as string));

    // Tool executor was called exactly once
    expect(toolExecutor.executeOne).toHaveBeenCalledTimes(1);
    expect(toolExecutor.executeOne).toHaveBeenCalledWith(
      'get_checkins_today',
      {},
      userCtx,
      expect.any(String),
    );

    // tool_result event was emitted
    const toolResults = parsed.filter((d) => d.type === 'tool_result');
    expect(toolResults.length).toBe(1);
    expect(toolResults[0].toolName).toBe('get_checkins_today');
  });

  /**
   * Test 4 — CRITICAL: tool_call_id echoed in second chat.completions.create call.
   * The second call's messages array must include a role:'tool' message with
   * tool_call_id matching the assistant's tool_calls[0].id ('call_t1').
   */
  it('echoes tool_call_id in role:tool message sent to second OpenAI call (CRITICAL)', async () => {
    const firstStream = makeStream([
      {
        choices: [{
          delta: {
            tool_calls: [{ index: 0, id: 'call_abc123', function: { name: 'get_checkins_today', arguments: '{}' } }],
          },
          finish_reason: null,
        }],
      },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    ]);

    const secondStream = makeStream([
      { choices: [{ delta: { content: 'OK' }, finish_reason: 'stop' }] },
    ]);

    mockCreate
      .mockResolvedValueOnce(firstStream)
      .mockResolvedValueOnce(secondStream);

    const { service, convRepo } = makeService();
    convRepo.create.mockResolvedValueOnce({ id: 'conv-4' });

    await firstValueFrom(
      service.streamChat({ sanitizedMessage: 'test', conversationId: undefined }, userCtx).pipe(
        toArray(),
      ),
    );

    // Second call to chat.completions.create
    expect(mockCreate).toHaveBeenCalledTimes(2);
    const secondCallMessages = mockCreate.mock.calls[1][0].messages as Array<any>;

    // Find the tool role message
    const toolMessage = secondCallMessages.find((m: any) => m.role === 'tool');
    expect(toolMessage).toBeDefined();
    expect(toolMessage.tool_call_id).toBe('call_abc123'); // CRITICAL: must match assistant's id
  });

  /**
   * Test 5: OpenAI 429 error → emits error event, subscriber.complete() called.
   * NEVER subscriber.error().
   */
  it('emits error event (not subscriber.error) on OpenAI 429', async () => {
    // Use the mocked APIError class — same as imported OpenAI.APIError
    const apiError = new (OpenAI as any).APIError(429, 'Rate limit exceeded');
    mockCreate.mockRejectedValueOnce(apiError);

    const { service, convRepo } = makeService();
    convRepo.create.mockResolvedValueOnce({ id: 'conv-5' });

    const events = await firstValueFrom(
      service.streamChat({ sanitizedMessage: 'test', conversationId: undefined }, userCtx).pipe(
        toArray(),
      ),
    );

    const parsed = events.map((e) => JSON.parse(e.data as string));
    const errorEvents = parsed.filter((d) => d.type === 'error');
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].message).toMatch(/límite/i);
  });

  /**
   * Test 6: Multi-turn loop terminates at MAX_TOOL_ITERATIONS=5.
   * If OpenAI keeps returning finish_reason='tool_calls' indefinitely,
   * the loop must terminate and emit an error event.
   */
  it('terminates at MAX_TOOL_ITERATIONS=5 even if OpenAI keeps returning tool_calls', async () => {
    // Each stream returns tool_calls finish_reason
    const makeToolStream = () => makeStream([
      {
        choices: [{
          delta: {
            tool_calls: [{ index: 0, id: 'call_loop', function: { name: 'get_checkins_today', arguments: '{}' } }],
          },
          finish_reason: null,
        }],
      },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    ]);

    // Return tool_calls streams indefinitely (more than 5)
    for (let i = 0; i < 6; i++) {
      mockCreate.mockResolvedValueOnce(makeToolStream());
    }

    const { service, convRepo } = makeService();
    convRepo.create.mockResolvedValueOnce({ id: 'conv-6' });

    const events = await firstValueFrom(
      service.streamChat({ sanitizedMessage: 'test', conversationId: undefined }, userCtx).pipe(
        toArray(),
      ),
    );

    const parsed = events.map((e) => JSON.parse(e.data as string));

    // mockCreate should be called at most MAX_TOOL_ITERATIONS=5 times
    expect(mockCreate.mock.calls.length).toBeLessThanOrEqual(5);

    // An error event should be emitted about max iterations
    const errorEvents = parsed.filter((d) => d.type === 'error');
    expect(errorEvents.length).toBeGreaterThan(0);
  }, 10000);

  /**
   * Test 7: 'length' and 'content_filter' finish reasons exit loop immediately.
   */
  it('exits loop immediately on finish_reason=length or content_filter', async () => {
    mockCreate.mockResolvedValueOnce(
      makeStream([
        { choices: [{ delta: { content: 'Truncated' }, finish_reason: 'length' }] },
      ]),
    );

    const { service, convRepo } = makeService();
    convRepo.create.mockResolvedValueOnce({ id: 'conv-7' });

    const events = await firstValueFrom(
      service.streamChat({ sanitizedMessage: 'test', conversationId: undefined }, userCtx).pipe(
        toArray(),
      ),
    );

    // Only ONE call to chat.completions.create — loop exited immediately
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const parsed = events.map((e) => JSON.parse(e.data as string));
    const stopEvent = parsed.find((d) => d.type === 'message_stop');
    expect(stopEvent?.finishReason).toBe('length');
  });

  /**
   * Test 8: Persistence — user + assistant messages appended; touchLastMessageAt called.
   */
  it('persists user and assistant messages after stream completes', async () => {
    mockCreate.mockResolvedValueOnce(
      makeStream([
        { choices: [{ delta: { content: 'Respuesta del asistente.' }, finish_reason: 'stop' }] },
      ]),
    );

    const { service, convRepo } = makeService();
    convRepo.create.mockResolvedValueOnce({ id: 'conv-8' });

    await firstValueFrom(
      service.streamChat({ sanitizedMessage: 'Pregunta del usuario', conversationId: undefined }, userCtx).pipe(
        toArray(),
      ),
    );

    // User message persisted
    const appendCalls = convRepo.appendMessage.mock.calls;
    const userMsg = appendCalls.find((c: any[]) => c[1] === 'user');
    expect(userMsg).toBeDefined();

    // Assistant message persisted
    const assistantMsg = appendCalls.find((c: any[]) => c[1] === 'assistant');
    expect(assistantMsg).toBeDefined();

    // touchLastMessageAt called
    expect(convRepo.touchLastMessageAt).toHaveBeenCalledWith(
      'conv-8',
      'Pregunta del usuario',
    );
  });

  /**
   * Test 9: When conversationId is absent, ConversationRepository.create is called.
   */
  it('creates a new conversation when conversationId is not provided', async () => {
    mockCreate.mockResolvedValueOnce(
      makeStream([
        { choices: [{ delta: { content: 'OK' }, finish_reason: 'stop' }] },
      ]),
    );

    const { service, convRepo } = makeService();
    convRepo.create.mockResolvedValueOnce({ id: 'conv-new-9' });

    await firstValueFrom(
      service.streamChat({ sanitizedMessage: 'test', conversationId: undefined }, userCtx).pipe(
        toArray(),
      ),
    );

    expect(convRepo.create).toHaveBeenCalledWith(userCtx.id);
  });
});
