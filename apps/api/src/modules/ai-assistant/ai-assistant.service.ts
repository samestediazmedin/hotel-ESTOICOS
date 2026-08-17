import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import OpenAI from 'openai';
import { accumulateToolCallDeltas, type PendingToolCall } from './streaming/accumulate-tool-calls';
import { SYSTEM_PROMPT, buildRoleContextMessage } from './streaming/system-prompt';
import { getToolDefinitionsForRole } from './tool-registry';
import type { Role, UserContext } from './tool-registry';
import { ToolExecutorService } from './tool-executor.service';
import { ConversationRepository } from './conversation.repository';

/**
 * AiAssistantService — orchestrates the streaming AI assistant.
 *
 * Implements the streaming pipeline for the @Sse('stream') endpoint:
 * 1. Resolve or create conversation
 * 2. Persist user message
 * 3. Build messages array (system + role context + history + user message)
 * 4. Run OpenAI chat.completions.create with stream:true, tools filtered by role (AI-23)
 * 5. Accumulate tool_calls fragments (CRITICAL — see accumulateToolCallDeltas)
 * 6. Execute tools on finish_reason='tool_calls', push results back
 * 7. Loop up to MAX_TOOL_ITERATIONS=5
 * 8. Persist assistant + tool messages on complete
 * 9. Emit SSE events to subscriber throughout
 *
 * CRITICAL safety rules:
 * - NEVER call subscriber.error() — breaks SSE transport (Pitfall #4)
 * - NEVER call JSON.parse on argument fragments mid-stream (Pitfall #1)
 * - ALWAYS echo tool_call_id in role:'tool' messages (Pitfall #2)
 */

const MAX_TOOL_ITERATIONS = 5;

@Injectable()
export class AiAssistantService {
  private readonly model: string;
  private readonly maxHistory: number;

  constructor(
    @Inject('OPENAI_CLIENT') private readonly client: OpenAI,
    private readonly config: ConfigService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly convRepo: ConversationRepository,
  ) {
    this.model = this.config.get<string>('OPENAI_MODEL') ?? 'kimi-latest';
    this.maxHistory = Number(this.config.get<string>('AI_MAX_HISTORY') ?? '20');
  }

  /**
   * streamChat — returns an Observable<MessageEvent> that wraps the OpenAI
   * AsyncIterable<ChatCompletionChunk> in an RxJS Observable for NestJS @Sse().
   *
   * The Observable runs an async `run()` function internally. Errors caught
   * by run() are emitted as { type: 'error' } events, then subscriber.complete()
   * is called — NEVER subscriber.error().
   */
  streamChat(
    params: { sanitizedMessage: string; conversationId?: string },
    userCtx: UserContext,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const run = async () => {
        // --- Step 1: Resolve conversationId ---
        let conversationId = params.conversationId;
        if (!conversationId) {
          const created = await this.convRepo.create(userCtx.id);
          conversationId = created.id;
        }

        // --- Step 2: Persist user message BEFORE streaming ---
        await this.convRepo.appendMessage(conversationId, 'user', {
          content: params.sanitizedMessage,
        });

        // --- Step 3: Build initial messages array ---
        // AI-23: Inject role-specific context as a second system message.
        // The locked SYSTEM_PROMPT (AI-07) stays in messages[0].
        // Role context message is messages[1] — no user input interpolated.
        const roleContext = buildRoleContextMessage(userCtx.role as Role);
        const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: roleContext },
          { role: 'user', content: params.sanitizedMessage },
        ];

        // AI-23: Filter OpenAI tool definitions to only those allowed for this role.
        // The LLM never sees tool definitions the user's role cannot invoke.
        const toolsForRole = getToolDefinitionsForRole(userCtx.role as Role);

        let iterations = 0;
        let assistantTextForPersistence = '';

        // --- Multi-turn tool loop (capped at MAX_TOOL_ITERATIONS=5) ---
        while (iterations < MAX_TOOL_ITERATIONS) {
          const stream = await this.client.chat.completions.create({
            model: this.model,
            stream: true,
            messages: allMessages,
            tools: toolsForRole.length > 0 ? toolsForRole : undefined,
            stream_options: { include_usage: true },
          });

          // Accumulator for streaming tool_calls fragments
          // CRITICAL: DO NOT call JSON.parse on argumentsJson fragments here
          const pendingToolCalls: PendingToolCall[] = [];
          let finishReason: string | null = null;
          let assistantText = '';

          for await (const chunk of stream as AsyncIterable<any>) {
            const choice = chunk.choices?.[0];
            if (!choice) continue; // usage-only final chunk when include_usage:true

            const delta = choice.delta ?? {};

            // Stream text content tokens
            if (delta.content) {
              assistantText += delta.content;
              subscriber.next({
                data: JSON.stringify({ type: 'content_delta', text: delta.content }),
              });
            }

            // CRITICAL: accumulate fragments — MUST NOT JSON.parse here
            if (delta.tool_calls) {
              // Emit tool_call_start when we first see a named tool call
              for (const tcDelta of delta.tool_calls) {
                const existing = pendingToolCalls[tcDelta.index];
                if (!existing && tcDelta.function?.name) {
                  subscriber.next({
                    data: JSON.stringify({
                      type: 'tool_call_start',
                      toolName: tcDelta.function.name,
                      toolCallId: tcDelta.id ?? '',
                    }),
                  });
                }
              }
              accumulateToolCallDeltas(pendingToolCalls, delta.tool_calls);
            }

            // Track finish_reason — may appear on last chunk with actual content
            if (choice.finish_reason) {
              finishReason = choice.finish_reason;
            }
          }

          // --- Decide next action based on finish_reason ---

          if (finishReason === 'tool_calls') {
            // Push assistant message with accumulated tool_calls into message history
            const assistantMsg: OpenAI.Chat.ChatCompletionMessageParam = {
              role: 'assistant',
              content: assistantText || null,
              tool_calls: pendingToolCalls
                .filter(Boolean) // remove sparse slots
                .map((tc) => ({
                  id: tc.id,
                  type: 'function' as const,
                  function: { name: tc.name, arguments: tc.argumentsJson },
                })),
            };
            allMessages.push(assistantMsg);

            // Persist assistant message with tool_calls metadata
            await this.convRepo.appendMessage(conversationId, 'assistant', {
              content: assistantText || null,
              tool_calls: pendingToolCalls
                .filter(Boolean)
                .map((tc) => ({ id: tc.id, name: tc.name, arguments: tc.argumentsJson })),
            });

            // Execute each tool call, push results back
            for (const tc of pendingToolCalls.filter(Boolean)) {
              let parsedInput: unknown = {};
              try {
                parsedInput = JSON.parse(tc.argumentsJson); // ONLY parsed here — after full accumulation
              } catch {
                parsedInput = {}; // Invalid JSON from model — treat as empty input
              }

              try {
                const result = await this.toolExecutor.executeOne(
                  tc.name,
                  parsedInput,
                  userCtx,
                  conversationId,
                );

                subscriber.next({
                  data: JSON.stringify({
                    type: 'tool_result',
                    toolName: tc.name,
                    toolCallId: tc.id,
                    result: result.sanitizedOutput,
                  }),
                });

                // CRITICAL: tool_call_id MUST be echoed — omitting it returns OpenAI 400 (Pitfall #2)
                allMessages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify(result.sanitizedOutput),
                });

                await this.convRepo.appendMessage(conversationId, 'tool', {
                  tool_call_id: tc.id,
                  content: result.sanitizedOutput,
                });
              } catch (toolErr) {
                const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
                subscriber.next({
                  data: JSON.stringify({
                    type: 'tool_result',
                    toolName: tc.name,
                    toolCallId: tc.id,
                    error: errMsg,
                  }),
                });

                // Still push a tool result message to maintain valid message history
                // CRITICAL: tool_call_id still required even on tool error
                allMessages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify({ error: errMsg }),
                });
              }
            }

            iterations++;
            continue; // Loop again with updated messages
          }

          // Terminal finish reasons: 'stop' | 'length' | 'content_filter' | null (unknown)
          // All of these exit the loop immediately — do NOT continue
          assistantTextForPersistence = assistantText;
          subscriber.next({
            data: JSON.stringify({ type: 'message_stop', finishReason }),
          });
          break;
        }

        // --- Max iterations reached without a terminal stop ---
        if (iterations >= MAX_TOOL_ITERATIONS) {
          subscriber.next({
            data: JSON.stringify({
              type: 'error',
              message: 'Se alcanzó el límite máximo de iteraciones de herramientas.',
            }),
          });
        } else {
          // Persist final assistant text message (only for terminal stop)
          if (assistantTextForPersistence) {
            await this.convRepo.appendMessage(conversationId, 'assistant', {
              content: assistantTextForPersistence,
            });
          }
        }

        // Always update lastMessageAt and auto-generate title
        await this.convRepo.touchLastMessageAt(conversationId, params.sanitizedMessage);
      };

      run()
        .then(() => subscriber.complete())
        .catch((err) => {
          // CRITICAL: NEVER call subscriber.error() — it breaks the SSE transport (Pitfall #4)
          // Instead: emit an error event, then complete normally
          const is429 =
            err != null &&
            typeof err === 'object' &&
            'status' in err &&
            (err as any).status === 429;

          const msg = is429
            ? 'Límite de uso alcanzado. Intente en un momento.'
            : 'Error de comunicación con el asistente.';

          subscriber.next({
            data: JSON.stringify({ type: 'error', message: msg }),
          });
          subscriber.complete();
        });

      // Observable cleanup — no-op for MVP
      // The async run() will exit naturally when subscriber.closed becomes true
      return () => {};
    });
  }
}
