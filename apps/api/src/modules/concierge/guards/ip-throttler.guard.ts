import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * IpThrottlerGuard — per-IP throttling for the public Concierge SSE endpoint.
 *
 * CON-06: Rate limit is 20 messages per hour per IP address.
 * This prevents individual visitors from exhausting the daily OpenAI token budget
 * or performing denial-of-service attacks on the public endpoint.
 *
 * W5 PATTERN (Phase 03-04 + Phase 07-02):
 * This guard is applied at the @Sse('chat') METHOD level only.
 * It is NOT registered as a global APP_GUARD.
 * This prevents the throttle from accidentally blocking staff endpoints
 * such as /api/reservations, /api/inventory, etc.
 *
 * CRITICAL dependency: requires `app.getHttpAdapter().getInstance().set('trust proxy', 1)`
 * in apps/api/src/main.ts (Phase 08 P1 fix).
 * Without trust proxy, Express sets req.ip = '127.0.0.1' for ALL requests on Railway
 * (traffic arrives through a reverse proxy). The 20/hour limit would apply GLOBALLY
 * to all visitors combined instead of per individual IP.
 *
 * Throttle limits are configured in ThrottlerModule.forRoot inside ConciergeModule:
 * - name: 'concierge-ip'
 * - ttl: 3_600_000 (1 hour in milliseconds)
 * - limit: 20
 *
 * Namespace: tracker is prefixed with 'concierge:' to avoid collisions with
 * other throttler use cases (e.g., login throttling, AI assistant throttling).
 */
@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  /**
   * getTracker — returns the throttle key for the current request.
   *
   * Key format: 'concierge:{ip}' — namespaced to avoid cross-module collisions.
   * Falls back to 'unknown' if req.ip is undefined (should not happen with trust proxy set).
   */
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    return `concierge:${req.ip ?? 'unknown'}`;
  }
}
