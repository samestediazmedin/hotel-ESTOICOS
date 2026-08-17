import { describe, it, expect, vi } from 'vitest';
import { IpThrottlerGuard } from './ip-throttler.guard';

// Minimal mock for ThrottlerGuard superclass DI dependencies
// The guard only overrides getTracker(), so we only need to test that method.
const mockStorageService = { increment: vi.fn(), get: vi.fn() };
const mockReflector = { getAllAndOverride: vi.fn().mockReturnValue([]) };

function buildGuard(): IpThrottlerGuard {
  // Call parent constructor with the minimum required args
  const guard = new IpThrottlerGuard(
    [{ name: 'concierge-ip', ttl: 3_600_000, limit: 20 }] as any,
    mockStorageService as any,
    mockReflector as any,
  );
  return guard;
}

describe('IpThrottlerGuard', () => {
  it('returns concierge-namespaced tracker for a known IP', async () => {
    const guard = buildGuard();
    const tracker = await (guard as any).getTracker({ ip: '1.2.3.4' });
    expect(tracker).toBe('concierge:1.2.3.4');
  });

  it('returns concierge:unknown when req.ip is undefined', async () => {
    const guard = buildGuard();
    const tracker = await (guard as any).getTracker({ ip: undefined });
    expect(tracker).toBe('concierge:unknown');
  });

  it('uses the concierge-ip namespace (not global ai: or other namespace)', async () => {
    const guard = buildGuard();
    const tracker = await (guard as any).getTracker({ ip: '192.168.0.1' });
    // Must start with 'concierge:' — never 'ai:' (staff throttler), never plain IP
    expect(tracker).toMatch(/^concierge:/);
    expect(tracker).not.toMatch(/^ai:/);
    expect(tracker).toBe('concierge:192.168.0.1');
  });
});
