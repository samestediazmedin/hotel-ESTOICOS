import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService, PreArrivalReminderParams } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

/**
 * RemindersService — Pre-arrival reminder cron job.
 *
 * Fires daily at 06:00 America/Bogotá (2 hours after night audit).
 * Finds reservations with check-in tomorrow and sends reminder email.
 * Idempotent: skips reservations where reminderAlreadySent = true.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Daily cron: send pre-arrival reminders to guests checking in tomorrow.
   *
   * Runs at 06:00 Bogotá — after night audit (03:00) has advanced business date.
   */
  @Cron('0 6 * * *', { name: 'pre-arrival-reminders', timeZone: 'America/Bogota' })
  async sendPreArrivalReminders(): Promise<void> {
    const tomorrow = this.getTomorrowDate();
    this.logger.log(`Starting pre-arrival reminder job for ${tomorrow}`);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        checkInDate: new Date(tomorrow + 'T00:00:00.000Z'),
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        reminderSentAt: null,
        guest: { email: { not: null } },
      },
      include: {
        guest: true,
        roomType: true,
      },
    });

    this.logger.log(`Found ${reservations.length} reservations for tomorrow`);

    let sent = 0;
    let failed = 0;

    for (const reservation of reservations) {
      try {
        const params = this.buildReminderParams(reservation);
        await this.emailService.sendPreArrivalReminder(params);

        // Mark as sent
        await this.prisma.reservation.update({
          where: { id: reservation.id },
          data: { reminderSentAt: new Date() },
        });

        sent++;
        this.logger.log(`Reminder sent to ${reservation.guest.email} for reservation ${reservation.id}`);
      } catch (err) {
        failed++;
        this.logger.error(
          `Failed to send reminder to ${reservation.guest.email} for reservation ${reservation.id}`,
          err,
        );
        // Continue with next reservation — don't stop the batch
      }
    }

    this.logger.log(`Pre-arrival reminder job complete: ${sent} sent, ${failed} failed`);
  }

  /**
   * Get tomorrow's date in YYYY-MM-DD format (UTC).
   */
  private getTomorrowDate(): string {
    const now = new Date();
    now.setUTCDate(now.getUTCDate() + 1);
    return now.toISOString().slice(0, 10);
  }

  /**
   * Build PreArrivalReminderParams from a reservation with included guest and roomType.
   */
  private buildReminderParams(reservation: any): PreArrivalReminderParams {
    const hotelName = this.config.get<string>('HOTEL_NAME') || 'Hotel Sumapaz';
    const hotelAddress = this.config.get<string>('HOTEL_ADDRESS') || null;
    const hotelPhone = this.config.get<string>('HOTEL_PHONE') || null;

    return {
      to: reservation.guest.email!,
      guestName: reservation.guest.fullName,
      hotelName,
      hotelAddress,
      hotelPhone,
      checkInDate: reservation.checkInDate.toISOString().slice(0, 10),
      checkOutDate: reservation.checkOutDate.toISOString().slice(0, 10),
      roomTypeName: reservation.roomType?.name || 'Habitación estándar',
      totalNights: reservation.totalNights,
      specialRequests: reservation.guest.specialRequests,
    };
  }

  /**
   * Get reminder statistics for the dashboard.
   */
  async getReminderStats(): Promise<{ today: number; pending: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayCount, pendingCount] = await Promise.all([
      this.prisma.reservation.count({
        where: {
          reminderSentAt: { gte: today },
        },
      }),
      this.prisma.reservation.count({
        where: {
          checkInDate: { gte: today },
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          reminderSentAt: null,
          guest: { email: { not: null } },
        },
      }),
    ]);

    return { today: todayCount, pending: pendingCount };
  }
}
