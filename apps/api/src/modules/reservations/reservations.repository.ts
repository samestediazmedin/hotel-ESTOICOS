import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Fields returned for reservation queries */
const RESERVATION_SELECT = {
  id: true,
  guestId: true,
  roomId: true,
  roomTypeId: true,
  checkInDate: true,
  checkOutDate: true,
  status: true,
  source: true,
  adults: true,
  children: true,
  totalNights: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  // 2026-05-28 — expose offer attribution to the staff PMS so the drawer can
  // show "Vino por: <offer.title>". Nullable — most reservations are not
  // attributed to a specific homepage offer.
  sourceOfferId: true,
  sourceOffer: {
    select: {
      id: true,
      title: true,
      badge: true,
    },
  },
  // 2026-05-29 — guest and room relations were missing from RESERVATION_SELECT.
  // Every admin read endpoint (list + findOne) was returning reservations without
  // a guest object, causing "Cannot read properties of undefined (reading 'fullName')"
  // crashes in RoomRackTable, CheckInDrawer, and CheckOutConfirmDialog.
  // guestId is always set (Reservation.guestId String — NOT nullable in schema),
  // so guest is always a non-null relation. room is optional (roomId is nullable).
  guest: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      documentType: true,
      nationality: true,
      dateOfBirth: true,
    },
  },
  room: {
    select: {
      id: true,
      number: true,
      floor: true,
      roomTypeId: true,
      roomType: {
        select: {
          id: true,
          name: true,
          basePrice: true,
        },
      },
    },
  },
} as const;

export interface ReservationFilter {
  from?: string;
  to?: string;
  status?: string;
  roomId?: string;
  guestId?: string;
}

@Injectable()
export class ReservationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: RESERVATION_SELECT,
    });
    if (!reservation) {
      throw new NotFoundException(`Reservation ${id} not found`);
    }
    return reservation;
  }

  findAll(filter: ReservationFilter = {}) {
    const where: Record<string, unknown> = {};

    if (filter.status) {
      where['status'] = filter.status;
    }
    if (filter.roomId) {
      where['roomId'] = filter.roomId;
    }
    if (filter.guestId) {
      where['guestId'] = filter.guestId;
    }
    if (filter.from || filter.to) {
      where['checkInDate'] = {
        ...(filter.from ? { gte: new Date(filter.from + 'T00:00:00.000Z') } : {}),
        ...(filter.to ? { lte: new Date(filter.to + 'T00:00:00.000Z') } : {}),
      };
    }

    return this.prisma.reservation.findMany({
      where,
      select: RESERVATION_SELECT,
      orderBy: { checkInDate: 'asc' },
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.reservation.update({
      where: { id },
      data,
      select: RESERVATION_SELECT,
    });
  }

  /**
   * findByIdWithDetails — returns reservation with guest + room for AI tool display.
   * Returns null if not found (unlike findById which throws 404).
   * Used by ReservationsService.findByIdForAI (Phase 07).
   */
  findByIdWithDetails(id: string) {
    return this.prisma.reservation.findUnique({
      where: { id },
      include: {
        guest: { select: { fullName: true } },
        room: { select: { number: true } },
      },
    });
  }

  /**
   * cancel — sets status to CANCELLED.
   * Never deletes the row — cancellation retains the record (RES-03).
   * The exclusion constraint automatically excludes CANCELLED rows (WHERE clause).
   */
  cancel(id: string) {
    return this.prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: RESERVATION_SELECT,
    });
  }
}
