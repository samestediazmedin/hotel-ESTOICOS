/**
 * token-budget.service.ts — Daily token spend circuit breaker for the Concierge chatbot.
 *
 * CON-07: if daily token spend >= CONCIERGE_DAILY_TOKEN_LIMIT, reject new requests
 * immediately without calling the OpenAI API.
 *
 * CRITICAL — atomic update invariant:
 * incrementUsage() MUST use a single atomic Prisma upsert + { increment } operation.
 * NEVER read the current row value then compute a new total — that creates a TOCTOU
 * race condition where concurrent requests would each see a stale value, compute
 * overlapping updates, and undercount the actual token spend.
 *
 * Correct (atomic):
 *   upsert({ update: { totalTokensUsed: { increment: BigInt(total) } } })
 *
 * Wrong (race condition):
 *   const row = await findUnique(...)
 *   await update({ totalTokensUsed: row.totalTokensUsed + BigInt(total) })
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TokenBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Daily token limit from env. Defaults to 1_000_000 tokens (~$0.30-0.60/day at gpt-4o-mini). */
  private get dailyLimit(): number {
    return Number(this.config.get<string>('CONCIERGE_DAILY_TOKEN_LIMIT', '1000000'));
  }

  /**
   * todayUtc — return today's date at UTC midnight.
   *
   * The concierge_token_usage_daily table uses a DATE PK, so all rows for a given
   * UTC calendar day share the same primary key. A new day = a new row (auto-reset).
   */
  private todayUtc(): Date {
    const t = new Date();
    t.setUTCHours(0, 0, 0, 0);
    return t;
  }

  /**
   * isOverBudget — check if today's token spend has reached the daily limit.
   *
   * Returns false when no row exists (no requests today yet).
   * Returns true when totalTokensUsed >= dailyLimit (exact equality counts as over).
   *
   * Safe to call before every concierge request — reads only (no write).
   */
  async isOverBudget(): Promise<boolean> {
    const row = await this.prisma.conciergeTokenUsageDaily.findUnique({
      where: { date: this.todayUtc() },
    });
    if (!row) return false;
    // Number(BigInt) is safe for values up to 2^53 — token counts never approach that
    return Number(row.totalTokensUsed) >= this.dailyLimit;
  }

  /**
   * incrementUsage — atomically record token spend after a successful LLM call.
   *
   * Uses Prisma's upsert + { increment } to avoid read-modify-write races.
   * If no row exists for today, creates one with totalTokensUsed = total.
   * If a row exists, atomically adds total to the running count.
   *
   * @param promptTokens - Tokens in the user message + system prompt
   * @param completionTokens - Tokens in the assistant response
   */
  async incrementUsage(promptTokens: number, completionTokens: number): Promise<void> {
    const total = promptTokens + completionTokens;
    if (total <= 0) return; // no-op for zero-token calls

    const today = this.todayUtc();
    await this.prisma.conciergeTokenUsageDaily.upsert({
      where: { date: today },
      create: {
        date: today,
        totalTokensUsed: BigInt(total),
        totalRequestCount: 1,
      },
      update: {
        totalTokensUsed: { increment: BigInt(total) },
        totalRequestCount: { increment: 1 },
      },
    });
  }
}
