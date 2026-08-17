import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityService } from './availability.service';
import { InventoryRepository } from '../inventory/inventory.repository';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mkDate = (iso: string) => new Date(iso + 'T00:00:00.000Z');

/** Build a minimal room stub */
function mkRoom(id: string, roomTypeId: string) {
  return {
    id,
    number: `10${id.slice(-1)}`,
    floor: 1,
    roomTypeId,
    physicalStatus: 'AVAILABLE',
    cleaningStatus: 'CLEAN',
    notes: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roomType: { id: roomTypeId, name: 'Suite', basePrice: 200000 },
    photos: [],
  };
}

/** Build a minimal PricingBreakdown stub */
function mkPricing(roomTypeId: string, total = 238000): import('../pricing/dto/pricing-breakdown.dto').PricingBreakdown {
  return {
    roomTypeId,
    ratePlanId: null,
    nights: 1,
    // 2026-05-29 — planModifier added to PricingLineItem; stub uses empty items array
    items: [],
    subtotal: 200000,
    totalIva: 38000,
    roomTotal: 238000,
    extras: [],
    extrasSubtotal: 0,
    extrasIva: 0,
    extrasTotal: 0,
    total,
    currency: 'COP',
    appliedRatePlan: 'Base Rate',
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let inventoryRepoMock: {
    findAvailableRooms: ReturnType<typeof vi.fn>;
  };
  let pricingServiceMock: {
    calculateBreakdown: ReturnType<typeof vi.fn>;
  };
  let prismaMock: {
    reservation: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  const checkIn = mkDate('2026-06-10');
  const checkOut = mkDate('2026-06-13');

  beforeEach(async () => {
    inventoryRepoMock = {
      findAvailableRooms: vi.fn(),
    };

    pricingServiceMock = {
      calculateBreakdown: vi.fn(),
    };

    prismaMock = {
      reservation: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: InventoryRepository, useValue: inventoryRepoMock },
        { provide: PricingService, useValue: pricingServiceMock },
      ],
    }).compile();

    service = module.get(AvailabilityService);
  });

  // ── Test 1: findAvailableRooms called exactly once ────────────────────────

  it('Test 1 — searchAvailable() calls inventoryRepository.findAvailableRooms() exactly once', async () => {
    inventoryRepoMock.findAvailableRooms.mockResolvedValue([]);

    await service.searchAvailable(checkIn, checkOut, 2);

    expect(inventoryRepoMock.findAvailableRooms).toHaveBeenCalledTimes(1);
  });

  // ── Test 2: Rooms with overlapping reservations are excluded ──────────────

  it('Test 2 — rooms with overlapping ACTIVE reservation are excluded from results', async () => {
    const roomA = mkRoom('room-A', 'rt-1');
    const roomB = mkRoom('room-B', 'rt-1');
    inventoryRepoMock.findAvailableRooms.mockResolvedValue([roomA, roomB]);
    // room-A has an overlapping reservation
    prismaMock.reservation.findMany.mockResolvedValue([{ roomId: 'room-A' }]);
    pricingServiceMock.calculateBreakdown.mockResolvedValue(mkPricing('rt-1'));

    const result = await service.searchAvailable(checkIn, checkOut, 2);

    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('room-A');
    expect(ids).toContain('room-B');
    expect(result).toHaveLength(1);
  });

  // ── Test 3: Overlap query filter correctness ──────────────────────────────

  it('Test 3 — overlap query uses correct Prisma filter shape', async () => {
    inventoryRepoMock.findAvailableRooms.mockResolvedValue([]);
    prismaMock.reservation.findMany.mockResolvedValue([]);

    await service.searchAvailable(checkIn, checkOut, 2);

    const callArgs = prismaMock.reservation.findMany.mock.calls[0][0];
    expect(callArgs.where.status.notIn).toContain('CANCELLED');
    expect(callArgs.where.status.notIn).toContain('NO_SHOW');
    expect(callArgs.where.checkInDate).toEqual({ lt: checkOut });
    expect(callArgs.where.checkOutDate).toEqual({ gt: checkIn });
  });

  // ── Test 4: Returned rooms have pricing field ─────────────────────────────

  it('Test 4 — each returned room has a pricing field of type PricingBreakdown', async () => {
    const roomA = mkRoom('room-A', 'rt-1');
    inventoryRepoMock.findAvailableRooms.mockResolvedValue([roomA]);
    prismaMock.reservation.findMany.mockResolvedValue([]);
    const pricing = mkPricing('rt-1');
    pricingServiceMock.calculateBreakdown.mockResolvedValue(pricing);

    const result = await service.searchAvailable(checkIn, checkOut, 2);

    expect(result[0].pricing).toBeDefined();
    expect(result[0].pricing.total).toBe(pricing.total);
    expect(result[0].pricing.currency).toBe('COP');
  });

  // ── Test 5: N+1 avoidance — calculateBreakdown called once per roomTypeId ─

  it('Test 5 — calculateBreakdown called once per unique roomTypeId (N+1 avoidance)', async () => {
    // Two rooms sharing the same roomTypeId
    const room1 = mkRoom('room-1', 'rt-shared');
    const room2 = mkRoom('room-2', 'rt-shared');
    // One room with a different roomTypeId
    const room3 = mkRoom('room-3', 'rt-other');
    inventoryRepoMock.findAvailableRooms.mockResolvedValue([room1, room2, room3]);
    prismaMock.reservation.findMany.mockResolvedValue([]);
    pricingServiceMock.calculateBreakdown.mockResolvedValue(mkPricing('rt-shared'));

    await service.searchAvailable(checkIn, checkOut, 2);

    // Must be called twice (once per unique roomTypeId: rt-shared and rt-other)
    // NOT three times (once per room)
    expect(pricingServiceMock.calculateBreakdown).toHaveBeenCalledTimes(2);

    const calledWithRoomTypeIds = pricingServiceMock.calculateBreakdown.mock.calls.map(
      (call: any[]) => call[0].roomTypeId,
    );
    expect(calledWithRoomTypeIds).toContain('rt-shared');
    expect(calledWithRoomTypeIds).toContain('rt-other');
    // rt-shared must appear only once
    expect(calledWithRoomTypeIds.filter((id: string) => id === 'rt-shared')).toHaveLength(1);
  });

  // ── Test 6: isRoomAvailable ───────────────────────────────────────────────

  it('Test 6 — isRoomAvailable() returns true when no overlap, false when overlap exists', async () => {
    // No conflict → true
    prismaMock.reservation.findFirst.mockResolvedValueOnce(null);
    const available = await service.isRoomAvailable('room-X', checkIn, checkOut);
    expect(available).toBe(true);

    // Conflict exists → false
    prismaMock.reservation.findFirst.mockResolvedValueOnce({ id: 'conflict-res' });
    const unavailable = await service.isRoomAvailable('room-X', checkIn, checkOut);
    expect(unavailable).toBe(false);

    // Verify filter used by isRoomAvailable matches the SINGLE GUARD pattern
    const callArgs = prismaMock.reservation.findFirst.mock.calls[0][0];
    expect(callArgs.where.status.notIn).toContain('CANCELLED');
    expect(callArgs.where.status.notIn).toContain('NO_SHOW');
  });
});
