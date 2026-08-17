import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamMessages } from './streamMessages';

// ─── Helper — build a fake ReadableStream from string chunks ─────────────────

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function makeFetchMock(body: ReadableStream<Uint8Array>, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    body,
  } as unknown as Response);
}

// ─── Helper — collect all events from the async generator ────────────────────

async function collect(gen: AsyncGenerator<unknown>): Promise<unknown[]> {
  const results: unknown[] = [];
  for await (const event of gen) {
    results.push(event);
  }
  return results;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('streamMessages (concierge — public)', () => {
  it('Test 1: POST includes X-CSRF-Token header (NO Authorization)', async () => {
    const body = makeStream([]);
    const fetchMock = makeFetchMock(body);
    vi.stubGlobal('fetch', fetchMock);

    await collect(streamMessages('hola', 'test-csrf-token')).catch(() => {});

    expect(fetchMock).toHaveBeenCalledOnce();
    const callArgs = fetchMock.mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('test-csrf-token');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('Test 2: includes credentials: include to send concierge CSRF cookie', async () => {
    const body = makeStream([]);
    const fetchMock = makeFetchMock(body);
    vi.stubGlobal('fetch', fetchMock);

    await collect(streamMessages('test', 'csrf-abc')).catch(() => {});

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1]?.credentials).toBe('include');
  });

  it('Test 3: 429 response throws Error with RATE_LIMITED message', async () => {
    const body = makeStream([]);
    vi.stubGlobal('fetch', makeFetchMock(body, false, 429));

    const gen = streamMessages('test', 'csrf');
    await expect(gen.next()).rejects.toThrow('RATE_LIMITED');
  });

  it('Test 4: 403 response throws Error with CSRF_INVALID message', async () => {
    const body = makeStream([]);
    vi.stubGlobal('fetch', makeFetchMock(body, false, 403));

    const gen = streamMessages('test', 'csrf');
    await expect(gen.next()).rejects.toThrow('CSRF_INVALID');
  });

  it('Test 5: chunked buffer reassembly — events split across chunks yield correctly', async () => {
    const chunk1 = 'data: {"type":"content_delta","text":"A"}\n\ndata: {"type":"content_delta","text":"B"}\n\n';
    const half = Math.floor(chunk1.length / 2);
    const body = makeStream([chunk1.slice(0, half), chunk1.slice(half)]);
    vi.stubGlobal('fetch', makeFetchMock(body));

    const events = await collect(streamMessages('test', 'csrf'));

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'content_delta', text: 'A' });
    expect(events[1]).toEqual({ type: 'content_delta', text: 'B' });
  });

  it('Test 6: malformed JSON in stream is skipped without throwing', async () => {
    const body = makeStream([
      'data: {broken\n\ndata: {"type":"content_delta","text":"OK"}\n\n',
    ]);
    vi.stubGlobal('fetch', makeFetchMock(body));

    const events = await collect(streamMessages('test', 'csrf'));

    expect(events).toEqual([{ type: 'content_delta', text: 'OK' }]);
  });

  it('Test 7: data: [DONE] sentinel is NOT yielded', async () => {
    const body = makeStream([
      'data: {"type":"content_delta","text":"end"}\n\ndata: [DONE]\n\n',
    ]);
    vi.stubGlobal('fetch', makeFetchMock(body));

    const events = await collect(streamMessages('test', 'csrf'));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'content_delta', text: 'end' });
  });

  it('Test 8: budget_exceeded event is yielded correctly', async () => {
    const body = makeStream([
      'data: {"type":"budget_exceeded","message":"Límite diario alcanzado"}\n\n',
    ]);
    vi.stubGlobal('fetch', makeFetchMock(body));

    const events = await collect(streamMessages('test', 'csrf'));

    expect(events).toEqual([{ type: 'budget_exceeded', message: 'Límite diario alcanzado' }]);
  });
});
