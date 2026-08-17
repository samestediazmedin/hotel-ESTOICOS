/**
 * refresh-race-regression.spec.ts — QSI-15: Concurrent token refresh race regression.
 *
 * Regression test for bugfix commit 6e6fdbc (2026-05-22):
 *   "fix(auth): atomic deleteMany in rotateRefreshToken to avoid 500 on concurrent refresh"
 *
 * Scenario: 5 browser tabs fire POST /auth/refresh simultaneously with the same cookie.
 *
 * Expected behavior (after bugfix):
 *   - Exactly 1 request wins the race → 200 (new token pair)
 *   - Exactly 4 requests lose the race → 401 (token already rotated)
 *   - NEVER any 500 error (the pre-fix behavior: P2025 "Record not found" from Prisma)
 *
 * Implementation: Mock PrismaService to simulate the race condition at the deleteMany level.
 * The first call to deleteMany returns { count: 1 } (winner); subsequent calls return { count: 0 }
 * (losers — the row was already deleted by the winner).
 *
 * This test is DETERMINISTIC — no real timing, no flakes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../token.service';

describe('Refresh Race Regression — QSI-15', () => {
  const RAW_TOKEN = 'a'.repeat(128); // 64 bytes hex = 128 chars

  let service: TokenService;
  let deleteManyCallCount: number;

  // Track how many times deleteMany was called and simulate race behavior:
  // First call returns count: 1 (winner), subsequent calls return count: 0 (losers).
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    refreshToken: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  };

  const mockJwtService = {
    sign: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    deleteManyCallCount = 0;

    // Every concurrent call will find the same token row (stale read)
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-shared-001',
      userId: 'user-001',
      expiresAt: new Date(Date.now() + 60_000), // valid, not expired
    });

    // Race simulation: first deleteMany wins (count: 1), rest lose (count: 0)
    mockPrisma.refreshToken.deleteMany.mockImplementation(async () => {
      deleteManyCallCount++;
      if (deleteManyCallCount === 1) {
        return { count: 1 }; // Winner — row deleted successfully
      }
      return { count: 0 }; // Loser — row already deleted by winner
    });

    // Winner's createTokenPair path
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-001',
      role: 'ADMIN',
    });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-new-001' });
    mockJwtService.sign.mockReturnValue('new-access-token');

    service = new TokenService(mockPrisma as any, mockJwtService as any);
  });

  it('5 concurrent refreshes: exactly 1 succeeds (200), 4 fail (401), NEVER 500', async () => {
    const CONCURRENT = 5;

    // Fire 5 concurrent rotation attempts with the same raw token
    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT }, () =>
        service.rotateRefreshToken(RAW_TOKEN),
      ),
    );

    // Count outcomes
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly 1 should succeed
    expect(fulfilled).toHaveLength(1);

    // Exactly 4 should fail
    expect(rejected).toHaveLength(CONCURRENT - 1);

    // The successful one returns a valid token pair
    const winner = fulfilled[0] as PromiseFulfilledResult<any>;
    expect(winner.value).toHaveProperty('accessToken');
    expect(winner.value).toHaveProperty('rawRefreshToken');
    expect(winner.value.accessToken).toBe('new-access-token');

    // Every rejection must be UnauthorizedException (401), NEVER a raw error (500)
    for (const result of rejected) {
      const reason = (result as PromiseRejectedResult).reason;
      expect(reason).toBeInstanceOf(UnauthorizedException);
      // Verify it's NOT a Prisma error (P2025 would be a generic Error, not HttpException)
      expect(reason.constructor.name).not.toBe('PrismaClientKnownRequestError');
    }
  });

  it('no 500-class errors in any rejection', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        service.rotateRefreshToken(RAW_TOKEN),
      ),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        const reason = result.reason;
        // Must be an HttpException with status < 500
        expect(reason).toBeInstanceOf(UnauthorizedException);
        expect(reason.getStatus()).toBe(401);
      }
    }
  });

  it('deleteMany is called for every concurrent request (no short-circuit)', async () => {
    await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        service.rotateRefreshToken(RAW_TOKEN),
      ),
    );

    // findFirst is called 5 times (each concurrent request reads the same stale row)
    expect(mockPrisma.refreshToken.findFirst).toHaveBeenCalledTimes(5);

    // deleteMany is called 5 times (each request attempts atomic delete)
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledTimes(5);

    // create is called only ONCE (only the winner proceeds to createTokenPair)
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('expired token is rejected before the race even begins', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt-expired',
      userId: 'user-001',
      expiresAt: new Date(Date.now() - 60_000), // already expired
    });

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        service.rotateRefreshToken(RAW_TOKEN),
      ),
    );

    // ALL should fail with 401
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(5);

    // deleteMany should NOT have been called (early exit on expiry)
    expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();

    for (const result of rejected) {
      const reason = (result as PromiseRejectedResult).reason;
      expect(reason).toBeInstanceOf(UnauthorizedException);
    }
  });

  it('nonexistent token is rejected before the race', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        service.rotateRefreshToken(RAW_TOKEN),
      ),
    );

    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(5);

    expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
  });
});
