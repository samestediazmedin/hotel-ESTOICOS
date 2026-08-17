import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicReservationsService } from './public-reservations.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrisma = {
  reservation: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

describe('PublicReservationsService', () => {
  let service: PublicReservationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PublicReservationsService(mockPrisma as any);
  });

  describe('lookupReservation', () => {
    it('returns reservation when found by email + code', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: 'res-123',
        status: 'CONFIRMED',
        completionStatus: 'PENDING',
        checkInDate: new Date('2026-07-01'),
        checkOutDate: new Date('2026-07-03'),
        totalNights: 2,
        createdAt: new Date(), // Not expired
        guest: { fullName: 'Ana Torres', email: 'ana@example.com' },
        roomType: { name: 'Doble Estándar' },
      });

      const result = await service.lookupReservation({
        email: 'ana@example.com',
        confirmationCode: 'res',
      });

      expect(result.guestName).toBe('Ana Torres');
      expect(result.roomTypeName).toBe('Doble Estándar');
    });

    it('throws NotFound when reservation not found', async () => {
      mockPrisma.reservation.findFirst.mockResolvedValue(null);

      await expect(
        service.lookupReservation({ email: 'test@example.com', confirmationCode: 'xxx' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequest when reservation is expired', async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25); // > 24h

      mockPrisma.reservation.findFirst.mockResolvedValue({
        id: 'res-123',
        status: 'CONFIRMED',
        completionStatus: 'PENDING',
        createdAt: oldDate,
        guest: { fullName: 'Ana', email: 'ana@example.com' },
        roomType: { name: 'Single' },
      });

      await expect(
        service.lookupReservation({ email: 'ana@example.com', confirmationCode: 'res' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeReservation', () => {
    it('completes a pending reservation', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-123',
        status: 'CONFIRMED',
        completionStatus: 'PENDING',
        checkInDate: new Date('2026-07-01'),
        checkOutDate: new Date('2026-07-03'),
        totalNights: 2,
        createdAt: new Date(),
        guest: { fullName: 'Ana Torres' },
        roomType: { name: 'Doble' },
      });

      mockPrisma.reservation.update.mockResolvedValue({
        id: 'res-123',
        status: 'CONFIRMED',
        completionStatus: 'COMPLETED',
        checkInDate: new Date('2026-07-01'),
        checkOutDate: new Date('2026-07-03'),
        totalNights: 2,
        guest: { fullName: 'Ana Torres' },
        roomType: { name: 'Doble' },
      });

      const result = await service.completeReservation('res-123');

      expect(result.completionStatus).toBe('COMPLETED');
      expect(mockPrisma.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'res-123' },
          data: { completionStatus: 'COMPLETED', status: 'CONFIRMED' },
        }),
      );
    });

    it('throws when reservation is not pending', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        id: 'res-123',
        completionStatus: 'COMPLETED',
        createdAt: new Date(),
      });

      await expect(service.completeReservation('res-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('expireOldReservations', () => {
    it('expires reservations older than 24h', async () => {
      mockPrisma.reservation.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.expireOldReservations();

      expect(result.expired).toBe(3);
      expect(mockPrisma.reservation.updateMany).toHaveBeenCalledWith({
        where: {
          completionStatus: 'PENDING',
          createdAt: expect.any(Object), // lt: cutoff
        },
        data: { completionStatus: 'EXPIRED', status: 'CANCELLED' },
      });
    });
  });
});
