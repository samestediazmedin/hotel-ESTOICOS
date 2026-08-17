import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryRepository } from '../inventory/inventory.repository';
import { PricingService } from '../pricing/pricing.service';
import { PricingBreakdown } from '../pricing/dto/pricing-breakdown.dto';

/**
 * AvailabilityService — SINGLE GUARD for all room availability queries (RES-06).
 *
 * This is the ONLY place in the codebase that computes room availability
 * for a date range. Plans 03-03 (staff wizard) and 03-04 (public booking)
 * both call this service — they do NOT inline their own availability logic.
 *
 * Two public methods:
 * - searchAvailable: returns available rooms with pricing (for availability search)
 * - isRoomAvailable: boolean check for a specific room (for validation)
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryRepository: InventoryRepository,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * searchAvailable — returns rooms physically available AND not booked for the
   * given date range, each enriched with a PricingBreakdown.
   *
   * N+1 avoidance: PricingService.calculateBreakdown() is called ONCE per
   * unique roomTypeId, then fanned out to rooms sharing that type.
   *
   * Overlap filter: [checkIn, checkOut) half-open — same-day turnover supported.
   * Excludes CANCELLED and NO_SHOW reservations (matches exclusion constraint WHERE).
   */
  async searchAvailable(checkIn: Date, checkOut: Date, adults: number) {
    // Step 1: Get physically available rooms (excludes OUT_OF_SERVICE, ON_HOLD)
    const physicallyAvailable = await this.inventoryRepository.findAvailableRooms();

    // Step 2: Find rooms with overlapping ACTIVE reservations
    const overlapping = await this.prisma.reservation.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
      select: { roomId: true },
    });
    const bookedRoomIds = new Set(
      overlapping.map((r) => r.roomId).filter((id): id is string => Boolean(id)),
    );

    // Step 3: Remove booked rooms
    const available = physicallyAvailable.filter((r) => !bookedRoomIds.has(r.id));

    // Step 4: Compute pricing — one call per unique roomTypeId (N+1 avoidance)
    const uniqueRoomTypeIds = [...new Set(available.map((r) => r.roomTypeId))];
    const pricingByType = new Map<string, PricingBreakdown>();
    for (const rtId of uniqueRoomTypeIds) {
      const breakdown = await this.pricingService.calculateBreakdown({
        roomTypeId: rtId,
        checkIn,
        checkOut,
      });
      pricingByType.set(rtId, breakdown);
    }

    // Step 5: Enrich each room with its pricing
    return available.map((room) => ({
      ...room,
      pricing: pricingByType.get(room.roomTypeId)!,
    }));
  }

  /**
   * isRoomAvailable — boolean availability check for a specific room.
   *
   * Returns true if the room has no overlapping ACTIVE reservation.
   * Uses the same overlap filter as searchAvailable (consistent behavior).
   */
  async isRoomAvailable(roomId: string, checkIn: Date, checkOut: Date): Promise<boolean> {
    const conflict = await this.prisma.reservation.findFirst({
      where: {
        roomId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
      select: { id: true },
    });
    return conflict === null;
  }
}
