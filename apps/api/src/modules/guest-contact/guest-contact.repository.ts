import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactMethod } from '../../generated/prisma/client';

export interface CreateContactEventData {
  guestId: string;
  staffUserId: string;
  method: ContactMethod;
  notes?: string | null;
}

/**
 * GuestContactRepository — thin Prisma wrapper for guest_contact_events table.
 *
 * Both methods include staffUser join for consistent response shape.
 */
@Injectable()
export class GuestContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * create — insert a new GuestContactEvent with staffUser join.
   */
  create(data: CreateContactEventData) {
    return this.prisma.guestContactEvent.create({
      data: {
        guestId: data.guestId,
        staffUserId: data.staffUserId,
        method: data.method,
        notes: data.notes ?? null,
      },
      include: {
        staffUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * findManyByGuestId — retrieve recent contact events for a guest.
   *
   * - Ordered by createdAt DESC (most recent first)
   * - Limit is already clamped 1..50 by the service layer
   */
  findManyByGuestId(guestId: string, limit: number) {
    return this.prisma.guestContactEvent.findMany({
      where: { guestId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        staffUser: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
