import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PublicBookingController } from './public-booking.controller';

// ── Mocks ────────────────────────────────────────────────────────────────────

function buildMocks() {
  const service = {
    createBooking: vi.fn().mockResolvedValue({
      reservationId: 'res-001',
      guestName: 'Ana Rios',
      total: 476000,
    }),
  };

  const availabilityService = {
    searchAvailable: vi.fn().mockResolvedValue([
      {
        id: 'room-001',
        number: '101',
        floor: 1,
        roomTypeId: 'rt-001',
        photos: [],
        pricing: { total: 200000 },
      },
    ]),
  };

  const controller = new PublicBookingController(
    service as any,
    availabilityService as any,
  );

  return { controller, service, availabilityService };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PublicBookingController', () => {
  // ── SEC-002: getAvailability returns 400 on invalid query ─────────────────

  describe('getAvailability — input validation (SEC-002)', () => {
    it('throws BadRequestException (400) when query params are missing', async () => {
      const { controller } = buildMocks();

      await expect(controller.getAvailability({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException (400) when checkIn has invalid format', async () => {
      const { controller } = buildMocks();

      await expect(
        controller.getAvailability({
          checkIn: 'not-a-date',
          checkOut: '2026-07-03',
          adults: '2',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('includes validation issues in the error response', async () => {
      const { controller } = buildMocks();

      try {
        await controller.getAvailability({});
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const response = err.getResponse();
        expect(response.message).toBe('Invalid request body');
        expect(response.issues).toBeDefined();
        expect(Array.isArray(response.issues)).toBe(true);
        expect(response.issues.length).toBeGreaterThan(0);
      }
    });

    it('passes through to service on valid query', async () => {
      const { controller, availabilityService } = buildMocks();

      const result = await controller.getAvailability({
        checkIn: '2026-07-01',
        checkOut: '2026-07-03',
        adults: '2',
      });

      expect(availabilityService.searchAvailable).toHaveBeenCalledTimes(1);
      expect(result.rooms).toBeDefined();
      expect(result.rooms).toHaveLength(1);
    });
  });

  // ── SEC-002: createBooking returns 400 on invalid body ────────────────────

  describe('createBooking — input validation (SEC-002)', () => {
    it('throws BadRequestException (400) when body is empty', async () => {
      const { controller } = buildMocks();

      await expect(controller.createBooking({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException (400) when required fields are missing', async () => {
      const { controller } = buildMocks();

      await expect(
        controller.createBooking({ fullName: 'Ana' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('includes validation issues in the error response', async () => {
      const { controller } = buildMocks();

      try {
        await controller.createBooking({});
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const response = err.getResponse();
        expect(response.message).toBe('Invalid request body');
        expect(response.issues).toBeDefined();
        expect(Array.isArray(response.issues)).toBe(true);
        expect(response.issues.length).toBeGreaterThan(0);
      }
    });

    it('passes through to service on valid body', async () => {
      const { controller, service } = buildMocks();

      const validBody = {
        fullName: 'Ana Rios',
        email: 'ana@example.com',
        phone: '+57 300 123 4567',
        documentType: 'CC',
        documentNumber: '1234567890',
        nationality: 'CO',
        dateOfBirth: '1990-06-15',
        roomId: 'cmtroomtest00010000roomid',
        roomTypeId: 'cmtroomtest00020000roomid',
        checkIn: '2026-07-01',
        checkOut: '2026-07-03',
        adults: 2,
      };

      const result = await controller.createBooking(validBody);

      expect(service.createBooking).toHaveBeenCalledTimes(1);
      expect(result.reservationId).toBe('res-001');
    });

    it('throws BadRequestException (400) when checkIn === checkOut (0 nights)', async () => {
      const { controller } = buildMocks();

      await expect(
        controller.createBooking({
          fullName: 'Ana Rios',
          email: 'ana@example.com',
          phone: '+57 300 123 4567',
          documentType: 'CC',
          documentNumber: '1234567890',
          nationality: 'CO',
          dateOfBirth: '1990-06-15',
          roomTypeId: 'cmtroomtest00020000roomid',
          checkIn: '2026-07-01',
          checkOut: '2026-07-01',
          adults: 2,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
