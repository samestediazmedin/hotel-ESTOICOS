import { describe, it, expect } from 'vitest';
import {
  accumulateToolCallDeltas,
  type PendingToolCall,
} from './accumulate-tool-calls';

describe('accumulateToolCallDeltas (concierge)', () => {
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
        function: { name: 'search_venues', arguments: '{"query":"café","maxDistanceKm":2}' },
      } as any,
    ]);

    expect(pending[0].id).toBe('call_abc');
    expect(pending[0].name).toBe('search_venues');
    expect(pending[0].argumentsJson).toBe('{"query":"café","maxDistanceKm":2}');
    expect(JSON.parse(pending[0].argumentsJson)).toEqual({
      query: 'café',
      maxDistanceKm: 2,
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
      { index: 0, id: 'call_1', function: { name: 'search_venues', arguments: '{"query' } } as any,
    ]);

    // Chunk 2: middle fragment (no id or name — they only arrive once)
    accumulateToolCallDeltas(pending, [
      { index: 0, function: { arguments: '":"café' } } as any,
    ]);

    // Chunk 3: final fragment
    accumulateToolCallDeltas(pending, [
      { index: 0, function: { arguments: '"}' } } as any,
    ]);

    expect(pending[0].id).toBe('call_1');
    expect(pending[0].name).toBe('search_venues');
    expect(pending[0].argumentsJson).toBe('{"query":"café"}');
    expect(JSON.parse(pending[0].argumentsJson)).toEqual({ query: 'café' });
  });

  /**
   * Test 3: Multiple parallel tool calls (different indices).
   * OpenAI can request multiple tools in one assistant message.
   * Each tool_call has its own index (0, 1, ...) and accumulates independently.
   */
  it('routes fragments to correct index for parallel tool calls', () => {
    const pending: PendingToolCall[] = [];

    accumulateToolCallDeltas(pending, [
      { index: 0, id: 'call_0', function: { name: 'search_venues', arguments: '{}' } } as any,
    ]);

    accumulateToolCallDeltas(pending, [
      { index: 1, id: 'call_1', function: { name: 'get_venue_detail', arguments: '{"id":"123"}' } } as any,
    ]);

    expect(pending[0].id).toBe('call_0');
    expect(pending[0].name).toBe('search_venues');
    expect(pending[1].id).toBe('call_1');
    expect(pending[1].name).toBe('get_venue_detail');
  });

  /**
   * Test 4: id arrives only on first fragment — subsequent deltas have undefined id.
   * Accumulator must retain the first non-undefined id value.
   */
  it('retains first non-undefined id from subsequent fragments', () => {
    const pending: PendingToolCall[] = [];

    accumulateToolCallDeltas(pending, [
      { index: 0, id: 'call_xyz', function: { name: 'get_venue_detail', arguments: '{"id":"Jo' } } as any,
    ]);

    accumulateToolCallDeltas(pending, [
      { index: 0, id: undefined, function: { arguments: 'hn"}' } } as any,
    ]);

    accumulateToolCallDeltas(pending, [
      { index: 0, function: { arguments: '' } } as any,
    ]);

    expect(pending[0].id).toBe('call_xyz');
    expect(pending[0].argumentsJson).toBe('{"id":"John"}');
  });

  /**
   * Test 5: function.name arrives only on first fragment.
   * Subsequent fragments have no name field.
   */
  it('retains first non-undefined function name from subsequent fragments', () => {
    const pending: PendingToolCall[] = [];

    accumulateToolCallDeltas(pending, [
      { index: 0, id: 'call_a', function: { name: 'get_transport_info', arguments: '{"fromArea' } } as any,
    ]);

    accumulateToolCallDeltas(pending, [
      { index: 0, function: { arguments: '":"norte"}' } } as any,
    ]);

    expect(pending[0].name).toBe('get_transport_info');
    expect(pending[0].argumentsJson).toBe('{"fromArea":"norte"}');
  });

  /**
   * Test 6: Empty or undefined arguments fragment.
   * The accumulator must NOT append the string 'undefined' to argumentsJson.
   */
  it('does not append undefined to argumentsJson when arguments fragment is absent', () => {
    const pending: PendingToolCall[] = [];

    accumulateToolCallDeltas(pending, [
      { index: 0, id: 'call_q', function: { name: 'search_venues', arguments: '{}' } } as any,
    ]);

    accumulateToolCallDeltas(pending, [
      { index: 0, function: { name: undefined, arguments: undefined } } as any,
    ]);

    expect(pending[0].argumentsJson).toBe('{}');
    expect(pending[0].argumentsJson).not.toContain('undefined');
  });

  /**
   * Test 7: Accumulator never calls JSON.parse.
   * Partial JSON can be safely accumulated without any parse error.
   */
  it('can accumulate partial (invalid) JSON without errors — parse is caller responsibility', () => {
    const pending: PendingToolCall[] = [];

    const partialFragment1 = '{"query';
    const partialFragment2 = '":"café';

    expect(() => {
      accumulateToolCallDeltas(pending, [
        { index: 0, id: 'call_p', function: { name: 'search_venues', arguments: partialFragment1 } } as any,
      ]);
      accumulateToolCallDeltas(pending, [
        { index: 0, function: { arguments: partialFragment2 } } as any,
      ]);
    }).not.toThrow();

    // The accumulated string is still invalid JSON at this point
    expect(() => JSON.parse(pending[0].argumentsJson)).toThrow();
  });
});
