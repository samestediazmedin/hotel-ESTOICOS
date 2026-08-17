import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { PricingRepository } from './pricing.repository';
import { SystemConfigService } from '../../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateRatePlanDto } from './dto/create-rate-plan.dto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse ISO date as UTC midnight — same as API does. Avoids timezone shifts. */
const mkDate = (iso: string) => new Date(iso + 'T00:00:00.000Z');

/**
 * Build a minimal season object.
 * NOTE: seasons are now keyed by roomTypeId, not ratePlanId.
 */
function mkSeason(
  id: string,
  name: string,
  startIso: string,
  endIso: string,
  multiplier: number,
  minNights = 1,
) {
  return {
    id,
    name,
    startDate: mkDate(startIso),
    endDate: mkDate(endIso),
    multiplier,   // plain number — service calls Number() so both work
    minNights,
    roomTypeId: 'rt-1',  // seasons now belong to room type
    createdAt: new Date(),
  };
}

/** Build a RatePlanExtra stub. */
function mkExtra(
  id: string,
  name: string,
  amount: number,
  pricingMode: string,
) {
  return { id, ratePlanId: 'rp-1', name, amount, pricingMode, createdAt: new Date() };
}

/**
 * Build a RatePlan stub — NO seasons (seasons are on the room type now).
 * priceModifier defaults to 1.0 (no adjustment).
 */
function mkPlan(
  extras: ReturnType<typeof mkExtra>[] = [],
  overrides: Partial<{
    id: string;
    name: string;
    type: string;
    description: string | null;
    priceModifier: number;
  }> = {},
) {
  return {
    id: overrides.id ?? 'rp-1',
    name: overrides.name ?? 'Tarifa BAR',
    type: overrides.type ?? 'BAR',
    roomTypeId: 'rt-1',
    isActive: true,
    description: overrides.description ?? null,
    priceModifier: overrides.priceModifier ?? 1.0,
    createdAt: new Date(),
    updatedAt: new Date(),
    extras,
    rules: [],
  };
}

/** Build a RoomType stub with given basePrice. */
function mkRoomType(basePrice: number) {
  return {
    id: 'rt-1',
    name: 'Suite Ejecutiva',
    description: 'Vista panorámica',
    basePrice,         // plain number — service calls Number() so both work
    maxOccupancy: 2,
    amenities: ['WiFi'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('PricingService.calculateBreakdown', () => {
  let service: PricingService;
  let pricingRepo: {
    findActivePlan: ReturnType<typeof vi.fn>;
    findActivePlansForRoomType: ReturnType<typeof vi.fn>;
    findSeasonsByRoomType: ReturnType<typeof vi.fn>;
  };
  let systemConfig: { getIvaRate: ReturnType<typeof vi.fn> };
  let prismaMock: { roomType: { findUniqueOrThrow: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    prismaMock = {
      roomType: { findUniqueOrThrow: vi.fn() },
    };
    pricingRepo = {
      findActivePlan: vi.fn(),
      findActivePlansForRoomType: vi.fn(),
      findSeasonsByRoomType: vi.fn().mockResolvedValue([]),  // default: no seasons
    };
    systemConfig = { getIvaRate: vi.fn().mockResolvedValue(0.19) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PricingRepository, useValue: pricingRepo },
        { provide: SystemConfigService, useValue: systemConfig },
      ],
    }).compile();

    service = module.get(PricingService);
  });

  // ── Test 1: 1-night, no season ─────────────────────────────────────────────

  it('Test 1 — 1-night no season: correct COP arithmetic', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    pricingRepo.findActivePlan.mockResolvedValue(null);  // no active plan
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);

    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-06-01'),
      checkOut: mkDate('2026-06-02'),
    });

    expect(result.nights).toBe(1);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.multiplier).toBe(1.0);
    expect(item.planModifier).toBe(1.0);  // no plan → default modifier
    expect(item.nightRate).toBe(200000);
    expect(item.ivaAmount).toBe(38000);  // Math.round(200000 * 0.19)
    expect(item.lineTotal).toBe(238000);
    expect(result.subtotal).toBe(200000);
    expect(result.totalIva).toBe(38000);
    expect(result.roomTotal).toBe(238000);
    expect(result.total).toBe(238000);   // no extras → grand total = room total
    expect(result.extrasSubtotal).toBe(0);
    expect(result.extrasIva).toBe(0);
    expect(result.extrasTotal).toBe(0);
    expect(result.extras).toHaveLength(0);
    expect(result.ratePlanId).toBeNull();
    expect(result.appliedRatePlan).toBe('Base Rate');
  });

  // ── Test 2: 3-night, same LOW season (sourced from room type) ─────────────

  it('Test 2 — 3-night LOW season (room-type seasons): multiplier applied to all nights', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(150000));
    const lowSeason = mkSeason('s-1', 'LOW', '2026-06-01', '2026-06-30', 0.85);
    pricingRepo.findActivePlan.mockResolvedValue(mkPlan([], { type: 'BAR' }));
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([lowSeason]);
    systemConfig.getIvaRate.mockResolvedValue(0.19);

    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-06-01'),
      checkOut: mkDate('2026-06-04'),
    });

    expect(result.items).toHaveLength(3);
    for (const item of result.items) {
      expect(item.multiplier).toBe(0.85);
      expect(item.planModifier).toBe(1.0);  // BAR plan — no modifier
    }
    // nightRate = round(150000 * 0.85 * 1.0) = 127500
    expect(result.items[0].nightRate).toBe(Math.round(150000 * 0.85));  // 127500
    expect(result.subtotal).toBe(3 * 127500);  // 382500
  });

  // ── Test 3: Stay spans season boundary ────────────────────────────────────

  it('Test 3 — cross-season stay: different multipliers for crossing nights', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(150000));
    const lowSeason  = mkSeason('s-low',  'LOW',  '2026-06-01', '2026-06-15', 0.85);
    const highSeason = mkSeason('s-high', 'HIGH', '2026-06-15', '2026-06-30', 1.25);
    pricingRepo.findActivePlan.mockResolvedValue(mkPlan([], { type: 'BAR' }));
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([lowSeason, highSeason]);

    // 3 nights: Jun 13, Jun 14 → LOW; Jun 15 → HIGH
    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-06-13'),
      checkOut: mkDate('2026-06-16'),
    });

    expect(result.items).toHaveLength(3);
    expect(result.items[0].seasonName).toBe('LOW');
    expect(result.items[1].seasonName).toBe('LOW');
    expect(result.items[2].seasonName).toBe('HIGH');
    expect(result.items[2].multiplier).toBe(1.25);
  });

  // ── Test 4: Exact season boundary ─────────────────────────────────────────

  it('Test 4 — boundary: checkOut date is NOT a charged night', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    // Season June 1 to June 3 — half-open [Jun 1, Jun 3)
    const season = mkSeason('s-1', 'MID', '2026-06-01', '2026-06-03', 1.0);
    pricingRepo.findActivePlan.mockResolvedValue(mkPlan([], { type: 'BAR' }));
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([season]);

    // checkIn Jun 1, checkOut Jun 3 = 2 nights
    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-06-01'),
      checkOut: mkDate('2026-06-03'),
    });

    expect(result.nights).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[1].date).toBe('2026-06-02');  // last charged night
  });

  // ── Test 5: minNights violation ────────────────────────────────────────────

  it('Test 5 — minNights violation: informational, does not block calculation', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    const season = mkSeason('s-1', 'HIGH', '2026-07-01', '2026-07-31', 1.25, 3);
    pricingRepo.findActivePlan.mockResolvedValue(mkPlan([], { type: 'BAR' }));
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([season]);

    // 1-night stay in a HIGH season that requires 3 nights
    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-10'),
      checkOut: mkDate('2026-07-11'),
    });

    expect(result.minNightsViolation).toBeDefined();
    expect(result.minNightsViolation!.required).toBe(3);
    expect(result.minNightsViolation!.actual).toBe(1);
    expect(result.minNightsViolation!.seasonName).toBe('HIGH');
    // Calculation still completes — items are returned
    expect(result.items).toHaveLength(1);
  });

  // ── Test 6: No active rate plan → base rate fallback ──────────────────────

  it('Test 6 — no active plan: falls back to base rate (multiplier 1.0, planModifier 1.0)', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(300000));
    pricingRepo.findActivePlan.mockResolvedValue(null);
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);

    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-08-01'),
      checkOut: mkDate('2026-08-03'),
    });

    expect(result.ratePlanId).toBeNull();
    expect(result.appliedRatePlan).toBe('Base Rate');
    for (const item of result.items) {
      expect(item.multiplier).toBe(1.0);
      expect(item.planModifier).toBe(1.0);
    }
  });

  // ── Test 7: IVA rate = 0 ──────────────────────────────────────────────────

  it('Test 7 — IVA rate zero: no tax applied', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    pricingRepo.findActivePlan.mockResolvedValue(null);
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);
    systemConfig.getIvaRate.mockResolvedValue(0);

    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-06-01'),
      checkOut: mkDate('2026-06-03'),
    });

    for (const item of result.items) {
      expect(item.ivaAmount).toBe(0);
      expect(item.lineTotal).toBe(item.nightRate);
    }
    expect(result.totalIva).toBe(0);
    expect(result.total).toBe(result.subtotal);
  });

  // ── Test 8: Floating-point precision ─────────────────────────────────────

  it('Test 8 — large COP amount: Math.round prevents float artifacts', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(1500000));
    const season = mkSeason('s-1', 'HIGH', '2026-06-01', '2026-06-30', 1.25);
    pricingRepo.findActivePlan.mockResolvedValue(mkPlan([], { type: 'BAR' }));
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([season]);

    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-06-01'),
      checkOut: mkDate('2026-06-02'),
    });

    // nightRate = round(1500000 * 1.25 * 1.0) = 1875000
    expect(result.items[0].nightRate).toBe(1875000);
    expect(Number.isInteger(result.items[0].nightRate)).toBe(true);
    expect(Number.isInteger(result.items[0].ivaAmount)).toBe(true);
    expect(Number.isInteger(result.items[0].lineTotal)).toBe(true);
  });

  // ── Test 9: PER_STAY extra ────────────────────────────────────────────────

  it('Test 9 — PER_STAY extra: quantity=1 regardless of nights/adults', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    const extra = mkExtra('ex-1', 'Transfer aeropuerto', 50000, 'PER_STAY');
    pricingRepo.findActivePlan.mockResolvedValue(
      mkPlan([extra], { type: 'PACKAGE', name: 'Todo Incluido' }),
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);
    systemConfig.getIvaRate.mockResolvedValue(0.19);

    // 3 nights, 2 adults — PER_STAY should not multiply
    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-04'),
      adults: 2,
    });

    expect(result.extras).toHaveLength(1);
    const e = result.extras[0];
    expect(e.pricingMode).toBe('PER_STAY');
    expect(e.quantity).toBe(1);
    expect(e.subtotal).toBe(50000);
    expect(e.ivaAmount).toBe(Math.round(50000 * 0.19));  // 9500
    expect(e.total).toBe(50000 + 9500);                  // 59500
  });

  // ── Test 10: PER_NIGHT extra ─────────────────────────────────────────────

  it('Test 10 — PER_NIGHT extra: quantity = nights', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    const extra = mkExtra('ex-2', 'Desayuno', 30000, 'PER_NIGHT');
    pricingRepo.findActivePlan.mockResolvedValue(
      mkPlan([extra], { type: 'PACKAGE', name: 'Desayuno Incluido' }),
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);
    systemConfig.getIvaRate.mockResolvedValue(0.19);

    // 3 nights, 1 adult
    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-04'),
      adults: 1,
    });

    const e = result.extras[0];
    expect(e.pricingMode).toBe('PER_NIGHT');
    expect(e.quantity).toBe(3);
    expect(e.subtotal).toBe(90000);  // 30000 * 3
    expect(e.ivaAmount).toBe(Math.round(90000 * 0.19));  // 17100
  });

  // ── Test 11: PER_PERSON_PER_NIGHT extra ──────────────────────────────────

  it('Test 11 — PER_PERSON_PER_NIGHT extra: quantity = nights × adults', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    const extra = mkExtra('ex-3', 'Spa por persona', 40000, 'PER_PERSON_PER_NIGHT');
    pricingRepo.findActivePlan.mockResolvedValue(
      mkPlan([extra], { type: 'PACKAGE', name: 'Spa Package' }),
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);
    systemConfig.getIvaRate.mockResolvedValue(0.19);

    // 2 nights, 3 adults
    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-03'),
      adults: 3,
    });

    const e = result.extras[0];
    expect(e.pricingMode).toBe('PER_PERSON_PER_NIGHT');
    expect(e.quantity).toBe(6);           // 2 nights × 3 adults
    expect(e.subtotal).toBe(240000);      // 40000 × 6
    expect(e.ivaAmount).toBe(Math.round(240000 * 0.19));  // 45600
  });

  // ── Test 12: extras IVA — each extra taxed at same rate as room ───────────

  it('Test 12 — extras IVA: each extra IVA = Math.round(subtotal * ivaRate)', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    const extras = [
      mkExtra('ex-1', 'Desayuno', 30000, 'PER_NIGHT'),
      mkExtra('ex-2', 'Transfer', 50000, 'PER_STAY'),
    ];
    pricingRepo.findActivePlan.mockResolvedValue(
      mkPlan(extras, { type: 'PACKAGE' }),
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);
    systemConfig.getIvaRate.mockResolvedValue(0.19);

    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-03'),
      adults: 1,
    });

    // Desayuno: 30000 * 2 = 60000 pre-tax, IVA = Math.round(60000 * 0.19) = 11400
    expect(result.extras[0].subtotal).toBe(60000);
    expect(result.extras[0].ivaAmount).toBe(11400);
    // Transfer: 50000 * 1 = 50000 pre-tax, IVA = Math.round(50000 * 0.19) = 9500
    expect(result.extras[1].subtotal).toBe(50000);
    expect(result.extras[1].ivaAmount).toBe(9500);
  });

  // ── Test 13: total = roomTotal + extrasTotal ──────────────────────────────

  it('Test 13 — total = roomTotal + extrasTotal', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    const extra = mkExtra('ex-1', 'Desayuno', 30000, 'PER_NIGHT');
    pricingRepo.findActivePlan.mockResolvedValue(
      mkPlan([extra], { type: 'PACKAGE' }),
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);
    systemConfig.getIvaRate.mockResolvedValue(0.19);

    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-03'),
      adults: 1,
    });

    expect(result.total).toBe(result.roomTotal + result.extrasTotal);
    // Verify individual pieces are consistent
    expect(result.extrasSubtotal + result.extrasIva).toBe(result.extrasTotal);
    expect(result.subtotal + result.totalIva).toBe(result.roomTotal);
  });

  // ── Test 14: BAR with no extras — total unchanged (regression) ────────────

  it('Test 14 — BAR plan no extras: total = subtotal + totalIva (regression)', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    pricingRepo.findActivePlan.mockResolvedValue(mkPlan([], { type: 'BAR' }));
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);

    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-06-01'),
      checkOut: mkDate('2026-06-03'),
    });

    expect(result.extras).toHaveLength(0);
    expect(result.extrasTotal).toBe(0);
    expect(result.total).toBe(result.subtotal + result.totalIva);
    expect(result.total).toBe(result.roomTotal);
  });

  // ── Test 15: adults defaults to 1 for PER_PERSON_PER_NIGHT ───────────────

  it('Test 15 — adults omitted: defaults to 1 for PER_PERSON_PER_NIGHT', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    const extra = mkExtra('ex-1', 'Spa', 40000, 'PER_PERSON_PER_NIGHT');
    pricingRepo.findActivePlan.mockResolvedValue(
      mkPlan([extra], { type: 'PACKAGE' }),
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);

    // No adults field passed
    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-03'),  // 2 nights
    });

    // adults = 1 (default), quantity = 2 * 1 = 2
    expect(result.extras[0].quantity).toBe(2);
  });

  // ── Test 16: PROMO plan with priceModifier = 0.85 ─────────────────────────

  it('Test 16 — PROMO plan: priceModifier 0.85 reduces nightRate vs BAR', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    pricingRepo.findActivePlan.mockResolvedValue(
      mkPlan([], { type: 'PROMO', name: 'Tarifa PROMO', priceModifier: 0.85 }),
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);

    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-06-01'),
      checkOut: mkDate('2026-06-02'),
    });

    // nightRate = round(200000 * 1.0 * 0.85) = 170000
    expect(result.items[0].planModifier).toBe(0.85);
    expect(result.items[0].multiplier).toBe(1.0);   // no season
    expect(result.items[0].nightRate).toBe(Math.round(200000 * 0.85));  // 170000
  });

  // ── Test 17: season multiplier × plan modifier combined ───────────────────

  it('Test 17 — season × planModifier: both multipliers applied to nightRate', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    const highSeason = mkSeason('s-1', 'HIGH', '2026-12-01', '2026-12-31', 1.3);
    pricingRepo.findActivePlan.mockResolvedValue(
      mkPlan([], { type: 'PROMO', priceModifier: 0.9 }),
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([highSeason]);

    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-12-10'),
      checkOut: mkDate('2026-12-11'),
    });

    // nightRate = round(200000 * 1.3 * 0.9) = round(234000) = 234000
    const expected = Math.round(200000 * 1.3 * 0.9);
    expect(result.items[0].multiplier).toBe(1.3);
    expect(result.items[0].planModifier).toBe(0.9);
    expect(result.items[0].nightRate).toBe(expected);
  });

  // ── Test 18: extras are FIXED — not multiplied by season or planModifier ──

  it('Test 18 — extras are FIXED: season and planModifier do NOT affect extra amounts', async () => {
    prismaMock.roomType.findUniqueOrThrow.mockResolvedValue(mkRoomType(200000));
    const highSeason = mkSeason('s-1', 'HIGH', '2026-12-01', '2026-12-31', 1.5);
    const extra = mkExtra('ex-1', 'Desayuno', 30000, 'PER_NIGHT');
    pricingRepo.findActivePlan.mockResolvedValue(
      mkPlan([extra], { type: 'PACKAGE', priceModifier: 1.2 }),
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([highSeason]);

    const result = await service.calculateBreakdown({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-12-10'),
      checkOut: mkDate('2026-12-12'),  // 2 nights
      adults: 1,
    });

    // Room: round(200000 * 1.5 * 1.2) = round(360000) = 360000 per night
    expect(result.items[0].nightRate).toBe(Math.round(200000 * 1.5 * 1.2));

    // Extra: 30000 PER_NIGHT × 2 nights — NOT affected by season or planModifier
    expect(result.extras[0].unitAmount).toBe(30000);
    expect(result.extras[0].quantity).toBe(2);
    expect(result.extras[0].subtotal).toBe(60000);  // 30000 * 2, flat
  });
});

// ─── calculateAllPlans ────────────────────────────────────────────────────────

describe('PricingService.calculateAllPlans', () => {
  let service: PricingService;
  let pricingRepo: {
    findActivePlan: ReturnType<typeof vi.fn>;
    findActivePlansForRoomType: ReturnType<typeof vi.fn>;
    findSeasonsByRoomType: ReturnType<typeof vi.fn>;
  };
  let systemConfig: { getIvaRate: ReturnType<typeof vi.fn> };
  let prismaMock: { roomType: { findUniqueOrThrow: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    prismaMock = {
      roomType: { findUniqueOrThrow: vi.fn().mockResolvedValue(mkRoomType(200000)) },
    };
    pricingRepo = {
      findActivePlan: vi.fn(),
      findActivePlansForRoomType: vi.fn(),
      findSeasonsByRoomType: vi.fn().mockResolvedValue([]),
    };
    systemConfig = { getIvaRate: vi.fn().mockResolvedValue(0.19) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PricingRepository, useValue: pricingRepo },
        { provide: SystemConfigService, useValue: systemConfig },
      ],
    }).compile();

    service = module.get(PricingService);
  });

  // ── CAP-1: one option per active plan ────────────────────────────────────

  it('CAP-1 — returns one RatePlanOption per active plan', async () => {
    const bar = mkPlan([], { id: 'rp-bar', type: 'BAR', name: 'Tarifa BAR' });
    const pkg = mkPlan([mkExtra('ex-1', 'Desayuno', 30000, 'PER_NIGHT')], {
      id: 'rp-pkg',
      type: 'PACKAGE',
      name: 'Desayuno Incluido',
      description: 'Incluye desayuno',
    });
    pricingRepo.findActivePlansForRoomType.mockResolvedValue([bar, pkg]);

    // calculateAllPlans calls calculateBreakdown per plan → calls findActivePlan
    pricingRepo.findActivePlan.mockImplementation(
      (_roomTypeId: string, type: string) => {
        if (type === 'BAR') return Promise.resolve(bar);
        if (type === 'PACKAGE') return Promise.resolve(pkg);
        return Promise.resolve(null);
      },
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);

    const result = await service.calculateAllPlans({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-03'),
      adults: 2,
    });

    expect(result).toHaveLength(2);
    expect(result[0].ratePlanId).toBe('rp-bar');
    expect(result[0].ratePlanType).toBe('BAR');
    expect(result[1].ratePlanId).toBe('rp-pkg');
    expect(result[1].ratePlanType).toBe('PACKAGE');
    expect(result[1].description).toBe('Incluye desayuno');
  });

  // ── CAP-2: synthetic Base Rate when no plans ──────────────────────────────

  it('CAP-2 — returns synthetic Base Rate when room type has no active plans', async () => {
    pricingRepo.findActivePlansForRoomType.mockResolvedValue([]);
    pricingRepo.findActivePlan.mockResolvedValue(null);
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);

    const result = await service.calculateAllPlans({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-02'),
    });

    expect(result).toHaveLength(1);
    expect(result[0].ratePlanId).toBeNull();
    expect(result[0].ratePlanName).toBe('Base Rate');
    expect(result[0].ratePlanType).toBe('BASE');
    expect(result[0].description).toBeNull();
  });

  // ── CAP-3: breakdown structure valid on each option ───────────────────────

  it('CAP-3 — each option breakdown has consistent total = roomTotal + extrasTotal', async () => {
    const plan = mkPlan(
      [mkExtra('ex-1', 'Spa', 40000, 'PER_PERSON_PER_NIGHT')],
      { type: 'PACKAGE', id: 'rp-1' },
    );
    pricingRepo.findActivePlansForRoomType.mockResolvedValue([plan]);
    pricingRepo.findActivePlan.mockResolvedValue(plan);
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);

    const result = await service.calculateAllPlans({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-03'),
      adults: 2,
    });

    const bd = result[0].breakdown;
    expect(bd.total).toBe(bd.roomTotal + bd.extrasTotal);
  });

  // ── CAP-4: BAR plan in calculateAllPlans — no extras regression ──────────

  it('CAP-4 — BAR plan via calculateAllPlans has extrasTotal = 0', async () => {
    const bar = mkPlan([], { type: 'BAR', id: 'rp-bar' });
    pricingRepo.findActivePlansForRoomType.mockResolvedValue([bar]);
    pricingRepo.findActivePlan.mockResolvedValue(bar);
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);

    const result = await service.calculateAllPlans({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-02'),
    });

    expect(result[0].breakdown.extrasTotal).toBe(0);
    expect(result[0].breakdown.extras).toHaveLength(0);
  });

  // ── CAP-5: PROMO plan in calculateAllPlans has reduced rate vs BAR ─────────

  it('CAP-5 — PROMO planModifier 0.85 in calculateAllPlans gives cheaper rate than BAR', async () => {
    const bar = mkPlan([], { id: 'rp-bar', type: 'BAR', name: 'Tarifa BAR', priceModifier: 1.0 });
    const promo = mkPlan([], {
      id: 'rp-promo', type: 'PROMO', name: 'Tarifa PROMO', priceModifier: 0.85,
    });
    pricingRepo.findActivePlansForRoomType.mockResolvedValue([bar, promo]);
    pricingRepo.findActivePlan.mockImplementation(
      (_roomTypeId: string, type: string) => {
        if (type === 'BAR') return Promise.resolve(bar);
        if (type === 'PROMO') return Promise.resolve(promo);
        return Promise.resolve(null);
      },
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);

    const result = await service.calculateAllPlans({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-02'),
    });

    const barOption = result.find(r => r.ratePlanType === 'BAR')!;
    const promoOption = result.find(r => r.ratePlanType === 'PROMO')!;

    expect(promoOption.breakdown.total).toBeLessThan(barOption.breakdown.total);
    expect(promoOption.breakdown.items[0].planModifier).toBe(0.85);
  });

  // ── CAP-6: seasons loaded once — shared by all plans in calculateAllPlans ──

  it('CAP-6 — findSeasonsByRoomType called per calculateBreakdown invocation (once per plan)', async () => {
    const bar = mkPlan([], { id: 'rp-bar', type: 'BAR' });
    const promo = mkPlan([], { id: 'rp-promo', type: 'PROMO', priceModifier: 0.9 });
    pricingRepo.findActivePlansForRoomType.mockResolvedValue([bar, promo]);
    pricingRepo.findActivePlan.mockImplementation(
      (_roomTypeId: string, type: string) => {
        if (type === 'BAR') return Promise.resolve(bar);
        if (type === 'PROMO') return Promise.resolve(promo);
        return Promise.resolve(null);
      },
    );
    pricingRepo.findSeasonsByRoomType.mockResolvedValue([]);

    await service.calculateAllPlans({
      roomTypeId: 'rt-1',
      checkIn: mkDate('2026-07-01'),
      checkOut: mkDate('2026-07-02'),
    });

    // Each plan triggers one calculateBreakdown call → one findSeasonsByRoomType call
    expect(pricingRepo.findSeasonsByRoomType).toHaveBeenCalledWith('rt-1');
  });
});

// ─── RatePlan description + priceModifier + Extras CRUD ──────────────────────

describe('PricingService — extras CRUD + description + priceModifier', () => {
  let service: PricingService;
  let repo: {
    createRatePlan: ReturnType<typeof vi.fn>;
    updateRatePlan: ReturnType<typeof vi.fn>;
    findAllRatePlans: ReturnType<typeof vi.fn>;
    findRatePlanById: ReturnType<typeof vi.fn>;
    findExtrasByPlanId: ReturnType<typeof vi.fn>;
    createExtra: ReturnType<typeof vi.fn>;
    updateExtra: ReturnType<typeof vi.fn>;
    deleteExtra: ReturnType<typeof vi.fn>;
    findActivePlan: ReturnType<typeof vi.fn>;
    findActivePlansForRoomType: ReturnType<typeof vi.fn>;
    findSeasonsByRoomType: ReturnType<typeof vi.fn>;
    createSeason: ReturnType<typeof vi.fn>;
    updateSeason: ReturnType<typeof vi.fn>;
    deleteSeason: ReturnType<typeof vi.fn>;
  };
  let prismaMock: { roomType: { findUniqueOrThrow: ReturnType<typeof vi.fn> } };
  let systemConfig: { getIvaRate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prismaMock = { roomType: { findUniqueOrThrow: vi.fn() } };
    repo = {
      createRatePlan: vi.fn(),
      updateRatePlan: vi.fn(),
      findAllRatePlans: vi.fn().mockResolvedValue([]),
      findRatePlanById: vi.fn().mockResolvedValue(null),
      findExtrasByPlanId: vi.fn(),
      createExtra: vi.fn(),
      updateExtra: vi.fn(),
      deleteExtra: vi.fn(),
      findActivePlan: vi.fn(),
      findActivePlansForRoomType: vi.fn(),
      findSeasonsByRoomType: vi.fn().mockResolvedValue([]),
      createSeason: vi.fn(),
      updateSeason: vi.fn(),
      deleteSeason: vi.fn(),
    };
    systemConfig = { getIvaRate: vi.fn().mockResolvedValue(0.19) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PricingRepository, useValue: repo },
        { provide: SystemConfigService, useValue: systemConfig },
      ],
    }).compile();

    service = module.get(PricingService);
  });

  // ── DESC-1: createRatePlan forwards description to repository ─────────────

  it('DESC-1 — createRatePlan: description forwarded to repository', async () => {
    const expected = { id: 'rp-new', name: 'Paquete', description: 'Incluye desayuno y spa' };
    repo.createRatePlan.mockResolvedValue(expected);

    const dto: CreateRatePlanDto = {
      name: 'Paquete',
      type: 'PACKAGE',
      roomTypeId: 'cabcdefghijklmnopqrstuvwxy',
      description: 'Incluye desayuno y spa',
    };

    const result = await service.createRatePlan(dto);

    expect(repo.createRatePlan).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Incluye desayuno y spa' }),
    );
    expect(result).toEqual(expected);
  });

  // ── DESC-2: createRatePlan without description passes undefined ───────────

  it('DESC-2 — createRatePlan: omitted description not passed as null', async () => {
    repo.createRatePlan.mockResolvedValue({ id: 'rp-1' });

    const dto: CreateRatePlanDto = {
      name: 'BAR Plan',
      type: 'BAR',
      roomTypeId: 'cabcdefghijklmnopqrstuvwxy',
    };

    await service.createRatePlan(dto);

    const callArg = repo.createRatePlan.mock.calls[0][0] as Record<string, unknown>;
    // description may be undefined (not explicitly set) — it should NOT be 'some garbage'
    expect(callArg.description).toBeUndefined();
  });

  // ── MOD-1: createRatePlan forwards priceModifier ──────────────────────────

  it('MOD-1 — createRatePlan: priceModifier forwarded to repository', async () => {
    repo.createRatePlan.mockResolvedValue({ id: 'rp-promo', priceModifier: 0.85 });

    const dto: CreateRatePlanDto = {
      name: 'Tarifa PROMO',
      type: 'PROMO',
      roomTypeId: 'cabcdefghijklmnopqrstuvwxy',
      priceModifier: 0.85,
    };

    await service.createRatePlan(dto);

    expect(repo.createRatePlan).toHaveBeenCalledWith(
      expect.objectContaining({ priceModifier: 0.85 }),
    );
  });

  // ── MOD-2: createRatePlan without priceModifier passes undefined ──────────

  it('MOD-2 — createRatePlan: omitted priceModifier passes undefined (DB default 1.0 applies)', async () => {
    repo.createRatePlan.mockResolvedValue({ id: 'rp-1', priceModifier: 1.0 });

    const dto: CreateRatePlanDto = {
      name: 'BAR Plan',
      type: 'BAR',
      roomTypeId: 'cabcdefghijklmnopqrstuvwxy',
    };

    await service.createRatePlan(dto);

    const callArg = repo.createRatePlan.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg.priceModifier).toBeUndefined();
  });

  // ── EXTRA-1: findExtrasByPlanId delegates to repository ───────────────────

  it('EXTRA-1 — findExtrasByPlanId: delegates to repository with ratePlanId', async () => {
    const extras = [mkExtra('ex-1', 'Desayuno', 30000, 'PER_NIGHT')];
    repo.findExtrasByPlanId.mockResolvedValue(extras);

    const result = await service.findExtrasByPlanId('rp-1');

    expect(repo.findExtrasByPlanId).toHaveBeenCalledWith('rp-1');
    expect(result).toEqual(extras);
  });

  // ── EXTRA-2: createExtra delegates to repository ──────────────────────────

  it('EXTRA-2 — createExtra: delegates to repository with ratePlanId + dto', async () => {
    const created = { id: 'ex-new', ratePlanId: 'rp-1', name: 'Spa', amount: 80000, pricingMode: 'PER_STAY' };
    repo.createExtra.mockResolvedValue(created);

    const result = await service.createExtra('rp-1', {
      name: 'Spa',
      amount: 80000,
      pricingMode: 'PER_STAY',
    });

    expect(repo.createExtra).toHaveBeenCalledWith({
      ratePlanId: 'rp-1',
      name: 'Spa',
      amount: 80000,
      pricingMode: 'PER_STAY',
    });
    expect(result).toEqual(created);
  });

  // ── EXTRA-3: updateExtra delegates partial update to repository ───────────

  it('EXTRA-3 — updateExtra: partial update forwarded to repository', async () => {
    const updated = { id: 'ex-1', name: 'Desayuno buffet', amount: 35000, pricingMode: 'PER_NIGHT' };
    repo.updateExtra.mockResolvedValue(updated);

    const result = await service.updateExtra('ex-1', { amount: 35000 });

    expect(repo.updateExtra).toHaveBeenCalledWith('ex-1', { amount: 35000 });
    expect(result).toEqual(updated);
  });

  // ── EXTRA-4: deleteExtra delegates to repository ──────────────────────────

  it('EXTRA-4 — deleteExtra: delegates to repository with extraId', async () => {
    repo.deleteExtra.mockResolvedValue({ id: 'ex-1' });

    await service.deleteExtra('ex-1');

    expect(repo.deleteExtra).toHaveBeenCalledWith('ex-1');
  });

  // ── SERIAL-1: findAllRatePlans — priceModifier is a JS number, not string ──

  it('SERIAL-1 — findAllRatePlans: priceModifier is typeof number (Decimal→Number coercion)', async () => {
    // Simulate what Prisma actually returns at runtime: Decimal serialized as
    // a string in JSON. TypeScript types claim `number` — the bug is runtime-only.
    const rawFromPrisma = {
      ...mkPlan([], { priceModifier: 1.0 }),
      // Override with a string to replicate the Prisma Decimal boundary behaviour.
      priceModifier: '0.8500' as unknown as number,
    };
    repo.findAllRatePlans = vi.fn().mockResolvedValue([rawFromPrisma]);

    const results = await service.findAllRatePlans();

    expect(results).toHaveLength(1);
    // Must be a real JS number — not a string — so .toFixed() doesn't throw on the FE.
    expect(typeof results[0].priceModifier).toBe('number');
    expect(results[0].priceModifier).toBe(0.85);
  });

  // ── SERIAL-2: findRatePlanById — priceModifier is a JS number ─────────────

  it('SERIAL-2 — findRatePlanById: priceModifier coerced from Decimal string to number', async () => {
    const rawFromPrisma = {
      ...mkPlan([], { id: 'rp-x', priceModifier: 1.15 }),
      priceModifier: '1.1500' as unknown as number,
    };
    repo.findRatePlanById = vi.fn().mockResolvedValue(rawFromPrisma);

    const result = await service.findRatePlanById('rp-x');

    expect(typeof result!.priceModifier).toBe('number');
    expect(result!.priceModifier).toBeCloseTo(1.15);
  });

  // ── SERIAL-3: findAllRatePlans — extras.amount is a JS number ─────────────

  it('SERIAL-3 — findAllRatePlans: extras[].amount coerced from Decimal string to number', async () => {
    const rawExtra = {
      ...mkExtra('ex-1', 'Desayuno', 30000, 'PER_NIGHT'),
      amount: '30000.0000' as unknown as number,
    };
    const rawFromPrisma = { ...mkPlan([rawExtra], {}), priceModifier: '1.0000' as unknown as number };
    repo.findAllRatePlans = vi.fn().mockResolvedValue([rawFromPrisma]);

    const results = await service.findAllRatePlans();

    expect(typeof results[0].extras![0].amount).toBe('number');
    expect(results[0].extras![0].amount).toBe(30000);
  });

  // ── SERIAL-4: createRatePlan — returned priceModifier is a JS number ──────

  it('SERIAL-4 — createRatePlan: returned priceModifier coerced from Decimal string', async () => {
    const rawFromPrisma = {
      ...mkPlan([], { id: 'rp-new', priceModifier: 0.85 }),
      priceModifier: '0.8500' as unknown as number,
    };
    repo.createRatePlan.mockResolvedValue(rawFromPrisma);

    const result = await service.createRatePlan({
      name: 'Promo',
      type: 'PROMO',
      roomTypeId: 'cabcdefghijklmnopqrstuvwxy',
      priceModifier: 0.85,
    });

    expect(typeof result.priceModifier).toBe('number');
    expect(result.priceModifier).toBe(0.85);
  });

  // ── SEASON-1: createSeason now uses roomTypeId ────────────────────────────

  it('SEASON-1 — createSeason: forwards roomTypeId (not ratePlanId) to repository', async () => {
    const rawSeason = {
      id: 's-1',
      roomTypeId: 'crt00000000000000000000001',
      name: 'HIGH',
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      multiplier: 1.3,
      minNights: 2,
      createdAt: new Date(),
    };
    const createSeasonFn = vi.fn().mockResolvedValue(rawSeason);

    const repoWithSeason = {
      ...repo,
      createSeason: createSeasonFn,
    };

    const moduleWithSeason: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PricingRepository, useValue: repoWithSeason },
        { provide: SystemConfigService, useValue: systemConfig },
      ],
    }).compile();

    const svcWithSeason = moduleWithSeason.get(PricingService);

    await svcWithSeason.createSeason({
      roomTypeId: 'crt00000000000000000000001',
      name: 'HIGH',
      startDate: '2026-12-01',
      endDate: '2026-12-31',
      multiplier: 1.3,
      minNights: 2,
    });

    expect(createSeasonFn).toHaveBeenCalledWith(
      expect.objectContaining({ roomTypeId: 'crt00000000000000000000001' }),
    );
    // Must NOT contain ratePlanId
    const callArg = createSeasonFn.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg['ratePlanId']).toBeUndefined();
  });

  // ── SEASON-DATE-1: createSeason response has "YYYY-MM-DD" dates ──────────

  it('SEASON-DATE-1 — createSeason: startDate and endDate are bare "YYYY-MM-DD" strings (not full ISO datetime)', async () => {
    const rawSeason = {
      id: 's-date-1',
      roomTypeId: 'crt00000000000000000000001',
      name: 'HIGH',
      // Simulate Prisma @db.Date serialised as midnight-UTC Date object
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      multiplier: 1.3,
      minNights: 2,
      createdAt: new Date(),
    };
    const createSeasonFn = vi.fn().mockResolvedValue(rawSeason);

    const repoDate: typeof repo = { ...repo, createSeason: createSeasonFn };
    const mod = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PricingRepository, useValue: repoDate },
        { provide: SystemConfigService, useValue: systemConfig },
      ],
    }).compile();
    const svc = mod.get(PricingService);

    const result = await svc.createSeason({
      roomTypeId: 'crt00000000000000000000001',
      name: 'HIGH',
      startDate: '2026-12-01',
      endDate: '2026-12-31',
      multiplier: 1.3,
      minNights: 2,
    });

    // Must be exactly 10 chars — "YYYY-MM-DD" — not a full ISO datetime
    expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.startDate).toBe('2026-12-01');
    expect(result.endDate).toBe('2026-12-31');
  });

  // ── SEASON-DATE-2: findSeasonsByRoomType response has "YYYY-MM-DD" dates ─

  it('SEASON-DATE-2 — findSeasonsByRoomType: dates are bare "YYYY-MM-DD" strings and multiplier is a JS number', async () => {
    const rawSeasons = [
      {
        id: 's-list-1',
        roomTypeId: 'rt-1',
        name: 'HIGH',
        // Full UTC datetime — what Prisma actually returns for @db.Date
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-08-31T00:00:00.000Z'),
        // Simulate Decimal serialised as string (same runtime bug as priceModifier)
        multiplier: '1.2500' as unknown as number,
        minNights: 3,
        createdAt: new Date(),
      },
    ];
    const findFn = vi.fn().mockResolvedValue(rawSeasons);
    const repoList: typeof repo = { ...repo, findSeasonsByRoomType: findFn };
    const mod = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PricingRepository, useValue: repoList },
        { provide: SystemConfigService, useValue: systemConfig },
      ],
    }).compile();
    const svc = mod.get(PricingService);

    const results = await svc.findSeasonsByRoomType('rt-1');

    expect(results).toHaveLength(1);
    // Dates must be bare "YYYY-MM-DD"
    expect(results[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(results[0].endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(results[0].startDate).toBe('2026-06-01');
    expect(results[0].endDate).toBe('2026-08-31');
    // Multiplier must be a real JS number — not a string
    expect(typeof results[0].multiplier).toBe('number');
    expect(results[0].multiplier).toBe(1.25);
  });

  // ── SEASON-DATE-3: updateSeason response has "YYYY-MM-DD" dates ──────────

  it('SEASON-DATE-3 — updateSeason: returned dates are bare "YYYY-MM-DD" strings and multiplier is a JS number', async () => {
    const rawUpdated = {
      id: 's-upd-1',
      roomTypeId: 'rt-1',
      name: 'MID',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-11-30T00:00:00.000Z'),
      multiplier: '0.9000' as unknown as number,
      minNights: 1,
      createdAt: new Date(),
    };
    const updateFn = vi.fn().mockResolvedValue(rawUpdated);
    const repoUpd: typeof repo = { ...repo, updateSeason: updateFn };
    const mod = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PricingRepository, useValue: repoUpd },
        { provide: SystemConfigService, useValue: systemConfig },
      ],
    }).compile();
    const svc = mod.get(PricingService);

    const result = await svc.updateSeason('s-upd-1', { name: 'MID' });

    expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.startDate).toBe('2026-09-01');
    expect(result.endDate).toBe('2026-11-30');
    expect(typeof result.multiplier).toBe('number');
    expect(result.multiplier).toBe(0.9);
  });
});
