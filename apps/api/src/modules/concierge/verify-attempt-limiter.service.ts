/**
 * VerifyAttemptLimiterService — per-IP attempt limiter for verify_stay_for_review.
 *
 * S03 security fix (Phase 3 audit): dedicated attempt cap on top of the global
 * IpThrottlerGuard (20 msg/hr). A guest with a known cédula could burn through
 * all 20 chat turns per hour just on verify attempts. This service enforces a
 * hard per-tool ceiling of 5 attempts per IP per hour.
 *
 * IMPLEMENTATION NOTE:
 *   In-memory Map — acceptable for a single-tenant, single-instance hotel deployment.
 *   This is documented intentionally: if the deployment ever scales to multiple
 *   instances, replace with a Redis-backed counter (same interface, different store).
 *   For a single-tenant hotel on Railway (one dyno), in-memory is the correct trade-off.
 *
 * SECURITY DESIGN:
 *   - On exceed, the caller MUST return the same GENERIC_VERIFY_ERROR as all other
 *     failure branches (no enumeration signal to the attacker).
 *   - The IP is hashed (SHA-256) before storage — the raw IP is never persisted in
 *     memory beyond the lifetime of a single request. We accept the hashed IP as the
 *     key because the same hash function is used by AuditLogRepository.hashIp().
 *   - Window is 1 hour (3,600,000 ms) — matches the IpThrottlerGuard window.
 *   - Max 5 attempts per window — targeted enough to stop brute-force without blocking
 *     a legitimate guest who misremembers their apellido a couple of times.
 */

import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 3_600_000; // 1 hour

interface AttemptRecord {
  count: number;
  resetAt: number; // Unix timestamp ms
}

@Injectable()
export class VerifyAttemptLimiterService {
  /**
   * Map key: SHA-256 hash of the raw IP string (hex).
   * Value: { count, resetAt } — reset after WINDOW_MS.
   *
   * NOTE: single-instance in-memory store. See class-level docs.
   */
  private readonly store = new Map<string, AttemptRecord>();

  /**
   * Hashes the raw IP so the raw value is never retained in memory.
   * Matches the approach used by AuditLogRepository.hashIp().
   */
  private hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex');
  }

  /**
   * isExceeded — checks whether this IP has reached the attempt limit.
   *
   * Idempotent: does NOT increment the counter. Call recordAttempt() after
   * a failed verify to increment.
   *
   * @param rawIp - Raw client IP from req.ip
   * @returns true if the IP has >= MAX_ATTEMPTS in the current window
   */
  isExceeded(rawIp: string): boolean {
    const key = this.hashIp(rawIp);
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now >= record.resetAt) {
      // No record or window expired — not exceeded
      return false;
    }

    return record.count >= MAX_ATTEMPTS;
  }

  /**
   * recordAttempt — increments the counter for this IP.
   *
   * Call this after every verify_stay_for_review attempt (success or failure).
   * Starting a new window resets the counter to 1.
   *
   * @param rawIp - Raw client IP from req.ip
   */
  recordAttempt(rawIp: string): void {
    const key = this.hashIp(rawIp);
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now >= record.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      record.count += 1;
    }
  }
}
