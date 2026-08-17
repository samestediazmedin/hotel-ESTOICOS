/**
 * check-availability.tool.ts — OpenAI function-calling tool: check_availability
 *
 * READ-ONLY: queries room availability and pricing for a given date range.
 * No prisma.*.create/update/delete/upsert calls — enforced by
 * concierge-tool-registry.spec.ts (grep test, CON-04).
 *
 * SECURITY:
 *   - Never reads reservations table beyond the overlap check (room IDs only, no guest data).
 *   - Never reads folios, guests, payments, or any PII.
 *   - Output contains ONLY public room-type data (name, capacity, price, amenities) + a
 *     bookingUrl deep-link. No room IDs, no booking counts, no occupancy rates.
 *
 * REUSE OF PUBLIC AVAILABILITY LOGIC:
 *   The two-query availability pattern (physicalStatus filter + reservation overlap check)
 *   is the same logic used by AvailabilityService.searchAvailable(). It is replicated here
 *   (rather than injecting AvailabilityService cross-module) to keep the concierge module
 *   self-contained. Any change to the public availability business rules must be applied
 *   here in parallel.
 *
 *   Pricing is delegated to PricingService.calculateBreakdown() — the same method used by
 *   the public booking engine. This ensures IVA handling, seasonal multipliers, and rate
 *   plan logic are applied consistently.
 *
 * DEEP-LINK CONTRACT:
 *   bookingUrl = <FRONTEND_BASE_URL>/booking/rooms?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&adults=N
 *   The /booking/rooms page (BookingResultsPage) already reads these params from the URL.
 *   An optional roomTypeId param is appended when the guest has expressed a preference.
 *
 * Prisma serialization gotchas (documented once per project):
 *   - Decimal fields (basePrice, priceModifier, ivaRate) serialize as STRINGS in JSON.
 *     Always coerce with Number(...) before arithmetic or output.
 *   - @db.Date fields (season dates) serialize as full ISO datetime.
 *     Normalize with .toISOString().slice(0,10) when needed.
 */

import { z } from 'zod';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { PricingService } from '../../pricing/pricing.service';
import type { ConciergeRepository } from '../concierge.repository';

// ─── Input schema ─────────────────────────────────────────────────────────────

export const CheckAvailabilitySchema = z
  .object({
    checkIn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be YYYY-MM-DD'),
    checkOut: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be YYYY-MM-DD'),
    guests: z.number().int().min(1).max(10).default(2),
    roomTypeId: z.string().optional(),
  })
  .strict();

export type CheckAvailabilityArgs = z.infer<typeof CheckAvailabilitySchema>;

// ─── Output types ─────────────────────────────────────────────────────────────

export interface AvailableRoomTypeItem {
  roomTypeId: string;
  name: string;
  capacity: number;
  /** Base nightly price in COP — total for the stay including IVA */
  totalCOP: number;
  /** Number of nights */
  nights: number;
  description: string;
  amenities: string[];
  /** Deep-link to the booking form pre-filled for this room type */
  bookingUrl: string;
}

export interface CheckAvailabilityResult {
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  /** Available room types with pricing. Empty array means no availability. */
  available: AvailableRoomTypeItem[];
  /** Generic booking URL for the guest to browse all available types */
  generalBookingUrl: string;
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export const CheckAvailabilityTool = {
  name: 'check_availability' as const,
  schema: CheckAvailabilitySchema,

  definition: {
    type: 'function' as const,
    function: {
      name: 'check_availability',
      description:
        'Check which room types are available and their prices for a specific date range. ' +
        'Returns a list of available room types with total prices (IVA included) and a ' +
        'booking deep-link pre-filled with the dates and guest count. ' +
        'Use this when guests ask "¿hay disponibilidad para estas fechas?", ' +
        '"¿cuánto cuesta una habitación del 10 al 15 de julio?", ' +
        '"¿tienen habitaciones libres este fin de semana?", or similar. ' +
        'After showing the results, invite the guest to continue to the booking form ' +
        'using the bookingUrl provided — NEVER ask for personal data in chat.',
      parameters: {
        type: 'object',
        properties: {
          checkIn: {
            type: 'string',
            description: 'Check-in date in YYYY-MM-DD format',
          },
          checkOut: {
            type: 'string',
            description: 'Check-out date in YYYY-MM-DD format',
          },
          guests: {
            type: 'number',
            description: 'Number of guests (adults). Default 2.',
          },
          roomTypeId: {
            type: 'string',
            description:
              'Optional: limit results to a specific room type ID (from get_room_types_summary)',
          },
        },
        required: ['checkIn', 'checkOut'],
      },
    },
  },

  async handler(
    args: CheckAvailabilityArgs,
    deps: {
      repo: ConciergeRepository;
      prisma?: PrismaService;
      pricingService?: PricingService;
    },
  ): Promise<CheckAvailabilityResult | { error: string; message: string }> {
    if (!deps.prisma) {
      return { error: 'unavailable', message: 'Availability service not available.' };
    }
    if (!deps.pricingService) {
      return { error: 'unavailable', message: 'Pricing service not available.' };
    }

    // ── Date validation ───────────────────────────────────────────────────────
    const checkIn = new Date(args.checkIn + 'T00:00:00.000Z');
    const checkOut = new Date(args.checkOut + 'T00:00:00.000Z');

    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      return { error: 'invalid_dates', message: 'Las fechas proporcionadas no son válidas.' };
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (checkIn < today) {
      return {
        error: 'invalid_dates',
        message: 'La fecha de entrada no puede ser en el pasado.',
      };
    }

    if (checkOut <= checkIn) {
      return {
        error: 'invalid_dates',
        message:
          'La fecha de salida debe ser posterior a la de entrada. ' +
          'Por favor verifica las fechas.',
      };
    }

    const nights = Math.round(
      (checkOut.getTime() - checkIn.getTime()) / 86_400_000,
    );

    const guests = args.guests ?? 2;

    // ── FRONTEND_BASE_URL — same pattern as reviews.service.ts ────────────────
    const frontendBase =
      process.env['FRONTEND_BASE_URL'] ?? 'http://localhost:5173';

    // Build the general booking URL (no roomTypeId filter)
    const generalParams = new URLSearchParams({
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      adults: String(guests),
    });
    const generalBookingUrl = `${frontendBase}/booking/rooms?${generalParams.toString()}`;

    // ── Step 1: Physically available rooms (mirrors AvailabilityService logic) ─
    // Exclude OUT_OF_SERVICE and ON_HOLD rooms — same filter as InventoryRepository.findAvailableRooms()
    const physicallyAvailable = await deps.prisma.room.findMany({
      where: {
        isActive: true,
        physicalStatus: { notIn: ['OUT_OF_SERVICE', 'ON_HOLD'] },
        ...(args.roomTypeId ? { roomTypeId: args.roomTypeId } : {}),
      },
      select: { id: true, roomTypeId: true },
    });

    if (physicallyAvailable.length === 0) {
      return {
        checkIn: args.checkIn,
        checkOut: args.checkOut,
        guests,
        nights,
        available: [],
        generalBookingUrl,
      };
    }

    // ── Step 2: Exclude rooms with overlapping active reservations ────────────
    // Same overlap filter as AvailabilityService.searchAvailable():
    //   status NOT IN ['CANCELLED', 'NO_SHOW']
    //   half-open interval [checkIn, checkOut)
    const overlapping = await deps.prisma.reservation.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
      select: { roomId: true },
    });
    const bookedRoomIds = new Set(
      overlapping
        .map((r) => r.roomId)
        .filter((id): id is string => Boolean(id)),
    );

    const availableRooms = physicallyAvailable.filter(
      (r) => !bookedRoomIds.has(r.id),
    );

    if (availableRooms.length === 0) {
      return {
        checkIn: args.checkIn,
        checkOut: args.checkOut,
        guests,
        nights,
        available: [],
        generalBookingUrl,
      };
    }

    // ── Step 3: Deduplicate by roomTypeId ─────────────────────────────────────
    // The public booking flow is "by room type" (request-to-book model).
    // Multiple physical rooms of the same type → one entry in the output.
    const uniqueRoomTypeIds = [...new Set(availableRooms.map((r) => r.roomTypeId))];

    // ── Step 4: Load public room type metadata ────────────────────────────────
    // Only published + active types (same filter as the public booking catalogue)
    const roomTypes = await deps.prisma.roomType.findMany({
      where: {
        id: { in: uniqueRoomTypeIds },
        isPublished: true,
        isActive: true,
      },
      orderBy: { basePrice: 'asc' },
      select: {
        id: true,
        name: true,
        maxOccupancy: true,
        basePrice: true,
        description: true,
        amenities: true,
      },
    });

    if (roomTypes.length === 0) {
      return {
        checkIn: args.checkIn,
        checkOut: args.checkOut,
        guests,
        nights,
        available: [],
        generalBookingUrl,
      };
    }

    // ── Step 5: Pricing — one call per room type (N+1 avoidance) ─────────────
    // Delegates to PricingService.calculateBreakdown() — the SAME method used by
    // the public booking engine. IVA, seasonal multipliers, and plan logic all apply.
    const available: AvailableRoomTypeItem[] = [];

    for (const rt of roomTypes) {
      try {
        const breakdown = await deps.pricingService.calculateBreakdown({
          roomTypeId: rt.id,
          checkIn,
          checkOut,
          adults: guests,
        });

        // Build per-room-type booking deep-link
        const params = new URLSearchParams({
          checkIn: args.checkIn,
          checkOut: args.checkOut,
          adults: String(guests),
        });
        const bookingUrl = `${frontendBase}/booking/rooms?${params.toString()}`;

        available.push({
          roomTypeId: rt.id,
          name: rt.name,
          capacity: rt.maxOccupancy,
          // breakdown.total is already a number (PricingService coerces all Decimals)
          totalCOP: breakdown.total,
          nights,
          description: rt.description ?? '',
          amenities: Array.isArray(rt.amenities) ? rt.amenities : [],
          bookingUrl,
        });
      } catch {
        // Pricing failed for this room type — skip it rather than crashing the tool.
        // The guest still sees other available types.
      }
    }

    return {
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      guests,
      nights,
      available,
      generalBookingUrl,
    };
  },
};
