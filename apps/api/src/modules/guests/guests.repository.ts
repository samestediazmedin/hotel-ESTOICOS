import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * GuestsRepository — thin Prisma wrapper for the guests bounded context.
 *
 * NO encryption logic here — that belongs in GuestsService.
 * NO RBAC here — that belongs in GuestsController.
 *
 * Stores and retrieves raw data (documentNumber is always ciphertext in DB).
 */
@Injectable()
export class GuestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a guest record.
   * documentNumber must already be encrypted before this is called.
   */
  createGuest(data: {
    fullName: string;
    email?: string | null;
    phone?: string | null;
    documentType: string;
    documentNumber: string; // ciphertext
    nationality: string;
    dateOfBirth: Date;
    // Phase 15 — Extended contact capture
    preferredLanguage?: string;
    contactPreference?: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
    whatsappNumber?: string | null;
    marketingConsent?: boolean;
    dietaryRestrictions?: string | null;
    specialRequests?: string | null;
  }) {
    return this.prisma.guest.create({ data });
  }

  /**
   * Find a guest by ID.
   * Returns null if not found. documentNumber field is ciphertext.
   */
  findById(id: string) {
    return this.prisma.guest.findUnique({
      where: { id },
      include: { reservations: true },
    });
  }

  /**
   * Find all guests with optional search and pagination.
   * Searches by fullName only — document search requires decryption (see Pitfall P9).
   *
   * Phase 16 — N+1 prevention: includes the latest contact event per guest via
   * a lateral join (take: 1, orderBy createdAt desc). Single Prisma query for all
   * 50 rows. Uses `@@index([guestId, createdAt(sort: Desc)])` added in Phase 16 migration.
   */
  findAll(skip = 0, take = 50, search?: string) {
    return this.prisma.guest.findMany({
      where: search
        ? { fullName: { contains: search, mode: 'insensitive' } }
        : undefined,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        contactEvents: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            method: true,
            createdAt: true,
            staffUser: { select: { name: true } },
          },
        },
      },
    });
  }

  /**
   * Update guest fields.
   * If documentNumber is provided, it must already be encrypted.
   */
  update(
    id: string,
    data: {
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      documentType?: string;
      documentNumber?: string; // ciphertext or sentinel '[ANONYMIZED]'
      nationality?: string;
      dateOfBirth?: Date;
      anonymizedAt?: Date | null;
      // Phase 15 — Extended contact capture
      preferredLanguage?: string;
      contactPreference?: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
      whatsappNumber?: string | null;
      marketingConsent?: boolean;
      dietaryRestrictions?: string | null;
      specialRequests?: string | null;
    },
  ) {
    return this.prisma.guest.update({ where: { id }, data });
  }

  /**
   * searchByNameInsensitive — case-insensitive partial name search for AI tool.
   * Includes reservation count via _count for totalStays aggregation.
   * Returns raw rows — caller (GuestsService.searchByNameForAI) maps to AI DTO.
   */
  searchByNameInsensitive(query: string, limit = 10) {
    return this.prisma.guest.findMany({
      where: { fullName: { contains: query, mode: 'insensitive' } },
      take: limit,
      orderBy: { fullName: 'asc' },
      include: { _count: { select: { reservations: true } } },
    });
  }

  /**
   * Find all reservations for a guest.
   * Used by getHistory() in GuestsService.
   */
  findReservationsByGuestId(guestId: string) {
    return this.prisma.reservation.findMany({
      where: { guestId },
      orderBy: { checkInDate: 'desc' },
    });
  }

  /**
   * Count reservations for a guest.
   * Used by remove() in GuestsService to determine if a hard delete is safe.
   */
  countReservationsByGuestId(guestId: string): Promise<number> {
    return this.prisma.reservation.count({ where: { guestId } });
  }

  /**
   * Hard-delete a guest by ID.
   * guest_contact_events are removed automatically via CASCADE.
   * Only call after confirming reservation count is 0.
   */
  deleteGuest(id: string) {
    return this.prisma.guest.delete({ where: { id } });
  }
}
