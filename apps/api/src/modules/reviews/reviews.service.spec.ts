import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnauthorizedException, GoneException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

const RESERVATION_ID = 'res-test-001';
const GUEST_NAME = 'Ana García';
const STAY_DATE = '2026-05-10';
const JTI = 'cmte8456cee7fd2348cfa2393';

function buildMockPrisma() {
  const mockReview = {
    id: 'rev-001',
    guestName: GUEST_NAME,
    rating: 4,
    comment: 'Excelente estadía en el hotel.',
    stayDate: new Date(STAY_DATE),
    reservationId: RESERVATION_ID,
    moderated: false,
    publishedAt: null,
    rejectedAt: null,
    createdAt: new Date('2026-05-18T00:00:00Z'),
    reservation: null,
  };

  const mockReservation = {
    id: RESERVATION_ID,
    reviewTokenJtiUsed: null as string | null,
  };

  const prisma: any = {
    reservation: {
      findUnique: vi.fn().mockResolvedValue(mockReservation),
      update: vi.fn().mockResolvedValue({ ...mockReservation }),
    },
    review: {
      create: vi.fn().mockResolvedValue(mockReview),
      findMany: vi.fn().mockResolvedValue([mockReview]),
      count: vi.fn().mockResolvedValue(1),
      aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 4.0 } }),
      findUnique: vi.fn().mockResolvedValue(mockReview),
      update: vi.fn().mockResolvedValue(mockReview),
    },
    $transaction: vi.fn(),
  };

  // Default $transaction: execute callback with the mock prisma client
  prisma.$transaction.mockImplementation(async (cbOrArray: any) => {
    if (typeof cbOrArray === 'function') {
      return cbOrArray(prisma);
    }
    // Array of promises (parallel transaction)
    return Promise.all(cbOrArray);
  });

  return { prisma, mockReview, mockReservation };
}

function buildMockJwt(valid = true, payload: Record<string, any> = {}) {
  const defaultPayload = {
    reservationId: RESERVATION_ID,
    guestName: GUEST_NAME,
    stayDate: STAY_DATE,
    jti: JTI,
    ...payload,
  };

  return {
    sign: vi.fn().mockReturnValue('signed.jwt.token'),
    verifyAsync: valid
      ? vi.fn().mockResolvedValue(defaultPayload)
      : vi.fn().mockRejectedValue(new Error('invalid signature')),
  };
}

function buildMockEmailService() {
  return {
    sendReviewInvite: vi.fn().mockResolvedValue(undefined),
  };
}

function buildMockSystemConfig(hotelName = 'Hotel Sumapaz') {
  return {
    getHotelName: vi.fn().mockResolvedValue(hotelName),
  };
}

function buildService(
  prismaOverride?: any,
  jwtOverride?: any,
  emailServiceOverride?: any,
  systemConfigOverride?: any,
): ReviewsService {
  const { prisma } = prismaOverride ?? buildMockPrisma();
  const jwt = jwtOverride ?? buildMockJwt();
  const emailService = emailServiceOverride ?? buildMockEmailService();
  const systemConfig = systemConfigOverride ?? buildMockSystemConfig();
  return new ReviewsService(prisma, jwt as any, emailService as any, systemConfig as any);
}

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

describe('ReviewsService', () => {
  let savedReviewTokenSecret: string | undefined;
  let savedJwtAccessSecret: string | undefined;

  beforeEach(() => {
    savedReviewTokenSecret = process.env.REVIEW_TOKEN_SECRET;
    savedJwtAccessSecret = process.env.JWT_ACCESS_SECRET;
    // Ensure at least one secret is set so constructor doesn't throw
    process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret';
  });

  afterEach(() => {
    // Restore original env
    if (savedReviewTokenSecret === undefined) delete process.env.REVIEW_TOKEN_SECRET;
    else process.env.REVIEW_TOKEN_SECRET = savedReviewTokenSecret;
    if (savedJwtAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = savedJwtAccessSecret;
  });

  // ── SEC-003: constructor throws if no secret configured ─────────────────

  it('SEC-003: constructor throws if REVIEW_TOKEN_SECRET and JWT_ACCESS_SECRET are both unset', () => {
    delete process.env.REVIEW_TOKEN_SECRET;
    delete process.env.JWT_ACCESS_SECRET;

    const { prisma } = buildMockPrisma();
    const jwt = buildMockJwt();

    expect(() => {
      new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);
    }).toThrow('REVIEW_TOKEN_SECRET (or JWT_ACCESS_SECRET as fallback) must be set');
  });

  it('SEC-003: constructor throws if both secrets are empty strings', () => {
    process.env.REVIEW_TOKEN_SECRET = '';
    process.env.JWT_ACCESS_SECRET = '';

    const { prisma } = buildMockPrisma();
    const jwt = buildMockJwt();

    expect(() => {
      new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);
    }).toThrow('REVIEW_TOKEN_SECRET (or JWT_ACCESS_SECRET as fallback) must be set');
  });

  it('SEC-003: constructor succeeds when only JWT_ACCESS_SECRET is set', () => {
    delete process.env.REVIEW_TOKEN_SECRET;
    process.env.JWT_ACCESS_SECRET = 'some-access-secret';

    const { prisma } = buildMockPrisma();
    const jwt = buildMockJwt();

    expect(() => {
      new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);
    }).not.toThrow();
  });

  it('SEC-003: constructor prefers REVIEW_TOKEN_SECRET over JWT_ACCESS_SECRET', () => {
    process.env.REVIEW_TOKEN_SECRET = 'review-specific';
    process.env.JWT_ACCESS_SECRET = 'generic-access';

    const { prisma } = buildMockPrisma();
    const jwt = buildMockJwt();
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    // Sign a token to verify which secret is used
    service.signReviewToken({
      reservationId: RESERVATION_ID,
      guestName: GUEST_NAME,
      stayDate: new Date(STAY_DATE),
    });

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ secret: 'review-specific' }),
    );
  });

  // ── Test 1: signReviewToken returns verifiable JWT ───────────────────────

  it('Test 1: signReviewToken returns JWT and jti', () => {
    const { prisma } = buildMockPrisma();
    const jwt = buildMockJwt();
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    const result = service.signReviewToken({
      reservationId: RESERVATION_ID,
      guestName: GUEST_NAME,
      stayDate: new Date(STAY_DATE),
    });

    expect(result.token).toBe('signed.jwt.token');
    expect(result.jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: RESERVATION_ID,
        guestName: GUEST_NAME,
        stayDate: STAY_DATE,
      }),
      expect.objectContaining({ expiresIn: '90d' }),
    );
  });

  // ── Test 2: validateToken(invalidJwt) throws UnauthorizedException ───────

  it('Test 2: validateToken with invalid JWT throws UnauthorizedException', async () => {
    const { prisma } = buildMockPrisma();
    const jwt = buildMockJwt(false); // verifyAsync rejects
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    await expect(service.validateToken('bad.token.here')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // ── Test 3: validateToken(expiredJwt) throws UnauthorizedException ────────

  it('Test 3: validateToken with expired token throws UnauthorizedException', async () => {
    const { prisma } = buildMockPrisma();
    const jwt = {
      sign: vi.fn(),
      verifyAsync: vi.fn().mockRejectedValue(new Error('jwt expired')),
    };
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    await expect(service.validateToken('expired.token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // ── Test 4: submitReview creates Review + sets reviewTokenJtiUsed ─────────

  it('Test 4: submitReview creates Review row and sets reviewTokenJtiUsed', async () => {
    const { prisma, mockReview } = buildMockPrisma();
    const jwt = buildMockJwt();
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    const result = await service.submitReview({
      token: 'valid.token',
      rating: 3,
      comment: 'ok ok ok ok ok ok ok ok ok ok',
    });

    expect(result.id).toBe(mockReview.id);
    expect(result.createdAt).toEqual(mockReview.createdAt);
    // Should have attempted to update reservation JTI
    expect(prisma.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RESERVATION_ID },
        data: { reviewTokenJtiUsed: JTI },
      }),
    );
    // Should have created the review
    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          guestName: GUEST_NAME,
          rating: 3,
        }),
      }),
    );
  });

  // ── Test 5: submitReview with re-used jti throws GoneException ────────────

  it('Test 5: submitReview with re-used JTI throws GoneException (P2002)', async () => {
    const { prisma } = buildMockPrisma();
    const jwt = buildMockJwt();
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    // Make $transaction throw a Prisma P2002 error
    const p2002Error = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
    });
    prisma.$transaction.mockRejectedValueOnce(p2002Error);

    await expect(
      service.submitReview({ token: 'valid.token', rating: 4, comment: 'Muy buen hotel' }),
    ).rejects.toThrow(GoneException);
  });

  // ── Test 6: getPublicReviews returns paginated result with averageRating ──

  it('Test 6: getPublicReviews returns {reviews, total, averageRating, pages}', async () => {
    const { prisma, mockReview } = buildMockPrisma();

    // Override $transaction for array pattern (not callback)
    prisma.$transaction.mockImplementation(async (arr: any[]) => Promise.all(arr));
    prisma.review.findMany.mockResolvedValue([mockReview]);
    prisma.review.count.mockResolvedValue(1);
    prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.0 } });

    const jwt = buildMockJwt();
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    const result = await service.getPublicReviews({ page: 1, limit: 10 });

    expect(result.reviews).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.averageRating).toBe(4);
    expect(result.pages).toBe(1);
  });

  it('Test 6b: averageRating reflects ALL published, not just current page', async () => {
    const { prisma } = buildMockPrisma();

    // Simulate 3 total reviews with avg 4.5, but only 1 on page 2
    const mockSingleReview = {
      id: 'rev-003',
      guestName: 'Carlos',
      rating: 5,
      comment: 'Excelente',
      stayDate: new Date(),
      publishedAt: new Date(),
      createdAt: new Date(),
    };

    prisma.$transaction.mockImplementation(async (arr: any[]) => Promise.all(arr));
    prisma.review.findMany.mockResolvedValue([mockSingleReview]);
    prisma.review.count.mockResolvedValue(3); // total = 3
    prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 } }); // avg of ALL 3

    const jwt = buildMockJwt();
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    const result = await service.getPublicReviews({ page: 2, limit: 2 });

    // averageRating should reflect ALL 3 reviews (4.5), not just the 1 on page 2
    expect(result.reviews).toHaveLength(1);
    expect(result.total).toBe(3);
    expect(result.averageRating).toBe(4.5);
    expect(result.pages).toBe(2);
  });

  // ── Test 7: moderateReview('approve') sets moderated+publishedAt ──────────

  it('Test 7: moderateReview approve sets moderated=true and publishedAt', async () => {
    const { prisma, mockReview } = buildMockPrisma();
    const approvedReview = {
      ...mockReview,
      moderated: true,
      publishedAt: new Date(),
      rejectedAt: null,
    };
    prisma.review.update.mockResolvedValueOnce(approvedReview);

    const jwt = buildMockJwt();
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    const result = await service.moderateReview('rev-001', 'approve');

    expect(prisma.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rev-001' },
        data: expect.objectContaining({
          moderated: true,
          rejectedAt: null,
        }),
      }),
    );
    expect(result.moderated).toBe(true);
    expect(result.publishedAt).toBeTruthy();
  });

  // ── Test 8: moderateReview('reject') sets rejectedAt ─────────────────────

  it('Test 8: moderateReview reject sets rejectedAt (moderated stays false)', async () => {
    const { prisma, mockReview } = buildMockPrisma();
    const rejectedReview = {
      ...mockReview,
      moderated: false,
      publishedAt: null,
      rejectedAt: new Date(),
    };
    prisma.review.update.mockResolvedValueOnce(rejectedReview);

    const jwt = buildMockJwt();
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    const result = await service.moderateReview('rev-001', 'reject');

    expect(prisma.review.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rev-001' },
        data: expect.objectContaining({
          moderated: false,
          publishedAt: null,
        }),
      }),
    );
    expect(result.rejectedAt).toBeTruthy();
  });

  // ── Test 9: getAdminReviews returns 3 groups ──────────────────────────────

  it('Test 9: getAdminReviews returns pending + published + rejected groups', async () => {
    const { prisma } = buildMockPrisma();

    const pendingReview = { id: 'rev-p', moderated: false, rejectedAt: null };
    const publishedReview = { id: 'rev-pub', moderated: true, rejectedAt: null };
    const rejectedReview = { id: 'rev-rej', moderated: false, rejectedAt: new Date() };

    // findMany called 3 times sequentially via Promise.all
    prisma.review.findMany
      .mockResolvedValueOnce([pendingReview])    // pending
      .mockResolvedValueOnce([publishedReview])  // published
      .mockResolvedValueOnce([rejectedReview]);  // rejected

    const jwt = buildMockJwt();
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    const result = await service.getAdminReviews();

    expect(result.pending).toEqual([pendingReview]);
    expect(result.published).toEqual([publishedReview]);
    expect(result.rejected).toEqual([rejectedReview]);
  });

  // ── Test 10: submitReview with invalid token throws UnauthorizedException ─

  it('Test 10: submitReview with invalid token throws UnauthorizedException', async () => {
    const { prisma } = buildMockPrisma();
    const jwt = buildMockJwt(false); // verifyAsync rejects
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    await expect(
      service.submitReview({ token: 'invalid.token', rating: 4, comment: 'test comment here' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ── S01: Cross-flow JWT replay guards ─────────────────────────────────────

  it('S01: submitReview rejects tokens with purpose="concierge-review" (cross-flow replay)', async () => {
    const { prisma } = buildMockPrisma();
    // JWT verifies fine but carries purpose='concierge-review' from the cédula flow
    const jwt = buildMockJwt(true, { purpose: 'concierge-review', jti: JTI });
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    await expect(
      service.submitReview({ token: 'concierge.token', rating: 4, comment: 'replay attempt' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('S01: submitReview rejects tokens missing jti (null jti bypasses P2002 uniqueness guard)', async () => {
    const { prisma } = buildMockPrisma();
    // JWT verifies fine but has no jti — would bypass reviewTokenJtiUsed unique constraint
    const { jti: _removed, ...payloadWithoutJti } = {
      reservationId: RESERVATION_ID,
      guestName: GUEST_NAME,
      stayDate: STAY_DATE,
      jti: JTI,
    };
    const jwt = {
      sign: vi.fn().mockReturnValue('signed.jwt.token'),
      verifyAsync: vi.fn().mockResolvedValue(payloadWithoutJti),
    };
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    await expect(
      service.submitReview({ token: 'no-jti.token', rating: 4, comment: 'missing jti' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('S01: submitReview accepts a valid email-flow token (no purpose claim, has jti)', async () => {
    const { prisma, mockReview } = buildMockPrisma();
    // Standard email-invite token: no purpose claim, has jti
    const jwt = buildMockJwt(true); // default payload has jti, no purpose
    const service = new ReviewsService(prisma, jwt as any, buildMockEmailService() as any, buildMockSystemConfig() as any);

    const result = await service.submitReview({
      token: 'valid.email.token',
      rating: 4,
      comment: 'Excelente estadía en el hotel.',
    });

    expect(result.id).toBe(mockReview.id);
  });
});

// ─── sendPendingReviewInvites tests ────────────────────────────────────────────

describe('ReviewsService.sendPendingReviewInvites', () => {
  let savedReviewTokenSecret: string | undefined;
  let savedJwtAccessSecret: string | undefined;

  beforeEach(() => {
    savedReviewTokenSecret = process.env.REVIEW_TOKEN_SECRET;
    savedJwtAccessSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret';
  });

  afterEach(() => {
    if (savedReviewTokenSecret === undefined) delete process.env.REVIEW_TOKEN_SECRET;
    else process.env.REVIEW_TOKEN_SECRET = savedReviewTokenSecret;
    if (savedJwtAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
    else process.env.JWT_ACCESS_SECRET = savedJwtAccessSecret;
  });

  const BUSINESS_DATE = new Date('2026-05-16T00:00:00.000Z'); // today
  const YESTERDAY = new Date('2026-05-15T00:00:00.000Z');     // businessDate - 1

  function makeReservation(overrides: Record<string, any> = {}) {
    return {
      id: 'res-001',
      checkOutDate: YESTERDAY,
      guest: {
        fullName: 'Ana García',
        email: 'ana@example.com',
      },
      ...overrides,
    };
  }

  it('Test 1: queries reservations with CHECKED_OUT + checkOutDate=yesterday + reviewInviteSentAt=null + email not null', async () => {
    const { prisma } = buildMockPrisma();
    const emailService = buildMockEmailService();
    prisma.reservation.findMany = vi.fn().mockResolvedValue([]);
    prisma.reservation.update = vi.fn().mockResolvedValue({});
    const jwt = buildMockJwt();
    const service = buildService({ prisma }, jwt, emailService);

    await service.sendPendingReviewInvites(BUSINESS_DATE);

    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'CHECKED_OUT',
          reviewInviteSentAt: null,
          guest: { email: { not: null } },
        }),
      }),
    );
  });

  it('Test 2: happy path — for each reservation: token signed, email sent, reviewInviteSentAt updated', async () => {
    const { prisma } = buildMockPrisma();
    const emailService = buildMockEmailService();
    const jwt = buildMockJwt();
    const reservation = makeReservation();
    prisma.reservation.findMany = vi.fn().mockResolvedValue([reservation]);
    prisma.reservation.update = vi.fn().mockResolvedValue({});
    const service = buildService({ prisma }, jwt, emailService);

    await service.sendPendingReviewInvites(BUSINESS_DATE);

    expect(jwt.sign).toHaveBeenCalledTimes(1);
    expect(emailService.sendReviewInvite).toHaveBeenCalledTimes(1);
    expect(emailService.sendReviewInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@example.com',
        guestName: 'Ana García',
        hotelName: 'Hotel Sumapaz',
      }),
    );
    expect(prisma.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-001' },
        data: expect.objectContaining({ reviewInviteSentAt: expect.any(Date) }),
      }),
    );
  });

  it('Test 3: reviewInviteSentAt is updated AFTER emailService.sendReviewInvite resolves', async () => {
    const callOrder: string[] = [];
    const { prisma } = buildMockPrisma();
    const emailService = {
      sendReviewInvite: vi.fn().mockImplementation(async () => {
        callOrder.push('email');
      }),
    };
    prisma.reservation.findMany = vi.fn().mockResolvedValue([makeReservation()]);
    prisma.reservation.update = vi.fn().mockImplementation(async () => {
      callOrder.push('update');
      return {};
    });
    const jwt = buildMockJwt();
    const service = buildService({ prisma }, jwt, emailService);

    await service.sendPendingReviewInvites(BUSINESS_DATE);

    expect(callOrder).toEqual(['email', 'update']);
  });

  it('Test 4: when sendReviewInvite rejects, reviewInviteSentAt is NOT updated but loop continues', async () => {
    const { prisma } = buildMockPrisma();
    const emailService = {
      sendReviewInvite: vi.fn()
        .mockRejectedValueOnce(new Error('Resend failed'))
        .mockResolvedValueOnce(undefined),
    };
    const res1 = makeReservation({ id: 'res-fail', guest: { fullName: 'Carlos', email: 'carlos@example.com' } });
    const res2 = makeReservation({ id: 'res-ok',   guest: { fullName: 'Maria',  email: 'maria@example.com' } });
    prisma.reservation.findMany = vi.fn().mockResolvedValue([res1, res2]);
    prisma.reservation.update = vi.fn().mockResolvedValue({});
    const jwt = buildMockJwt();
    const service = buildService({ prisma }, jwt, emailService);

    await service.sendPendingReviewInvites(BUSINESS_DATE);

    // Second email was attempted
    expect(emailService.sendReviewInvite).toHaveBeenCalledTimes(2);
    // update was called only once (the successful reservation)
    expect(prisma.reservation.update).toHaveBeenCalledTimes(1);
    expect(prisma.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'res-ok' } }),
    );
  });

  it('Test 5: no-op when no eligible reservations found', async () => {
    const { prisma } = buildMockPrisma();
    const emailService = buildMockEmailService();
    prisma.reservation.findMany = vi.fn().mockResolvedValue([]);
    prisma.reservation.update = vi.fn().mockResolvedValue({});
    const jwt = buildMockJwt();
    const service = buildService({ prisma }, jwt, emailService);

    await service.sendPendingReviewInvites(BUSINESS_DATE);

    expect(emailService.sendReviewInvite).not.toHaveBeenCalled();
    expect(prisma.reservation.update).not.toHaveBeenCalled();
  });

  it('Test 8: review link composed as FRONTEND_BASE_URL + /review/submit?token=...', async () => {
    const originalEnv = process.env.FRONTEND_BASE_URL;
    process.env.FRONTEND_BASE_URL = 'https://hotel-frontend.up.railway.app';

    const { prisma } = buildMockPrisma();
    const emailService = buildMockEmailService();
    prisma.reservation.findMany = vi.fn().mockResolvedValue([makeReservation()]);
    prisma.reservation.update = vi.fn().mockResolvedValue({});
    const jwt = buildMockJwt();
    const service = buildService({ prisma }, jwt, emailService);

    await service.sendPendingReviewInvites(BUSINESS_DATE);

    const callArg = (emailService.sendReviewInvite as any).mock.calls[0][0];
    expect(callArg.reviewLink).toMatch(/^https:\/\/hotel-frontend\.up\.railway\.app\/review\/submit\?token=/);

    process.env.FRONTEND_BASE_URL = originalEnv;
  });
});
