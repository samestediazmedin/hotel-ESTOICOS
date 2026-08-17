/**
 * token-budget.service.spec.ts — TDD RED: failing tests for TokenBudgetService.
 *
 * Critical invariant: incrementUsage() MUST use atomic upsert+increment.
 * NEVER read+modify+write — race condition would cause token count to be wrong
 * under concurrent requests.
 *
 * CON-07: token budget circuit breaker.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TokenBudgetService } from './token-budget.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TokenBudgetService', () => {
  let svc: TokenBudgetService;
  let upsertMock: ReturnType<typeof vi.fn>;
  let findUniqueMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    upsertMock = vi.fn().mockResolvedValue(undefined);
    findUniqueMock = vi.fn();

    const prismaMock = {
      conciergeTokenUsageDaily: {
        upsert: upsertMock,
        findUnique: findUniqueMock,
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenBudgetService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: { get: (_key: string, def?: string) => def ?? '1000000' },
        },
      ],
    }).compile();

    svc = moduleRef.get(TokenBudgetService);
  });

  // Test 1: isOverBudget returns false when no row exists for today
  it('isOverBudget returns false when no row exists for today', async () => {
    findUniqueMock.mockResolvedValue(null);
    expect(await svc.isOverBudget()).toBe(false);
  });

  // Test 2: isOverBudget returns false when usage is below limit
  it('isOverBudget returns false when totalTokensUsed < daily limit', async () => {
    findUniqueMock.mockResolvedValue({ totalTokensUsed: BigInt(999_999) });
    expect(await svc.isOverBudget()).toBe(false);
  });

  // Test 3: isOverBudget returns true when usage equals or exceeds limit
  it('isOverBudget returns true when totalTokensUsed >= daily limit', async () => {
    findUniqueMock.mockResolvedValue({ totalTokensUsed: BigInt(1_000_000) });
    expect(await svc.isOverBudget()).toBe(true);
  });

  // Test 4: incrementUsage calls upsert once with correct increment payload
  it('incrementUsage calls upsert once with correct increment values', async () => {
    await svc.incrementUsage(100, 200);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const call = upsertMock.mock.calls[0][0];
    // update.totalTokensUsed must use { increment: 300n } (atomic)
    expect(call.update.totalTokensUsed).toEqual({ increment: BigInt(300) });
    expect(call.update.totalRequestCount).toEqual({ increment: 1 });
    // create must have initial values
    expect(call.create.totalTokensUsed).toEqual(BigInt(300));
    expect(call.create.totalRequestCount).toBe(1);
  });

  // Test 5 (CRITICAL — race avoidance): two parallel calls produce 2 separate upserts,
  // each with the correct increment. This proves NO read-modify-write code path exists.
  it('two parallel incrementUsage(500,0) calls produce 2 independent upserts', async () => {
    await Promise.all([svc.incrementUsage(500, 0), svc.incrementUsage(500, 0)]);
    expect(upsertMock).toHaveBeenCalledTimes(2);
    // Both calls must use { increment: 500n } — not a cumulative read-then-write
    for (const call of upsertMock.mock.calls) {
      expect(call[0].update.totalTokensUsed).toEqual({ increment: BigInt(500) });
    }
  });

  // Test 6: incrementUsage(0, 0) is a no-op — does not call upsert
  it('incrementUsage(0, 0) does not call upsert', async () => {
    await svc.incrementUsage(0, 0);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
