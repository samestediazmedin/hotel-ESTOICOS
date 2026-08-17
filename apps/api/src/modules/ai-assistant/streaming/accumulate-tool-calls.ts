import type OpenAI from 'openai';

/**
 * PendingToolCall — accumulator entry for a single tool call in flight.
 *
 * IMPORTANT: argumentsJson is a raw JSON string fragment accumulator.
 * Do NOT call JSON.parse on this until finish_reason === 'tool_calls' is confirmed.
 * The caller (AiAssistantService) is responsible for parsing after the loop ends.
 */
export interface PendingToolCall {
  index: number;
  id: string;
  name: string;
  argumentsJson: string; // accumulated fragments — DO NOT JSON.parse here
}

/**
 * accumulateToolCallDeltas — apply one chunk's delta.tool_calls to the accumulator.
 *
 * OpenAI streams tool_call data across multiple chunks:
 * - Chunk 1: { index: 0, id: 'call_abc', function: { name: 'get_availability', arguments: '{"start' } }
 * - Chunk 2: { index: 0, function: { arguments: 'Date":"2026' } }
 * - Chunk 3: { index: 0, function: { arguments: '-06-01"}' } }
 *
 * This function mutates the pending array in place, appending argument fragments
 * to the correct index slot. id and name are retained from their first appearance.
 *
 * CRITICAL: This function MUST NOT call JSON.parse — arguments are fragments
 * of partial JSON that would throw. Parse only after finish_reason === 'tool_calls'.
 *
 * @param pending - Mutable accumulator array (indexed by tool_call index)
 * @param deltaToolCalls - The delta.tool_calls array from a single chunk
 * @returns The same pending array reference (mutated)
 */
export function accumulateToolCallDeltas(
  pending: PendingToolCall[],
  deltaToolCalls:
    | OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[]
    | undefined
    | null,
): PendingToolCall[] {
  if (!deltaToolCalls) return pending;

  for (const tcDelta of deltaToolCalls) {
    const idx = tcDelta.index;

    // Initialize slot if not yet present
    if (!pending[idx]) {
      pending[idx] = { index: idx, id: '', name: '', argumentsJson: '' };
    }

    // id arrives only on first delta for this tool call — retain first non-empty value
    if (tcDelta.id) {
      pending[idx].id = tcDelta.id;
    }

    // name arrives only on first delta — retain first non-empty value
    if (tcDelta.function?.name) {
      pending[idx].name = tcDelta.function.name;
    }

    // Append argument fragment — MUST check for undefined to avoid 'undefined' string
    // Do NOT JSON.parse here — fragment may be invalid JSON mid-stream
    if (tcDelta.function?.arguments) {
      pending[idx].argumentsJson += tcDelta.function.arguments;
    }
  }

  return pending;
}
