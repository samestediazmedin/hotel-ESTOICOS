/**
 * rate-options.spec.ts — tests for GET /api/public/rate-options
 *
 * Tests the controller + the Zod query validation.
 * PricingService is mocked — we test the routing/validation layer only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PublicPortalController } from './public-portal.controller';
import { PublicPortalService } from './public-portal.service';
import { PricingService } from '../pricing/pricing.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

// Minimal PricingBreakdown-shaped object that satisfies the return type
const mockBreakdown = {
  roomTypeId: 'cmvalidroomtype0000000001',
  ratePlanId: null,
  nights: 2,
  items: [],
  subtotal: 400000,
  totalIva: 76000,
  roomTotal: 476000,
  extras: [],
  extrasSubtotal: 0,
  extrasIva: 0,
  extrasTotal: 0,
  total: 476000,
  currency: 'COP' as const,
  appliedRatePlan: 'Base Rate',
};

const mockRatePlanOptions = [
  {
    ratePlanId: null,
    ratePlanName: 'Base Rate',
    ratePlanType: 'BASE',
    description: null,
    breakdown: mockBreakdown,
  },
];

// ─── Mocks ───────────────────────────────────────────────────────────────────

const pricingServiceMock = {
  calculateAllPlans: vi.fn(),
};

const publicPortalServiceMock = {
  getHotelInfo: vi.fn(),
  getPublishedRoomTypes: vi.fn(),
  getHotelPhotos: vi.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PublicPortalController — GET /rate-options', () => {
  let controller: PublicPortalController;

  const VALID_ROOM_TYPE_ID = 'cmvalidroomtype0000000001';

  beforeEach(async () => {
    vi.clearAllMocks();
    pricingServiceMock.calculateAllPlans.mockResolvedValue(mockRatePlanOptions);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        // ThrottlerModule required since LOW-3 added @UseGuards(ThrottlerGuard) to the controller
        ThrottlerModule.forRoot([{ name: 'short', ttl: 60_000, limit: 20 }]),
      ],
      controllers: [PublicPortalController],
      providers: [
        { provide: PublicPortalService, useValue: publicPortalServiceMock },
        { provide: PricingService, useValue: pricingServiceMock },
        // These are not needed for these tests but NestJS DI requires them
        { provide: SystemConfigService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get(PublicPortalController);
  });

  // ── RO-1: valid params → calls calculateAllPlans + returns options ─────────

  it('RO-1 — valid params: calls pricingService.calculateAllPlans and returns options', async () => {
    const result = await controller.getRateOptions({
      roomTypeId: VALID_ROOM_TYPE_ID,
      checkIn: '2026-08-01',
      checkOut: '2026-08-03',
      adults: '2',
    });

    expect(pricingServiceMock.calculateAllPlans).toHaveBeenCalledTimes(1);
    expect(pricingServiceMock.calculateAllPlans).toHaveBeenCalledWith({
      roomTypeId: VALID_ROOM_TYPE_ID,
      checkIn: new Date('2026-08-01T00:00:00.000Z'),
      checkOut: new Date('2026-08-03T00:00:00.000Z'),
      adults: 2,
    });
    expect(result).toEqual(mockRatePlanOptions);
  });

  // ── RO-2: adults defaults to 1 when omitted ────────────────────────────────

  it('RO-2 — adults omitted: defaults to 1', async () => {
    await controller.getRateOptions({
      roomTypeId: VALID_ROOM_TYPE_ID,
      checkIn: '2026-08-01',
      checkOut: '2026-08-03',
    });

    expect(pricingServiceMock.calculateAllPlans).toHaveBeenCalledWith(
      expect.objectContaining({ adults: 1 }),
    );
  });

  // ── RO-3: invalid roomTypeId → 400 ────────────────────────────────────────

  it('RO-3 — invalid roomTypeId (not a CUID): throws BadRequestException', async () => {
    await expect(
      controller.getRateOptions({
        roomTypeId: 'not-a-cuid',
        checkIn: '2026-08-01',
        checkOut: '2026-08-03',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── RO-4: missing roomTypeId → 400 ────────────────────────────────────────

  it('RO-4 — missing roomTypeId: throws BadRequestException', async () => {
    await expect(
      controller.getRateOptions({
        checkIn: '2026-08-01',
        checkOut: '2026-08-03',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── RO-5: invalid checkIn format → 400 ────────────────────────────────────

  it('RO-5 — invalid checkIn format: throws BadRequestException', async () => {
    await expect(
      controller.getRateOptions({
        roomTypeId: VALID_ROOM_TYPE_ID,
        checkIn: '01-08-2026',  // wrong format
        checkOut: '2026-08-03',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── RO-6: checkOut <= checkIn → 400 ──────────────────────────────────────

  it('RO-6 — checkOut same as checkIn: throws BadRequestException', async () => {
    await expect(
      controller.getRateOptions({
        roomTypeId: VALID_ROOM_TYPE_ID,
        checkIn: '2026-08-03',
        checkOut: '2026-08-03',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── RO-7: dates parsed as UTC midnight ────────────────────────────────────

  it('RO-7 — dates are parsed as UTC midnight (not local time)', async () => {
    await controller.getRateOptions({
      roomTypeId: VALID_ROOM_TYPE_ID,
      checkIn: '2026-12-31',
      checkOut: '2027-01-02',
    });

    const call = pricingServiceMock.calculateAllPlans.mock.calls[0][0];
    expect(call.checkIn.toISOString()).toBe('2026-12-31T00:00:00.000Z');
    expect(call.checkOut.toISOString()).toBe('2027-01-02T00:00:00.000Z');
  });
});
