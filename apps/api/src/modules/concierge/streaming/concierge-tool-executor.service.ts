import { Injectable } from '@nestjs/common';
import {
  CONCIERGE_TOOL_REGISTRY,
} from '../concierge-tool-registry';
import { ConciergeRepository } from '../concierge.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { FoursquareClient } from '../clients/foursquare.client';
import { PricingService } from '../../pricing/pricing.service';
import { ConciergeReviewService } from '../concierge-review.service';
import { VerifyAttemptLimiterService } from '../verify-attempt-limiter.service';

/**
 * ConciergeToolExecutorService — dispatches tool calls from the LLM response.
 *
 * Responsibilities:
 * 1. Validate toolName against CONCIERGE_TOOL_REGISTRY.
 * 2. Parse argsJson safely (JSON.parse in try/catch).
 * 3. Validate parsed args against the tool's Zod v4 schema (.issues, not .errors).
 * 4. Call the tool handler with validated args and the shared deps bag.
 * 5. Catch ANY handler exception and return a structured error — NEVER rethrow.
 *
 * The SSE streaming loop calls executeOne() per tool_call in the LLM response.
 * If this method throws, it breaks the Observable subscriber. It MUST NOT throw.
 *
 * Audit log writes are NOT done here — they are done by ConciergeService.streamChat()
 * in the try/finally block, one row per user turn (not per tool call).
 *
 * NOTE: ConciergeRepository, PrismaService, FoursquareClient, PricingService,
 * ConciergeReviewService, and VerifyAttemptLimiterService are imported as VALUES
 * (not `import type`) — NestJS DI relies on emitDecoratorMetadata to read constructor
 * parameter types at runtime. `import type` erases the reference at compile time, which
 * causes NestJS to see the parameter as `Function` (placeholder) and throw
 * UnknownDependenciesException at bootstrap.
 *
 * Phase 22: PrismaService injected to support the 3 hotel-knowledge tools.
 * 2026-05-25: FoursquareClient injected to support search_venues + get_venue_detail.
 * 2026-06-03 (Phase 2 concierge): PricingService injected to support check_availability.
 * 2026-06-03 (Phase 3 concierge): ConciergeReviewService injected for review tools.
 * 2026-06-03 (S03 security fix): VerifyAttemptLimiterService injected; client IP
 *   is now threaded through executeOne() and checked for verify_stay_for_review.
 */
@Injectable()
export class ConciergeToolExecutorService {
  constructor(
    private readonly repo: ConciergeRepository,
    private readonly prisma: PrismaService,
    private readonly foursquare: FoursquareClient,
    private readonly pricingService: PricingService,
    private readonly conciergeReview: ConciergeReviewService,
    private readonly verifyLimiter: VerifyAttemptLimiterService,
  ) {}

  /**
   * executeOne — execute a single tool call from the LLM.
   *
   * Returns a structured result on success, or a structured error object.
   * NEVER throws — all exceptions are caught and returned as { error: ... }.
   *
   * @param toolName - Tool name from the LLM response (e.g. 'search_venues')
   * @param argsJson - Raw JSON string of the tool call arguments (accumulated fragments)
   * @param clientIp - Raw client IP from req.ip (S03: required for per-tool rate limiting)
   * @returns Tool result or { error, ... } — always resolves, never rejects
   */
  async executeOne(toolName: string, argsJson: string, clientIp = '0.0.0.0'): Promise<unknown> {
    // Step 1: validate tool name
    const tool = CONCIERGE_TOOL_REGISTRY[toolName as keyof typeof CONCIERGE_TOOL_REGISTRY];
    if (!tool) {
      return { error: 'unknown_tool', toolName };
    }

    // S03: Per-tool attempt limit for verify_stay_for_review.
    // 5 attempts per IP per hour — checked BEFORE parsing args so the check
    // is consistent regardless of what args the LLM sends.
    // On exceed, return GENERIC_VERIFY_ERROR — identical to service-layer failures
    // so no enumeration signal is produced.
    if (toolName === 'verify_stay_for_review') {
      if (this.verifyLimiter.isExceeded(clientIp)) {
        return {
          error: 'verification_failed',
          message:
            'No encontramos una estadía verificada con esos datos. ' +
            'Verificá el número de documento y el apellido e intentá de nuevo.',
        };
      }
      // Record the attempt before executing — counts even if args are invalid
      this.verifyLimiter.recordAttempt(clientIp);
    }

    // Step 2: parse JSON safely
    let rawArgs: unknown;
    try {
      rawArgs = JSON.parse(argsJson);
    } catch {
      return { error: 'invalid_args', reason: 'malformed_json' };
    }

    // Step 3: validate via Zod v4 schema (.issues, not .errors — per team convention)
    const parsed = tool.schema.safeParse(rawArgs);
    if (!parsed.success) {
      return { error: 'invalid_args', issues: parsed.error.issues };
    }

    // Step 4: execute handler — catch ANY exception to preserve SSE stream integrity
    try {
      return await tool.handler(parsed.data, {
        repo: this.repo,
        prisma: this.prisma,
        foursquare: this.foursquare,
        pricingService: this.pricingService,
        conciergeReview: this.conciergeReview,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: 'handler_failure', message };
    }
  }
}
