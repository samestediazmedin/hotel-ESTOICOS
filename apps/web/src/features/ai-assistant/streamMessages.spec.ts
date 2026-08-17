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

describe('streamMessages', () => {
  it('Test 1: yields content_delta event from a single chunk', async () => {
    const body = makeStream(['data: {"type":"content_delta","text":"Hola"}\n\n']);
    vi.stubGlobal('fetch', makeFetchMock(body));

    const events = await collect(streamMessages('hola', null, 'token-abc'));

    expect(events).toEqual([{ type: 'content_delta', text: 'Hola' }]);
  });

  it('Test 2: handles two events split across two reader.read() calls', async () => {
    // First chunk ends in the middle of the second event's newline
    const chunk1 = 'data: {"type":"content_delta","text":"A"}\n\ndata: {"type":"content_delta","text":"B"}\n\n';
    // Split into two chunks to simulate network chunking
    const half = Math.floor(chunk1.length / 2);
    const body = makeStream([chunk1.slice(0, half), chunk1.slice(half)]);
    vi.stubGlobal('fetch', makeFetchMock(body));

    const events = await collect(streamMessages('test', null, 'token-abc'));

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'content_delta', text: 'A' });
    expect(events[1]).toEqual({ type: 'content_delta', text: 'B' });
  });

  it('Test 3: skips malformed JSON event lines without throwing', async () => {
    const body = makeStream([
      'data: {broken\n\ndata: {"type":"content_delta","text":"OK"}\n\n',
    ]);
    vi.stubGlobal('fetch', makeFetchMock(body));

    const events = await collect(streamMessages('test', null, 'token'));

    expect(events).toEqual([{ type: 'content_delta', text: 'OK' }]);
  });

  it('Test 4: ignores lines not starting with "data: " (comments, heartbeats)', async () => {
    const body = makeStream([
      ': ping\n\ndata: {"type":"content_delta","text":"Hi"}\n\n',
    ]);
    vi.stubGlobal('fetch', makeFetchMock(body));

    const events = await collect(streamMessages('test', null, 'token'));

    expect(events).toEqual([{ type: 'content_delta', text: 'Hi' }]);
  });

  it('Test 5: data: [DONE] sentinel is NOT yielded', async () => {
    const body = makeStream([
      'data: {"type":"content_delta","text":"end"}\n\ndata: [DONE]\n\n',
    ]);
    vi.stubGlobal('fetch', makeFetchMock(body));

    const events = await collect(streamMessages('test', null, 'token'));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'content_delta', text: 'end' });
  });

  it('Test 6: fetch is called with Authorization: Bearer <token> header', async () => {
    const body = makeStream([]);
    const fetchMock = makeFetchMock(body);
    vi.stubGlobal('fetch', fetchMock);

    await collect(streamMessages('msg', null, 'my-jwt-token'));

    expect(fetchMock).toHaveBeenCalledOnce();
    const callArgs = fetchMock.mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('Test 7: if response.ok is false, generator throws Error before yielding', async () => {
    const body = makeStream([]);
    vi.stubGlobal('fetch', makeFetchMock(body, false, 401));

    const gen = streamMessages('test', null, 'bad-token');
    await expect(gen.next()).rejects.toThrow('HTTP 401');
  });
});
