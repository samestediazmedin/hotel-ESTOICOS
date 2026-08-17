import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * UserThrottlerGuard — per-user throttling for the AI chat SSE endpoint.
 *
 * AI-10: Throttle is keyed by JWT user id, NOT by IP address.
 * This ensures that two staff members sharing a hotel network IP
 * have independent throttle buckets.
 *
 * W5 PATTERN (from Phase 03-04):
 * This guard is applied at the @Sse('stream') METHOD level only.
 * It is NOT registered as a global APP_GUARD.
 * This prevents the throttle from accidentally blocking other staff endpoints
 * such as /api/reservations, /api/inventory, etc.
 *
 * Throttle limits are configured in ThrottlerModule.forRoot inside AiAssistantModule:
 * - 30 messages per user per hour (ttl: 3_600_000, limit: 30)
 *
 * Namespace: tracker is prefixed with 'ai:' to avoid collisions with
 * other throttler use cases (e.g., login attempt throttling).
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  /**
   * getTracker — returns the throttle key for the current request.
   *
   * JwtAuthGuard runs before this guard on the @Sse('stream') method
   * (guard order: JwtAuthGuard → UserThrottlerGuard), so req.user is
   * guaranteed to be populated in normal operation.
   *
   * Fallback to req.ip for defense-in-depth in case of misconfiguration.
   */
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const id = req.user?.id ?? req.ip ?? 'anonymous';
    return `ai:${id}`;
  }
}
