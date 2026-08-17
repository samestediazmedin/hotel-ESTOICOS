import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PricingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find the active rate plan for a room type and plan type.
   * Includes ONLY extras — seasons are now on the RoomType, not the plan.
   * Orders by createdAt asc — first active plan wins (deterministic).
   */
  async findActivePlan(roomTypeId: string, type: string) {
    return this.prisma.ratePlan.findFirst({
      where: { roomTypeId, isActive: true, type },
      include: { extras: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find ALL active rate plans for a room type (used by calculateAllPlans).
   * Ordered by type asc then createdAt asc so the list is deterministic.
   * Includes ONLY extras — seasons fetched once at the room-type level.
   */
  async findActivePlansForRoomType(roomTypeId: string) {
    return this.prisma.ratePlan.findMany({
      where: { roomTypeId, isActive: true },
      include: { extras: true },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findAllRatePlans(roomTypeId?: string) {
    return this.prisma.ratePlan.findMany({
      where: roomTypeId ? { roomTypeId } : undefined,
      include: { extras: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findRatePlanById(id: string) {
    return this.prisma.ratePlan.findUnique({
      where: { id },
      include: { extras: true },
    });
  }

  async createRatePlan(data: {
    name: string;
    type: string;
    roomTypeId: string;
    isActive?: boolean;
    description?: string;
    priceModifier?: number;
  }) {
    return this.prisma.ratePlan.create({ data });
  }

  async updateRatePlan(
    id: string,
    data: Partial<{
      name: string;
      type: string;
      roomTypeId: string;
      isActive: boolean;
      description: string | null;
      priceModifier: number;
    }>,
  ) {
    return this.prisma.ratePlan.update({ where: { id }, data });
  }

  async deactivateRatePlan(id: string) {
    return this.prisma.ratePlan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Season CRUD (keyed by roomTypeId) ────────────────────────────────────

  /**
   * Create a season attached to a room type.
   * All plans for this room type will share this seasonal calendar.
   */
  async createSeason(data: {
    roomTypeId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    multiplier: number;
    minNights?: number;
  }) {
    return this.prisma.season.create({ data });
  }

  async updateSeason(
    id: string,
    data: Partial<{
      name: string;
      startDate: Date;
      endDate: Date;
      multiplier: number;
      minNights: number;
    }>,
  ) {
    return this.prisma.season.update({ where: { id }, data });
  }

  async deleteSeason(id: string) {
    return this.prisma.season.delete({ where: { id } });
  }

  /**
   * Fetch all seasons for a room type, ordered by start date.
   * Used by the pricing engine (called once per calculateAllPlans invocation).
   */
  async findSeasonsByRoomType(roomTypeId: string) {
    return this.prisma.season.findMany({
      where: { roomTypeId },
      orderBy: { startDate: 'asc' },
    });
  }

  // ─── RatePlanExtra CRUD ────────────────────────────────────────────────────

  async findExtrasByPlanId(ratePlanId: string) {
    return this.prisma.ratePlanExtra.findMany({
      where: { ratePlanId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createExtra(data: {
    ratePlanId: string;
    name: string;
    amount: number;
    pricingMode: string;
  }) {
    return this.prisma.ratePlanExtra.create({ data });
  }

  async updateExtra(
    id: string,
    data: Partial<{ name: string; amount: number; pricingMode: string }>,
  ) {
    return this.prisma.ratePlanExtra.update({ where: { id }, data });
  }

  async deleteExtra(id: string) {
    return this.prisma.ratePlanExtra.delete({ where: { id } });
  }
}
