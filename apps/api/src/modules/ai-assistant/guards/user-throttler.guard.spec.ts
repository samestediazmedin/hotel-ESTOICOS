import { describe, it, expect } from 'vitest';
import { UserThrottlerGuard } from './user-throttler.guard';

/**
 * UserThrottlerGuard unit tests.
 *
 * These tests verify per-user tracker behavior in isolation.
 * We instantiate the guard with empty stubs for the 3 constructor params
 * that ThrottlerGuard requires (options, storage, reflector).
 *
 * The critical invariant: tracker is keyed by JWT user id, NOT by IP.
 * This ensures two staff members at the same IP have separate throttle buckets.
 */
describe('UserThrottlerGuard', () => {
  function makeGuard(): UserThrottlerGuard {
    // ThrottlerGuard constructor receives: options, storage, reflector
    // We pass empty stubs — only getTracker is under test
    return new UserThrottlerGuard({} as any, {} as any, {} as any);
  }

  /**
   * Test 1: Returns 'ai:<userId>' when req.user.id is present.
   * Primary case — JwtAuthGuard has already populated req.user.
   */
  it('returns ai:<userId> when req.user.id is present', async () => {
    const guard = makeGuard();
    const tracker = await (guard as any).getTracker({
      user: { id: 'user-123', email: 'staff@hotel.com', role: 'RECEPTION' },
      ip: '127.0.0.1',
    });
    expect(tracker).toBe('ai:user-123');
  });

  /**
   * Test 2: Falls back to 'ai:<ip>' when req.user is undefined.
   * Defense-in-depth: guard applied before JwtAuthGuard (misconfiguration protection).
   * In practice, JwtAuthGuard always runs first on @Sse() method.
   */
  it('falls back to ai:<ip> when req.user is undefined', async () => {
    const guard = makeGuard();
    const tracker = await (guard as any).getTracker({
      user: undefined,
      ip: '192.168.1.50',
    });
    expect(tracker).toBe('ai:192.168.1.50');
  });

  /**
   * Test 3: Two different users at the same IP produce DIFFERENT tracker strings.
   * CRITICAL — proves throttle is per-user, not per-IP.
   * Admin and reception at the same hotel network are independent.
   */
  it('returns DIFFERENT trackers for two users at the same IP', async () => {
    const guard = makeGuard();

    const tracker1 = await (guard as any).getTracker({
      user: { id: 'user-admin' },
      ip: '10.0.0.1',
    });

    const tracker2 = await (guard as any).getTracker({
      user: { id: 'user-reception' },
      ip: '10.0.0.1',
    });

    // Same IP, different users — different trackers
    expect(tracker1).not.toBe(tracker2);
    expect(tracker1).toBe('ai:user-admin');
    expect(tracker2).toBe('ai:user-reception');
  });

  /**
   * Test 4: Tracker is prefixed with 'ai:' for namespace isolation.
   * Other throttler use cases (e.g., login attempts) must not collide
   * with AI chat throttle buckets even if they use the same userId.
   */
  it("prefixes tracker with 'ai:' for namespace isolation", async () => {
    const guard = makeGuard();
    const tracker = await (guard as any).getTracker({
      user: { id: 'any-user' },
      ip: '1.2.3.4',
    });
    expect(tracker).toMatch(/^ai:/);
  });
});
