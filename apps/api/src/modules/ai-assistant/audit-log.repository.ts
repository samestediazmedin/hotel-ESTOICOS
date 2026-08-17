import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AiToolCallLogInput {
  userId: string;
  conversationId?: string | null;
  toolName: string;
  inputJson: Record<string, unknown>;
  outputStatus: string;    // 'success' | 'error' | 'validation_error'
  errorMsg?: string | null;
  durationMs?: number | null;
  executedAt?: Date;
}

/**
 * AiToolCallLogRepository — writes one audit row per tool invocation.
 *
 * This is called from ToolExecutorService's try/finally block.
 * The write MUST succeed regardless of whether the tool itself succeeded.
 * AI-09: Every tool call writes an audit row.
 */
@Injectable()
export class AiToolCallLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * insert — writes a single audit row to ai_tool_call_logs.
   * Called from ToolExecutorService.executeOne() finally block.
   * Errors here are swallowed with a console.error to prevent audit failures
   * from masking the original tool error.
   */
  async insert(entry: AiToolCallLogInput): Promise<void> {
    try {
      await (this.prisma as any).aIToolCallLog.create({
        data: {
          userId: entry.userId,
          conversationId: entry.conversationId ?? null,
          toolName: entry.toolName,
          inputJson: entry.inputJson,
          outputStatus: entry.outputStatus,
          errorMsg: entry.errorMsg ?? null,
          durationMs: entry.durationMs ?? null,
          executedAt: entry.executedAt ?? new Date(),
        },
      });
    } catch (err) {
      // Never let audit failure cascade — the original tool error (if any) takes priority
      console.error('[AiToolCallLog] Failed to write audit row:', err);
    }
  }
}
