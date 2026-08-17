import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingRepository } from './pricing.repository';
import { SystemConfigService } from '../../system-config/system-config.service';
import {
  PricingInput,
  PricingBreakdown,
  PricingLineItem,
  PricingExtraLineItem,
  RatePlanOption,
} from './dto/pricing-breakdown.dto';
import { SeasonDomain } from './domain/season.entity';
import { CreateRatePlanDto } from './dto/create-rate-plan.dto';
import { UpdateRatePlanDto } from './dto/update-rate-plan.dto';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';

// ─── Private helpers (module-level — no `this` dependency) ───────────────────

/**
 * Find the applicable season for a specific night date.
 * Season interval is half-open: [startDate, endDate).
 * If multiple seasons overlap, returns the one with the HIGHEST multiplier
 * (most conservative revenue choice).
 *
 * Seasons are now sourced from the room type, NOT the rate plan.
 */
function findApplicableSeason(
  seasons: SeasonDomain[],
  date: Date,
): SeasonDomain | null {
  const dateStr = date.toISOString().slice(0, 10);  // "2026-06-01"
  const applicable = seasons.filter((s) => {
    const start =
      s.startDate instanceof Date
        ? s.startDate.toISOString().slice(0, 10)
        : String(s.startDate).slice(0, 10);
    const end =
      s.endDate instanceof Date
        ? s.endDate.toISOString().slice(0, 10)
        : String(s.endDate).slice(0, 10);
    return dateStr >= start && dateStr < end;  // [start, end) half-open
  });
  if (applicable.length === 0) return null;
  // Multiple overlapping seasons: take highest multiplier
  return applicable.reduce((max, s) =>
    Number(s.multiplier) > Number(max.multiplier) ? s : max,
  );
}

/**
 * Find the dominant season for a stay — the one that covers the most nights.
 * Used exclusively for minNights violation checks.
 * Seasons are now sourced from the room type.
 */
function findDominantSeason(
  seasons: SeasonDomain[],
  checkIn: Date,
  checkOut: Date,
): SeasonDomain | null {
  const nights = Math.round(
    (checkOut.getTime() - checkIn.getTime()) / 86_400_000,
  );
  const counts = new Map<string, { season: SeasonDomain; count: number }>();
  for (let i = 0; i < nights; i++) {
    const d = new Date(checkIn);
    d.setUTCDate(d.getUTCDate() + i);
    const s = findApplicableSeason(seasons, d);
    if (s) {
      const entry = counts.get(s.id) ?? { season: s, count: 0 };
      counts.set(s.id, { ...entry, count: entry.count + 1 });
    }
  }
  if (counts.size === 0) return null;
  return [...counts.values()].reduce((max, c) =>
    c.count > max.count ? c : max,
  ).season;
}

/**
 * Compute extra line items for a plan.
 * Extras are FIXED — NOT multiplied by season or planModifier.
 * Breakfast costs the same in December as in August.
 * Each extra's IVA = Math.round(subtotal * ivaRate) — same rounding as room charges.
 */
function computeExtras(
  extras: Array<{ name: string; amount: unknown; pricingMode: string }>,
  nights: number,
  adults: number,
  ivaRate: number,
): PricingExtraLineItem[] {
  return extras.map((extra) => {
    const unitAmount = Math.round(Number(extra.amount));  // Prisma Decimal → integer COP
    let quantity: number;
    switch (extra.pricingMode) {
      case 'PER_NIGHT':
        quantity = nights;
        break;
      case 'PER_PERSON_PER_NIGHT':
        quantity = nights * adults;
        break;
      case 'PER_STAY':
      default:
        quantity = 1;
        break;
    }
    const subtotal = unitAmount * quantity;
    const ivaAmount = Math.round(subtotal * ivaRate);
    return {
      name: extra.name,
      pricingMode: extra.pricingMode,
      unitAmount,
      quantity,
      subtotal,
      ivaAmount,
      total: subtotal + ivaAmount,
    };
  });
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingRepository: PricingRepository,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  // ─── Core calculation ───────────────────────────────────────────────────

  /**
   * Calculate a fully itemized pricing breakdown for a stay.
   * Returns one PricingLineItem per night PLUS extras from the rate plan.
   *
   * PRICING FORMULA (2026-05-29):
   *   nightRate  = Math.round(basePrice × seasonMultiplier × planModifier)
   *   ivaAmount  = Math.round(nightRate × ivaRate)
   *   Extras are FIXED — not multiplied by season or planModifier.
   *   total      = roomTotal + extrasTotal
   *
   * TOTAL SEMANTICS:
   *   total = roomTotal + extrasTotal
   *   For BAR plans (no extras): total === roomTotal (backward compatible).
   *   Night-audit uses breakdown.items[0].nightRate — unaffected.
   *
   * DATE HANDLING: checkIn/checkOut MUST be UTC midnight Dates.
   * Parse HTTP params as: new Date(dateStr + 'T00:00:00.000Z')
   * Use setUTCDate() for iteration — avoids DST edge cases.
   */
  async calculateBreakdown(input: PricingInput): Promise<PricingBreakdown> {
    // 1. Load room type — throws NotFoundException if not found
    const roomType = await this.prisma.roomType.findUniqueOrThrow({
      where: { id: input.roomTypeId },
    });

    // 2. Load active rate plan (includes extras only — seasons are on the room type)
    const ratePlan = await this.pricingRepository.findActivePlan(
      input.roomTypeId,
      input.ratePlanType ?? 'BAR',
    );

    // 3. Load room type's seasons (shared by all plans for this room type)
    const seasons = await this.pricingRepository.findSeasonsByRoomType(
      input.roomTypeId,
    );

    // 4. IVA rate from system config — NEVER hardcoded
    const ivaRate = Number(await this.systemConfigService.getIvaRate());

    // 5. Plan modifier — default 1.0 when no plan (synthetic Base Rate)
    const planModifier = ratePlan ? Number(ratePlan.priceModifier) : 1.0;

    // 6. Build date array — one entry per night (UTC iteration avoids DST)
    const nights = Math.round(
      (input.checkOut.getTime() - input.checkIn.getTime()) / 86_400_000,
    );
    const dates: Date[] = Array.from({ length: nights }, (_, i) => {
      const d = new Date(input.checkIn);
      d.setUTCDate(d.getUTCDate() + i);  // UTC to avoid DST off-by-one
      return d;
    });

    // 7. Map nights to line items
    const base = Number(roomType.basePrice);  // unwrap Prisma Decimal
    const items: PricingLineItem[] = dates.map((date) => {
      const season = findApplicableSeason(seasons, date);
      const multiplier = season ? Number(season.multiplier) : 1.0;
      // Formula: nightRate = round(basePrice × seasonMultiplier × planModifier)
      const nightRate = Math.round(base * multiplier * planModifier);
      const ivaAmount = Math.round(nightRate * ivaRate);
      return {
        date: date.toISOString().slice(0, 10),
        base,
        multiplier,
        planModifier,
        nightRate,
        ivaRate,
        ivaAmount,
        lineTotal: nightRate + ivaAmount,
        seasonName: season?.name ?? null,
      };
    });

    // 8. Check minNights violation (dominant season covers most nights)
    const dominantSeason = findDominantSeason(
      seasons,
      input.checkIn,
      input.checkOut,
    );
    const minNightsViolation =
      dominantSeason && nights < dominantSeason.minNights
        ? {
            required: dominantSeason.minNights,
            actual: nights,
            seasonName: dominantSeason.name,
          }
        : undefined;

    // 9. Compute extras — FIXED amounts, not affected by season or planModifier
    const adults = input.adults ?? 1;
    const extras = computeExtras(ratePlan?.extras ?? [], nights, adults, ivaRate);

    // 10. Aggregate totals
    const subtotal = items.reduce((s, i) => s + i.nightRate, 0);
    const totalIva = items.reduce((s, i) => s + i.ivaAmount, 0);
    const roomTotal = subtotal + totalIva;
    const extrasSubtotal = extras.reduce((s, e) => s + e.subtotal, 0);
    const extrasIva = extras.reduce((s, e) => s + e.ivaAmount, 0);
    const extrasTotal = extrasSubtotal + extrasIva;

    return {
      roomTypeId: input.roomTypeId,
      ratePlanId: ratePlan?.id ?? null,
      nights,
      items,
      subtotal,
      totalIva,
      roomTotal,
      extras,
      extrasSubtotal,
      extrasIva,
      extrasTotal,
      total: roomTotal + extrasTotal,
      currency: 'COP',
      appliedRatePlan: ratePlan?.name ?? 'Base Rate',
      minNightsViolation,
    };
  }

  /**
   * calculateAllPlans — returns one RatePlanOption per active rate plan for the
   * given room type + date range + adults.
   *
   * OPTIMIZATION (2026-05-29): Seasons are fetched ONCE for the room type, then
   * each plan uses the same seasonal calendar with its own priceModifier.
   * Previously, each plan fetched its own seasons — wasteful duplication.
   *
   * If the room type has NO active plan at all, a single synthetic "Base Rate"
   * option is returned (mirrors the no-plan fallback in calculateBreakdown).
   *
   * Used by the public rate-options endpoint so guests can choose their plan.
   * Serialized to the HTTP boundary: all Decimal values must be numbers.
   */
  async calculateAllPlans(input: {
    roomTypeId: string;
    checkIn: Date;
    checkOut: Date;
    adults?: number;
  }): Promise<RatePlanOption[]> {
    const plans = await this.pricingRepository.findActivePlansForRoomType(
      input.roomTypeId,
    );

    if (plans.length === 0) {
      // No plans configured — return synthetic Base Rate (mirrors calculateBreakdown fallback)
      const breakdown = await this.calculateBreakdown({
        roomTypeId: input.roomTypeId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        adults: input.adults,
        ratePlanType: 'BAR',
      });
      return [
        {
          ratePlanId: null,
          ratePlanName: 'Base Rate',
          ratePlanType: 'BASE',
          description: null,
          breakdown,
        },
      ];
    }

    // Run breakdown for each plan in parallel
    const options = await Promise.all(
      plans.map(async (plan): Promise<RatePlanOption> => {
        const ratePlanType = (plan.type === 'BAR' || plan.type === 'PROMO' || plan.type === 'PACKAGE')
          ? (plan.type as 'BAR' | 'PROMO' | 'PACKAGE')
          : 'BAR';
        const breakdown = await this.calculateBreakdown({
          roomTypeId: input.roomTypeId,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          adults: input.adults,
          ratePlanType,
        });
        return {
          ratePlanId: plan.id,
          ratePlanName: plan.name,
          ratePlanType: plan.type,
          description: plan.description ?? null,
          breakdown,
        };
      }),
    );

    return options;
  }

  // ─── Rate Plan CRUD ─────────────────────────────────────────────────────

  /**
   * Normalize a raw Prisma RatePlan row (or null) so that Decimal fields are
   * plain JS numbers at the HTTP boundary.
   *
   * IMPORTANT: Prisma's Decimal type serializes to a STRING in JSON ("1.0000").
   * TypeScript types say `number`, so tsc passes — the bug is only visible at
   * runtime. Always coerce here before the controller returns the object.
   *
   * Affected fields:
   *   RatePlan.priceModifier  — Decimal(5,4)
   *   RatePlanExtra.amount    — Decimal (COP integer stored as Decimal)
   */
  private normalizeRatePlan<
    T extends {
      priceModifier?: unknown;
      extras?: Array<{ amount: unknown } & Record<string, unknown>>;
    } | null,
  >(plan: T): T {
    if (!plan) return plan;
    const normalized: Record<string, unknown> = { ...plan };
    // Only coerce when the field is present — preserve undefined for callers
    // that expect it (e.g. create without an explicit priceModifier).
    if ('priceModifier' in plan) {
      normalized['priceModifier'] = Number(plan.priceModifier);
    }
    if (plan.extras !== undefined) {
      normalized['extras'] = plan.extras.map((e) => ({ ...e, amount: Number(e.amount) }));
    }
    return normalized as T;
  }

  async findAllRatePlans(roomTypeId?: string) {
    const plans = await this.pricingRepository.findAllRatePlans(roomTypeId);
    return plans.map((p) => this.normalizeRatePlan(p));
  }

  async findRatePlanById(id: string) {
    return this.normalizeRatePlan(
      await this.pricingRepository.findRatePlanById(id),
    );
  }

  async createRatePlan(dto: CreateRatePlanDto) {
    return this.normalizeRatePlan(
      await this.pricingRepository.createRatePlan({
        name: dto.name,
        type: dto.type,
        roomTypeId: dto.roomTypeId,
        isActive: dto.isActive ?? true,
        description: dto.description,
        priceModifier: dto.priceModifier,
      }),
    );
  }

  async updateRatePlan(id: string, dto: UpdateRatePlanDto) {
    return this.normalizeRatePlan(
      await this.pricingRepository.updateRatePlan(id, dto),
    );
  }

  // ─── RatePlanExtra CRUD ────────────────────────────────────────────────────

  /**
   * Normalize a raw Prisma RatePlanExtra row so that Decimal fields are plain
   * JS numbers at the HTTP boundary (same rule as normalizeRatePlan above).
   *
   * Affected fields:
   *   RatePlanExtra.amount — Decimal (COP integer stored as Decimal)
   */
  private normalizeExtra<T extends { amount: unknown } | null>(extra: T): T {
    if (!extra) return extra;
    return { ...extra, amount: Number((extra as { amount: unknown }).amount) } as T;
  }

  async findExtrasByPlanId(ratePlanId: string) {
    const extras = await this.pricingRepository.findExtrasByPlanId(ratePlanId);
    return extras.map((e) => this.normalizeExtra(e));
  }

  async createExtra(ratePlanId: string, dto: { name: string; amount: number; pricingMode: string }) {
    return this.normalizeExtra(
      await this.pricingRepository.createExtra({ ratePlanId, ...dto }),
    );
  }

  updateExtra(
    extraId: string,
    dto: Partial<{ name: string; amount: number; pricingMode: string }>,
  ) {
    return this.pricingRepository.updateExtra(extraId, dto);
  }

  deleteExtra(extraId: string) {
    return this.pricingRepository.deleteExtra(extraId);
  }

  async deactivateRatePlan(id: string) {
    return this.normalizeRatePlan(
      await this.pricingRepository.deactivateRatePlan(id),
    );
  }

  // ─── Season CRUD (keyed by roomTypeId) ─────────────────────────────────

  // ─── Season response mapper ─────────────────────────────────────────────────

  /**
   * Map a raw Prisma Season row to the HTTP response shape.
   *
   * Two serialisation hazards are fixed here at the API boundary — exactly the
   * same class of fix applied to offers (validFrom/validTo) and rate-plans
   * (priceModifier):
   *
   *  1. `startDate` / `endDate` — Prisma `@db.Date` fields serialise to a full
   *     ISO datetime string ("2026-05-28T00:00:00.000Z") in JSON.
   *     The frontend `formatDisplayDate` and `SeasonDrawer` both expect a bare
   *     "YYYY-MM-DD" string and do `new Date(iso + 'T12:00:00.000Z')` — which
   *     would produce "2026-05-28T00:00:00.000ZT12:00:00.000Z" → Invalid Date.
   *     Fix: `.toISOString().slice(0, 10)`.  Safe because these dates are always
   *     stored as midnight-UTC (`new Date(ymd + 'T00:00:00.000Z')`).
   *
   *  2. `multiplier` — Prisma `Decimal` serialises as a string ("1.2500") in JSON.
   *     TypeScript types claim `number` so tsc is happy at compile time; the bug
   *     is runtime-only (same pattern as RatePlan.priceModifier incident).
   *     Fix: `Number(row.multiplier)`.
   */
  private toSeasonResponse(s: {
    id: string;
    roomTypeId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    multiplier: unknown;
    minNights: number;
    createdAt: Date;
  }): {
    id: string;
    roomTypeId: string;
    name: string;
    startDate: string;
    endDate: string;
    multiplier: number;
    minNights: number;
    createdAt: string;
  } {
    return {
      id: s.id,
      roomTypeId: s.roomTypeId,
      name: s.name,
      // Slice to "YYYY-MM-DD" — midnight-UTC dates are safe with toISOString()
      startDate: s.startDate.toISOString().slice(0, 10),
      endDate: s.endDate.toISOString().slice(0, 10),
      // Coerce Decimal → number (same boundary discipline as priceModifier)
      multiplier: Number(s.multiplier),
      minNights: s.minNights,
      createdAt: s.createdAt.toISOString(),
    };
  }

  /**
   * Create a season for a room type. Validates that endDate > startDate.
   * Date strings from DTO are "YYYY-MM-DD" — parsed as UTC midnight.
   */
  async createSeason(dto: CreateSeasonDto) {
    const startDate = new Date(dto.startDate + 'T00:00:00.000Z');
    const endDate = new Date(dto.endDate + 'T00:00:00.000Z');
    if (endDate <= startDate) {
      throw new BadRequestException(
        'endDate must be after startDate',
      );
    }
    const season = await this.pricingRepository.createSeason({
      roomTypeId: dto.roomTypeId,
      name: dto.name,
      startDate,
      endDate,
      multiplier: dto.multiplier,
      minNights: dto.minNights ?? 1,
    });
    return this.toSeasonResponse(season);
  }

  async findSeasonsByRoomType(roomTypeId: string) {
    const seasons = await this.pricingRepository.findSeasonsByRoomType(roomTypeId);
    return seasons.map((s) => this.toSeasonResponse(s));
  }

  async updateSeason(id: string, dto: UpdateSeasonDto) {
    const data: Parameters<typeof this.pricingRepository.updateSeason>[1] = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.multiplier !== undefined) data.multiplier = dto.multiplier;
    if (dto.minNights !== undefined) data.minNights = dto.minNights;
    if (dto.startDate !== undefined) {
      data.startDate = new Date(dto.startDate + 'T00:00:00.000Z');
    }
    if (dto.endDate !== undefined) {
      data.endDate = new Date(dto.endDate + 'T00:00:00.000Z');
    }
    const season = await this.pricingRepository.updateSeason(id, data);
    return this.toSeasonResponse(season);
  }

  deleteSeason(id: string) {
    return this.pricingRepository.deleteSeason(id);
  }
}
