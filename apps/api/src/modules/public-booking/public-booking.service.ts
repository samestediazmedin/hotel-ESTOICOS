import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GuestEncryptionService } from '../guests/encryption/guest-encryption.service';
import { EmailService } from '../email/email.service';
import { PricingService } from '../pricing/pricing.service';
import type { CreatePublicBookingDto } from './dto/create-public-booking.dto';

export interface CreateBookingResult {
  reservationId: string;
  guestName: string;
  total: number;
}

/**
 * PublicBookingService — handles the public booking transaction.
 *
 * Locked decisions:
 *  - Q2: Status = PENDING (request-to-book) since 2026-05-27
 *  - Q3: Guest dedup by email — if existing guest found, link; else create new
 *  - GST-02: documentNumber encrypted via GuestEncryptionService
 *  - RES-05: SELECT FOR UPDATE on room row before INSERT (defense-in-depth)
 *
 * CRITICAL (Pitfall P4): sendBookingConfirmation called OUTSIDE $transaction,
 * as fire-and-forget. Email failure must NOT roll back the reservation.
 *
 * 2026-05-29 — ratePlanId support:
 *  When dto.ratePlanId is provided, the server validates it belongs to
 *  dto.roomTypeId and is active, then uses that plan's type for pricing and
 *  persists it on the reservation. When absent, defaults to BAR (backward compat).
 */
@Injectable()
export class PublicBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: GuestEncryptionService,
    private readonly emailService: EmailService,
    private readonly pricingService: PricingService,
  ) {}

  async createBooking(dto: CreatePublicBookingDto): Promise<CreateBookingResult> {
    const checkIn = new Date(dto.checkIn + 'T00:00:00.000Z');
    const checkOut = new Date(dto.checkOut + 'T00:00:00.000Z');
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      throw new BadRequestException('Fechas inválidas (formato esperado: YYYY-MM-DD)');
    }
    if (checkOut <= checkIn) {
      throw new BadRequestException('La fecha de salida debe ser posterior a la de entrada');
    }
    const totalNights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);

    // ── Offer validation (2026-05-28) ───────────────────────────────────────
    let sourceOfferId: string | null = null;
    if (dto.sourceOfferId) {
      const offer = await this.prisma.offer.findUnique({
        where: { id: dto.sourceOfferId },
        include: { roomType: { select: { id: true, name: true } } },
      });
      if (!offer || !offer.isActive) {
        throw new BadRequestException('La oferta seleccionada ya no está disponible');
      }
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (offer.validFrom && offer.validFrom > today) {
        throw new BadRequestException('La oferta seleccionada aún no está vigente');
      }
      if (offer.validTo && offer.validTo < today) {
        throw new BadRequestException('La oferta seleccionada ha expirado');
      }
      if (offer.roomType && dto.roomTypeId !== offer.roomType.id) {
        throw new BadRequestException(
          `La oferta solo aplica al tipo ${offer.roomType.name}`,
        );
      }
      sourceOfferId = offer.id;
    }

    // ── Rate plan validation (2026-05-29) ────────────────────────────────────
    // When ratePlanId is supplied, verify it belongs to the requested roomTypeId
    // and is active. This is the server-side guard — the frontend already shows
    // only valid plans from the rate-options endpoint, but the server enforces.
    let ratePlanId: string | null = null;
    let ratePlanType: 'BAR' | 'PROMO' | 'PACKAGE' = 'BAR';

    if (dto.ratePlanId) {
      const plan = await this.prisma.ratePlan.findUnique({
        where: { id: dto.ratePlanId },
        select: { id: true, roomTypeId: true, isActive: true, type: true },
      });
      if (!plan || !plan.isActive || plan.roomTypeId !== dto.roomTypeId) {
        throw new BadRequestException('La tarifa seleccionada no es válida');
      }
      ratePlanId = plan.id;
      // Narrow to known union — treat unknown types as BAR for safety
      if (plan.type === 'PROMO' || plan.type === 'PACKAGE' || plan.type === 'BAR') {
        ratePlanType = plan.type as 'BAR' | 'PROMO' | 'PACKAGE';
      }
    }

    // ── Pricing ──────────────────────────────────────────────────────────────
    const pricing = await this.pricingService.calculateBreakdown({
      roomTypeId: dto.roomTypeId,
      checkIn,
      checkOut,
      ratePlanType,
      adults: dto.adults,
    });

    type GuestEmailFields = {
      id: string;
      fullName: string;
      email: string | null;
      whatsappNumber: string | null;
      contactPreference: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
      dietaryRestrictions: string | null;
      specialRequests: string | null;
    };
    let txResult: { guest: GuestEmailFields; reservation: { id: string } };

    try {
      txResult = await this.prisma.$transaction(async (tx) => {
        let guest = await tx.guest.findFirst({ where: { email: dto.email } });

        if (!guest) {
          guest = await tx.guest.create({
            data: {
              fullName: dto.fullName,
              email: dto.email,
              phone: dto.phone,
              documentType: dto.documentType,
              documentNumber: this.encryption.encrypt(dto.documentNumber),
              nationality: dto.nationality,
              dateOfBirth: new Date(dto.dateOfBirth + 'T00:00:00.000Z'),
              preferredLanguage: dto.preferredLanguage ?? 'es',
              contactPreference: dto.contactPreference ?? null,
              whatsappNumber: dto.whatsappNumber ?? this.normalizePhoneToE164(dto.phone),
              marketingConsent: dto.marketingConsent ?? false,
              dietaryRestrictions: dto.dietaryRestrictions ?? null,
              specialRequests: dto.specialRequests ?? null,
            },
          });
        }

        if (dto.roomId) {
          await tx.$executeRaw`SELECT id FROM rooms WHERE id = ${dto.roomId} FOR UPDATE`;
        }

        const reservation = await tx.reservation.create({
          data: {
            guestId: guest.id,
            roomId: null,
            roomTypeId: dto.roomTypeId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            status: 'PENDING',
            source: 'DIRECT',
            adults: dto.adults,
            children: 0,
            totalNights,
            notes: null,
            sourceOfferId,
            // 2026-05-29 — persist chosen rate plan (null = implicit BAR)
            ratePlanId,
          },
        });

        return { guest: guest as GuestEmailFields, reservation };
      });
    } catch (err) {
      if (this.isExclusionViolation(err)) {
        throw new ConflictException('La habitación ya no está disponible para esas fechas');
      }
      throw err;
    }

    void this.emailService.sendBookingConfirmation({
      to: txResult.guest.email ?? dto.email,
      guestName: txResult.guest.fullName,
      reservationId: txResult.reservation.id,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      roomTypeName: dto.roomTypeId,
      totalNights,
      total: pricing.total,
      guestWhatsApp: txResult.guest.whatsappNumber,
      guestContactPreference: txResult.guest.contactPreference,
      guestDietaryRestrictions: txResult.guest.dietaryRestrictions,
      guestSpecialRequests: txResult.guest.specialRequests,
    });

    return {
      reservationId: txResult.reservation.id,
      guestName: txResult.guest.fullName,
      total: pricing.total,
    };
  }

  /**
   * listPublishedRoomTypes — returns all isPublished room types with their photos,
   * pricing, capacity, amenities, and a server-computed marketing badge.
   */
  async listPublishedRoomTypes(): Promise<Array<{
    id: string;
    name: string;
    capacity: number;
    description: string;
    basePrice: number;
    amenities: string[];
    photos: Array<{ url: string; alt: string }>;
    badge: string | null;
  }>> {
    const types = await this.prisma.roomType.findMany({
      where: { isPublished: true, isActive: true },
      orderBy: { basePrice: 'asc' },
      include: {
        photos: { orderBy: { order: 'asc' }, take: 3 },
      },
    });
    return types.map((t, idx) => {
      const photos = t.photos.map((p) => ({
        url: `/images/${p.key}`,
        alt: t.name,
      }));
      const badge = idx === 0 ? 'Más económica' : idx === 1 ? 'Mejor valor' : null;
      return {
        id: t.id,
        name: t.name,
        capacity: t.maxOccupancy,
        description: t.description ?? '',
        basePrice: Number(t.basePrice),
        amenities: t.amenities,
        photos,
        badge,
      };
    });
  }

  /**
   * normalizePhoneToE164 — best-effort conversion of a free-form phone string to E.164.
   */
  private normalizePhoneToE164(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const stripped = raw.replace(/[\s()\-.]/g, '');
    if (/^\+[1-9]\d{6,14}$/.test(stripped)) return stripped;
    if (/^00[1-9]\d{6,14}$/.test(stripped)) return '+' + stripped.slice(2);
    if (/^[0-9]{10}$/.test(stripped)) return '+57' + stripped;
    if (/^[1-9]\d{10,14}$/.test(stripped)) return '+' + stripped;
    return null;
  }

  /**
   * isExclusionViolation — catches 23P01 via both Prisma error paths.
   */
  private isExclusionViolation(err: unknown): boolean {
    if (
      err instanceof PrismaClientKnownRequestError &&
      (err.meta as { code?: string } | undefined)?.code === '23P01'
    ) {
      return true;
    }
    if ((err as { code?: string })?.code === '23P01') {
      return true;
    }
    return false;
  }
}
