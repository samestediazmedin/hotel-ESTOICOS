import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ReservationLookupDto {
  email: string;
  confirmationCode: string;
}

export interface ReservationCompletionResult {
  id: string;
  status: string;
  completionStatus: string;
  checkInDate: Date;
  checkOutDate: Date;
  roomTypeName: string;
  guestName: string;
  totalNights: number;
}

/**
 * PublicReservationsService — Online reservation completion flow.
 *
 * Allows guests to look up and complete reservations that were started
 * but not finalized (completionStatus = PENDING).
 */
@Injectable()
export class PublicReservationsService {
  private readonly logger = new Logger(PublicReservationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Look up a reservation by email + confirmation code (reservation ID prefix).
   */
  async lookupReservation(dto: ReservationLookupDto): Promise<ReservationCompletionResult> {
    // Find reservation by guest email and ID starting with confirmation code
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        id: { startsWith: dto.confirmationCode },
        guest: { email: dto.email },
        completionStatus: 'PENDING',
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
      include: {
        guest: true,
        roomType: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada o ya completada');
    }

    // Check if expired (older than 24h)
    if (this.isExpired(reservation.createdAt)) {
      await this.expireReservation(reservation.id);
      throw new BadRequestException('Esta reserva ha expirado. Por favor, cree una nueva reserva.');
    }

    return {
      id: reservation.id,
      status: reservation.status,
      completionStatus: reservation.completionStatus,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      roomTypeName: reservation.roomType?.name || 'Habitación estándar',
      guestName: reservation.guest.fullName,
      totalNights: reservation.totalNights,
    };
  }

  /**
   * Complete a pending reservation.
   */
  async completeReservation(reservationId: string): Promise<ReservationCompletionResult> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        roomType: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reserva no encontrada');
    }

    if (reservation.completionStatus !== 'PENDING') {
      throw new BadRequestException('Esta reserva ya ha sido completada o ha expirado');
    }

    if (this.isExpired(reservation.createdAt)) {
      await this.expireReservation(reservation.id);
      throw new BadRequestException('Esta reserva ha expirado');
    }

    const updated = await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        completionStatus: 'COMPLETED',
        status: 'CONFIRMED',
      },
      include: {
        guest: true,
        roomType: true,
      },
    });

    this.logger.log(`Reservation ${reservationId} completed`);

    return {
      id: updated.id,
      status: updated.status,
      completionStatus: updated.completionStatus,
      checkInDate: updated.checkInDate,
      checkOutDate: updated.checkOutDate,
      roomTypeName: updated.roomType?.name || 'Habitación estándar',
      guestName: updated.guest.fullName,
      totalNights: updated.totalNights,
    };
  }

  /**
   * Expire reservations that have been PENDING for more than 24 hours.
   * Called by a cron job or manually.
   */
  async expireOldReservations(): Promise<{ expired: number }> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const result = await this.prisma.reservation.updateMany({
      where: {
        completionStatus: 'PENDING',
        createdAt: { lt: cutoff },
      },
      data: {
        completionStatus: 'EXPIRED',
        status: 'CANCELLED',
      },
    });

    this.logger.log(`Expired ${result.count} old pending reservations`);

    return { expired: result.count };
  }

  private isExpired(createdAt: Date): boolean {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    return createdAt < cutoff;
  }

  private async expireReservation(id: string): Promise<void> {
    await this.prisma.reservation.update({
      where: { id },
      data: {
        completionStatus: 'EXPIRED',
        status: 'CANCELLED',
      },
    });
    this.logger.log(`Reservation ${id} auto-expired`);
  }
}
