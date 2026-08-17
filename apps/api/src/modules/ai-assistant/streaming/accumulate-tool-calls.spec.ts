import { describe, it, expect } from 'vitest';
import {
  accumulateToolCallDeltas,
  type PendingToolCall,
} from './accumulate-tool-calls';

describe('accumulateToolCallDeltas', () => {
  /**
   * Test 1: Single chunk with complete arguments.
   * The simplest case — arguments arrive all at once.
   */
  it('handles single chunk with complete tool_call arguments', () => {
    const pending: PendingToolCall[] = [];
    accumulateToolCallDeltas(pending, [
      {
        index: 0,
        id: 'call_abc',
        function: { name: 'get_availability', arguments: '{"startDate":"2026-06-01","endDate":"2026-06-05"}' },
      } as any,
    ]);

    expect(pending[0].id).toBe('call_abc');
    expect(pending[0].name).toBe('get_availability');
    expect(pending[0].argumentsJson).toBe('{"startDate":"2026-06-01","endDate":"2026-06-05"}');
    // Only parse AFTER all chunks are accumulated — accumulator does not parse
    expect(JSON.parse(pending[0].argumentsJson)).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
  });

  /**
   * Test 2 — THE CRITICAL TEST.
   * 3-chunk reconstruction: arguments split across multiple deltas.
   * This is the exact bug that kills production OpenAI streaming.
   * JSON.parse on chunk 1 or 2 would throw — MUST wait for all chunks.
   */
  it('reconstructs JSON from fragmented arguments across 3 chunks (CRITICAL)', () => {
    const pending: PendingToolCall[] = [];

    // Chunk 1: partial JSON
    accumulateToolCallDeltas(pending, [
      { index: 0, id: 'call_1', function: { name: 'get_availability', arguments: '{"startDate' } } as any,
    ]);
    // At this point, pending[0].argumentsJson = '{"startDate' — NOT valid JSON yet

    // Chunk 2: middle fragment (no id or name — they only arrive once)
    accumulateToolCallDeltas(pending, [
      { index: 0, function: { arguments: '": "2026-06' } } as any,
    ]);
    // At this point: '{"startDate": "2026-06' — still NOT valid JSON

    // Chunk 3: final fragment
    accumulateToolCallDeltas(pending, [
      { index: 0, function: { arguments: '-01", "endDate": "2026-06-05"}' } } as any,
    ]);

    // Now all fragments are assembled — the accumulated string is valid JSON
    expect(pending[0].id).toBe('call_1');
    expect(pending[0].name).toBe('get_availability');
    expect(pending[0].argumentsJson).toBe(
      '{"startDate": "2026-06-01", "endDate": "2026-06-05"}',
    );
    // JSON.parse is the CALLER's responsibility — done here only to confirm correctness
    expect(JSON.parse(pending[0].argumentsJson)).toEqual({
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    });
  });

  /**
   * Test 3: Multiple parallel tool calls (different indices).
   * OpenAI can request multiple tools in one assistant message.
   * Each tool_call has its own index (0, 1, ...) and accumulates independently.
   */
  it('routes fragments to correct index for parallel tool calls', () => {
    const pending: PendingToolCall[] = [];

    // Tool call 0 arrives in chunk 1
    accumulateToolCallDeltas(pending, [
      { index: 0, id: 'call_0', function: { name: 'get_checkins_today', arguments: '{}' } } as any,
    ]);

    // Tool call 1 arrives in chunk 2 (parallel)
    accumulateToolCallDeltas(pending, [
      { index: 1, id: 'call_1', function: { name: 'get_checkouts_today', arguments: '{}' } } as any,
    ]);

    expect(pending[0].id).toBe('call_0');
    expect(pending[0].name).toBe('get_checkins_today');
    expect(pending[0].argumentsJson).toBe('{}');

    expect(pending[1].id).toBe('call_1');
    expect(pending[1].name).toBe('get_checkouts_today');
    expect(pending[1].argumentsJson).toBe('{}');
  });

  /**
   * Test 4: id arrives only on first fragment — subsequent deltas have undefined id.
   * Accumulator must retain the first non-undefined id value.
   */
  it('retains first non-undefined id from subsequent fragments', () => {
    const pending: PendingToolCall[] = [];

    // First delta: has id and partial arguments
    accumulateToolCallDeltas(pending, [
      { index: 0, id: 'call_xyz', function: { name: 'find_guest', arguments: '{"query":"Jo' } } as any,
    ]);

    // Second delta: id is undefined (normal for streaming — only arrives once)
    accumulateToolCallDeltas(pending, [
      { index: 0, id: undefined, function: { arguments: 'hn"}' } } as any,
    ]);

    // Third delta: id is also undefined
    accumulateToolCallDeltas(pending, [
      { index: 0, function: { arguments: '' } } as any,
    ]);

    // id should still be 'call_xyz' from first delta
    expect(pending[0].id).toBe('call_xyz');
    expect(pending[0].argumentsJson).toBe('{"query":"John"}');
  });

  /**
   * Test 5: function.name arrives only on first fragment.
   * Subsequent fragments have no name field.
   * Accumulator retains the first non-undefined name.
   */
  it('retains first non-undefined function name from subsequent fragments', () => {
    const pending: PendingToolCall[] = [];

    // First delta has name
    accumulateToolCallDeltas(pending, [
      { index: 0, id: 'call_a', function: { name: 'get_folio_summary', arguments: '{"reservation' } } as any,
    ]);

    // Subsequent deltas have NO name (undefined) — only arguments
    accumulateToolCallDeltas(pending, [
      { index: 0, function: { arguments: 'Id":"abc-123"}' } } as any,
    ]);

    expect(pending[0].name).toBe('get_folio_summary');
    expect(pending[0].argumentsJson).toBe('{"reservationId":"abc-123"}');
  });

  /**
   * Test 6: Empty or undefined arguments fragment.
   * The accumulator must NOT append the string 'undefined' to argumentsJson.
   * If tcDelta.function.arguments is undefined (rare), argumentsJson stays unchanged.
   */
  it('does not append undefined to argumentsJson when arguments fragment is absent', () => {
    const pending: PendingToolCall[] = [];

    // First delta with real arguments
    accumulateToolCallDeltas(pending, [
      { index: 0, id: 'call_q', function: { name: 'get_checkins_today', arguments: '{}' } } as any,
    ]);

    // Delta with no arguments field (can happen on very first name-only delta)
    accumulateToolCallDeltas(pending, [
      { index: 0, function: { name: undefined, arguments: undefined } } as any,
    ]);

    // argumentsJson must NOT have 'undefined' appended
    expect(pending[0].argumentsJson).toBe('{}');
    expect(pending[0].argumentsJson).not.toContain('undefined');
  });

  /**
   * Test 7: Accumulator never calls JSON.parse.
   *
   * This is a design-contract test. The accumulator's entire purpose is to
   * collect fragments. JSON.parse is SOLELY the caller's responsibility
   * (called after finish_reason === 'tool_calls' is confirmed).
   *
   * Verification: visual inspection + the fact that the accumulator function
   * in accumulate-tool-calls.ts does not import or reference JSON.parse.
   * We verify here that partial JSON (which would THROW if parsed) can be
   * safely accumulated without any parse error.
   */
  it('can accumulate partial (invalid) JSON without errors — parse is caller responsibility', () => {
    const pending: PendingToolCall[] = [];

    // These are NOT valid JSON — JSON.parse would throw on each one
    const partialFragment1 = '{"startDate';
    const partialFragment2 = '": "2026-06';
    // Fragment 2 is still not complete JSON

    // Accumulator must handle these without throwing
    expect(() => {
      accumulateToolCallDeltas(pending, [
        { index: 0, id: 'call_p', function: { name: 'get_availability', arguments: partialFragment1 } } as any,
      ]);
      accumulateToolCallDeltas(pending, [
        { index: 0, function: { arguments: partialFragment2 } } as any,
      ]);
    }).not.toThrow();

    // The accumulated string is still invalid JSON at this point
    expect(() => JSON.parse(pending[0].argumentsJson)).toThrow();
    // That's fine — the caller won't parse until finish_reason === 'tool_calls'
  });
});
