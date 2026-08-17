import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemindersService } from './reminders.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  reservation: {
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
};

const mockEmailService = {
  sendPreArrivalReminder: vi.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  get: vi.fn((key: string) => {
    const values: Record<string, string> = {
      HOTEL_NAME: 'Hotel Test',
      HOTEL_ADDRESS: 'Calle 123',
      HOTEL_PHONE: '+57 1 555-0100',
    };
    return values[key] || null;
  }),
};

describe('RemindersService', () => {
  let service: RemindersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RemindersService(
      mockPrisma as any,
      mockEmailService as any,
      mockConfigService as any,
    );
  });

  describe('sendPreArrivalReminders', () => {
    it('sends reminders to confirmed reservations with check-in tomorrow', async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      mockPrisma.reservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          checkInDate: new Date(tomorrowStr + 'T00:00:00.000Z'),
          checkOutDate: new Date(tomorrowStr + 'T00:00:00.000Z'),
          totalNights: 2,
          guest: {
            email: 'guest@example.com',
            fullName: 'Ana Torres',
            specialRequests: null,
          },
          roomType: { name: 'Doble Estándar' },
        },
      ]);

      mockPrisma.reservation.update.mockResolvedValue({});

      await service.sendPreArrivalReminders();

      expect(mockPrisma.reservation.findMany).toHaveBeenCalledWith({
        where: {
          checkInDate: new Date(tomorrowStr + 'T00:00:00.000Z'),
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          reminderSentAt: null,
          guest: { email: { not: null } },
        },
        include: {
          guest: true,
          roomType: true,
        },
      });

      expect(mockEmailService.sendPreArrivalReminder).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendPreArrivalReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'guest@example.com',
          guestName: 'Ana Torres',
          hotelName: 'Hotel Test',
          roomTypeName: 'Doble Estándar',
          totalNights: 2,
        }),
      );

      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { reminderSentAt: expect.any(Date) },
      });
    });

    it('skips reservations where reminderAlreadySent', async () => {
      mockPrisma.reservation.findMany.mockResolvedValue([]);

      await service.sendPreArrivalReminders();

      expect(mockEmailService.sendPreArrivalReminder).not.toHaveBeenCalled();
    });

    it('continues batch when one email fails', async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      mockPrisma.reservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          checkInDate: new Date(tomorrowStr + 'T00:00:00.000Z'),
          checkOutDate: new Date(tomorrowStr + 'T00:00:00.000Z'),
          totalNights: 1,
          guest: { email: 'fail@example.com', fullName: 'Fail', specialRequests: null },
          roomType: { name: 'Single' },
        },
        {
          id: 'res-2',
          checkInDate: new Date(tomorrowStr + 'T00:00:00.000Z'),
          checkOutDate: new Date(tomorrowStr + 'T00:00:00.000Z'),
          totalNights: 1,
          guest: { email: 'ok@example.com', fullName: 'OK', specialRequests: null },
          roomType: { name: 'Single' },
        },
      ]);

      mockEmailService.sendPreArrivalReminder
        .mockRejectedValueOnce(new Error('Resend failed'))
        .mockResolvedValueOnce(undefined);

      mockPrisma.reservation.update.mockResolvedValue({});

      await service.sendPreArrivalReminders();

      // Second email should still be sent
      expect(mockEmailService.sendPreArrivalReminder).toHaveBeenCalledTimes(2);
      // Only second reservation marked as sent
      expect(mockPrisma.reservation.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res-2' },
        data: { reminderSentAt: expect.any(Date) },
      });
    });
  });

  describe('getReminderStats', () => {
    it('returns today and pending counts', async () => {
      mockPrisma.reservation.count
        .mockResolvedValueOnce(5)  // today
        .mockResolvedValueOnce(3); // pending

      const stats = await service.getReminderStats();

      expect(stats).toEqual({ today: 5, pending: 3 });
    });
  });
});
