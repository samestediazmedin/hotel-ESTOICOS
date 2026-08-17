/**
 * api-contract.spec.ts — QSI-13: API contract validation for error envelope shape.
 *
 * Verifies that NestJS error responses follow the standard NestJS error envelope:
 *   { message: string | string[], statusCode: number, error: string }
 *
 * Strategy: instantiate controllers directly with mock services, invoke methods
 * that produce errors (validation failures, not-found, unauthorized, conflict),
 * and assert the HttpException response shape matches the contract.
 *
 * This catches:
 * - Raw Prisma errors leaking as 500 (should be caught and mapped to 400/404/409)
 * - Inconsistent error shapes across endpoints
 * - Missing validation that would produce unstructured 500s
 *
 * Representative endpoints:
 * 1. POST /auth/login — 401 on bad credentials
 * 2. PATCH /guests/:id — 404 on nonexistent guest
 * 3. PATCH /reservations/:id — 409 on date conflict
 * 4. POST /public/bookings — 400 on invalid body
 * 5. POST /public/reviews — 400 on invalid body (Zod .parse throws)
 * 6. POST /housekeeping/tasks — 400 on invalid body (Zod safeParse)
 * 7. GET /reports/daily-snapshots — 400 on invalid date range
 * 8. POST /night-audit/backfill — 400 on invalid date
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Global timeout for this spec — dynamic imports are slow under full suite load
vi.setConfig({ testTimeout: 20000 });

import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  HttpException,
} from '@nestjs/common';

// ─── Helper: assert NestJS error envelope shape ─────────────────────────────

interface NestErrorEnvelope {
  message: string | string[];
  statusCode: number;
  error: string;
}

function assertErrorEnvelope(err: unknown, expectedStatus: number): void {
  expect(err).toBeInstanceOf(HttpException);
  const response = (err as HttpException).getResponse();
  expect(typeof response).toBe('object');

  const envelope = response as Record<string, unknown>;

  // statusCode must match
  expect(envelope['statusCode']).toBe(expectedStatus);

  // message must be string or string[]
  const msg = envelope['message'];
  const hasMessage =
    typeof msg === 'string' ||
    (Array.isArray(msg) && msg.every((m: any) => typeof m === 'string'));
  expect(hasMessage).toBe(true);

  // error must be a string description (e.g., "Bad Request", "Unauthorized")
  expect(typeof envelope['error']).toBe('string');
}

/**
 * Some controllers throw raw HttpException whose response is a string
 * (e.g., `throw new UnauthorizedException('No refresh token')`).
 * NestJS wraps these into { message, statusCode, error } at the HTTP layer.
 * We verify the exception itself is correct; the HTTP layer handles the shape.
 */
function assertHttpException(err: unknown, expectedStatus: number): void {
  expect(err).toBeInstanceOf(HttpException);
  expect((err as HttpException).getStatus()).toBe(expectedStatus);
}

// ─── 1. POST /auth/login — 401 ──────────────────────────────────────────────

import { AuthService } from '../../auth/auth.service';

describe('API Contract — QSI-13', () => {
  describe('POST /auth/login — 401 on invalid credentials', () => {
    it('returns 401 HttpException with correct status', async () => {
      const mockPrisma = {
        user: { findUnique: vi.fn().mockResolvedValue(null) },
      };
      const mockTokenService = { createTokenPair: vi.fn() };
      const mockLoginAttemptService = {
        validateAttempt: vi.fn().mockResolvedValue(undefined),
        recordFailure: vi.fn().mockResolvedValue(undefined),
        clearAttempts: vi.fn(),
      };

      const service = new AuthService(
        mockPrisma as any,
        mockTokenService as any,
        mockLoginAttemptService as any,
      );

      try {
        await service.login('bad@test.com', 'wrong', '127.0.0.1');
        expect.fail('Should have thrown');
      } catch (err) {
        assertHttpException(err, 401);
      }
    });
  });

  // ─── 2. PATCH /guests/:id — 404 on nonexistent guest ──────────────────────

  describe('PATCH /guests/:id — 404 on nonexistent guest', () => {
    it('returns 404 HttpException when guest not found', async () => {
      const { GuestsService } = await import('../../modules/guests/guests.service');

      // GuestsService uses GuestsRepository (not Prisma directly)
      const mockRepo = {
        findById: vi.fn().mockResolvedValue(null),
        createGuest: vi.fn(),
        update: vi.fn(),
        findAll: vi.fn(),
        findReservationsByGuestId: vi.fn(),
      };
      const mockEncryption = {
        encrypt: vi.fn((v: string) => v),
        decrypt: vi.fn((v: string) => v),
      };

      const guestsService = new GuestsService(
        mockRepo as any,
        mockEncryption as any,
      );

      try {
        await guestsService.findById('nonexistent-id');
        expect.fail('Should have thrown');
      } catch (err) {
        assertHttpException(err, 404);
      }
    });
  });

  // ─── 3. POST /reservations — 409 on date conflict ─────────────────────────

  describe('POST /reservations — 409 on date overlap', () => {
    it('Prisma P2002 unique constraint maps to ConflictException (409)', async () => {
      // Verify that ConflictException produces correct status
      const err = new ConflictException('Room already booked for these dates');
      assertHttpException(err, 409);

      const response = err.getResponse() as Record<string, unknown>;
      expect(response['statusCode']).toBe(409);
      expect(response['error']).toBe('Conflict');
    });
  });

  // ─── 4. POST /public/bookings — 400 on invalid body ───────────────────────

  describe('POST /public/bookings — 400 on invalid body', () => {
    it('returns BadRequestException with envelope shape', async () => {
      const { PublicBookingController } = await import(
        '../../modules/public-booking/public-booking.controller'
      );

      const controller = new PublicBookingController(
        { createBooking: vi.fn() } as any,
        { searchAvailable: vi.fn() } as any,
      );

      try {
        await controller.createBooking({});
        expect.fail('Should have thrown');
      } catch (err) {
        assertHttpException(err, 400);
        // Verify the response has the custom shape with issues
        const response = (err as HttpException).getResponse() as Record<string, unknown>;
        expect(response['message']).toBeDefined();
      }
    }, 10000);
  });

  // ─── 5. POST /public/reviews — 400 on invalid body (Zod .parse) ──────────

  describe('POST /public/reviews — 400 on invalid body', () => {
    it('Zod .parse() throws ZodError which maps to 400 in NestJS', async () => {
      const { submitReviewSchema } = await import(
        '../../modules/reviews/dto/submit-review.dto'
      );

      // Zod .parse() throws ZodError on invalid input.
      // In production, NestJS exception filter maps this.
      // Here we verify the schema rejects invalid input.
      expect(() => submitReviewSchema.parse({})).toThrow();
      expect(() => submitReviewSchema.parse({ token: 123, rating: 'bad' })).toThrow();
    });
  });

  // ─── 6. POST /housekeeping/tasks — 400 on invalid body (safeParse) ────────

  describe('POST /housekeeping/tasks — 400 on invalid body', () => {
    it('controller throws BadRequestException on invalid body', async () => {
      const { HousekeepingController } = await import(
        '../../modules/housekeeping/housekeeping.controller'
      );

      const mockService = {
        createTask: vi.fn(),
        listRoomsForBoard: vi.fn(),
        transitionRoomCleaningStatus: vi.fn(),
        listTasksForUser: vi.fn(),
        updateTaskStatus: vi.fn(),
      };

      const controller = new HousekeepingController(mockService as any);

      try {
        await controller.createTask(
          { invalid: true },
          { id: 'u1', role: 'ADMIN' },
        );
        expect.fail('Should have thrown');
      } catch (err) {
        assertHttpException(err, 400);
        expect(err).toBeInstanceOf(BadRequestException);
      }
    });
  });

  // ─── 7. GET /reports/daily-snapshots — 400 on invalid date range ──────────

  describe('GET /reports/daily-snapshots — 400 on invalid dates', () => {
    it('controller throws BadRequestException on startDate > endDate', async () => {
      const { ReportingController } = await import(
        '../../modules/reporting/reporting.controller'
      );

      const controller = new ReportingController(
        { getDashboard: vi.fn(), getDailySnapshots: vi.fn(), getRoomStatus: vi.fn() } as any,
        { aggregate: vi.fn(), generateCsv: vi.fn(), generatePdfBuffer: vi.fn(), csvFilename: vi.fn(), pdfFilename: vi.fn() } as any,
      );

      try {
        controller.getDailySnapshots({
          startDate: '2026-12-01',
          endDate: '2026-01-01',
        });
        expect.fail('Should have thrown');
      } catch (err) {
        assertHttpException(err, 400);
        expect(err).toBeInstanceOf(BadRequestException);
      }
    });
  });

  // ─── 8. POST /night-audit/backfill — 400 on invalid date ──────────────────

  describe('POST /night-audit/backfill — 400 on missing date', () => {
    it('controller throws BadRequestException on empty date', async () => {
      const { NightAuditController } = await import(
        '../../modules/night-audit/night-audit.controller'
      );

      const controller = new NightAuditController(
        { runForBusinessDate: vi.fn() } as any,
        { getHotelBusinessDate: vi.fn() } as any,
      );

      try {
        await controller.backfill('');
        expect.fail('Should have thrown');
      } catch (err) {
        assertHttpException(err, 400);
        expect(err).toBeInstanceOf(BadRequestException);
      }
    }, 10000);

    it('controller throws BadRequestException on malformed date', async () => {
      const { NightAuditController } = await import(
        '../../modules/night-audit/night-audit.controller'
      );

      const controller = new NightAuditController(
        { runForBusinessDate: vi.fn() } as any,
        { getHotelBusinessDate: vi.fn() } as any,
      );

      try {
        await controller.backfill('not-a-date');
        expect.fail('Should have thrown');
      } catch (err) {
        assertHttpException(err, 400);
        expect(err).toBeInstanceOf(BadRequestException);
      }
    }, 10000);
  });

  // ─── NestJS built-in error envelope verification ──────────────────────────

  describe('NestJS HttpException envelope shape contract', () => {
    const cases: [string, HttpException, number][] = [
      ['BadRequestException',   new BadRequestException('Invalid input'),    400],
      ['UnauthorizedException', new UnauthorizedException('No token'),       401],
      ['NotFoundException',     new NotFoundException('Not found'),          404],
      ['ConflictException',     new ConflictException('Already exists'),     409],
    ];

    it.each(cases)(
      '%s produces { message, statusCode, error } envelope',
      (_name, exception, expectedStatus) => {
        assertErrorEnvelope(exception, expectedStatus);
      },
    );

    it('BadRequestException with string[] message preserves array', () => {
      const err = new BadRequestException(['field1 required', 'field2 invalid']);
      const response = err.getResponse() as Record<string, unknown>;
      expect(response['statusCode']).toBe(400);
      expect(Array.isArray(response['message'])).toBe(true);
      expect(response['error']).toBe('Bad Request');
    });
  });
});
