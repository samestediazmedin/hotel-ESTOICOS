import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigService } from '../../system-config/system-config.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_DATE = new Date('2026-05-15T00:00:00.000Z');

const MOCK_SNAPSHOT = {
  id: 'snap-1',
  businessDate: BUSINESS_DATE,
  totalRooms: 20,
  occupiedRooms: 10,
  occupancyPct: { toNumber: () => 0.5 },
  adr: { toNumber: () => 150000 },
  revpar: { toNumber: () => 75000 },
  totalRevenue: { toNumber: () => 1500000 },
  arrivalsCount: 3,
  departuresCount: 2,
  noShowCount: 1,
  createdAt: new Date(),
};

// ─── Mock builders ────────────────────────────────────────────────────────────

function buildPrismaMock(overrides: Record<string, any> = {}) {
  return {
    dailySnapshot: {
      findUnique: vi.fn().mockResolvedValue(MOCK_SNAPSHOT),
      findMany: vi.fn().mockResolvedValue([MOCK_SNAPSHOT]),
    },
    room: {
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    housekeepingTask: {
      count: vi.fn().mockResolvedValue(0),
    },
    ...overrides,
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaMock: any;
  let systemConfigMock: any;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();
    systemConfigMock = {
      getHotelBusinessDate: vi.fn().mockResolvedValue(BUSINESS_DATE),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SystemConfigService, useValue: systemConfigMock },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  // ─── Test 1: getDashboard returns latest daily_snapshot ───────────────────

  it('Test 1: getDashboard() returns latest daily_snapshot for current businessDate', async () => {
    const result = await service.getDashboard();

    expect(systemConfigMock.getHotelBusinessDate).toHaveBeenCalledTimes(1);
    expect(prismaMock.dailySnapshot.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessDate: BUSINESS_DATE } }),
    );
    expect(result.businessDate).toBe('2026-05-15');
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot!.arrivalsCount).toBe(3);
  });

  // ─── Test 2: getDashboard returns snapshot: null when no row exists ───────

  it('Test 2: getDashboard() returns snapshot: null when no DailySnapshot row exists', async () => {
    prismaMock.dailySnapshot.findUnique.mockResolvedValue(null);

    const result = await service.getDashboard();

    expect(result.snapshot).toBeNull();
    expect(result.businessDate).toBe('2026-05-15');
    expect(result.liveKpis).toBeDefined();
  });

  // ─── Test 3: liveKpis.roomsInCleaning = rooms with DIRTY|IN_PROGRESS|INSPECTION ─

  it('Test 3: getDashboard() returns roomsInCleaning from DIRTY/IN_PROGRESS/INSPECTION rooms', async () => {
    // room.count is called multiple times — first call is roomsInCleaning
    prismaMock.room.count
      .mockResolvedValueOnce(5)  // roomsInCleaning
      .mockResolvedValueOnce(8)  // occupied (physicalStatus=OCCUPIED)
      .mockResolvedValueOnce(1)  // out-of-service
      .mockResolvedValueOnce(0)  // on-hold
      .mockResolvedValueOnce(3)  // cleaning (duplicate for roomStatusBreakdown)
      .mockResolvedValueOnce(6); // available

    const result = await service.getDashboard();

    expect(result.liveKpis.roomsInCleaning).toBe(5);
    // Verify the query filters by cleaningStatus in [DIRTY, IN_PROGRESS, INSPECTION]
    const cleaningCall = prismaMock.room.count.mock.calls.find(
      (c: any) =>
        c[0]?.where?.cleaningStatus?.in !== undefined &&
        c[0].where.cleaningStatus.in.includes('DIRTY'),
    );
    expect(cleaningCall).toBeDefined();
  });

  // ─── Test 4: liveKpis.activeServiceRequests = housekeepingTasks OPEN|IN_PROGRESS ─

  it('Test 4: getDashboard() returns activeServiceRequests = housekeepingTask count', async () => {
    prismaMock.housekeepingTask.count.mockResolvedValue(7);

    const result = await service.getDashboard();

    expect(result.liveKpis.activeServiceRequests).toBe(7);
    expect(prismaMock.housekeepingTask.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: expect.objectContaining({ in: expect.arrayContaining(['OPEN', 'IN_PROGRESS']) }),
        }),
      }),
    );
  });

  // ─── Test 5: getDailySnapshots returns rows ordered ASC ───────────────────

  it('Test 5: getDailySnapshots() returns rows ordered by businessDate ASC', async () => {
    prismaMock.dailySnapshot.findMany.mockResolvedValue([MOCK_SNAPSHOT]);

    const result = await service.getDailySnapshots({
      startDate: '2026-05-01',
      endDate: '2026-05-15',
    });

    expect(Array.isArray(result)).toBe(true);
    expect(prismaMock.dailySnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { businessDate: 'asc' } }),
    );
  });

  // ─── Test 6: getDailySnapshots uses date range filter ────────────────────

  it('Test 6: getDailySnapshots() filters by startDate and endDate', async () => {
    await service.getDailySnapshots({ startDate: '2026-05-01', endDate: '2026-05-10' });

    expect(prismaMock.dailySnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      }),
    );
  });

  // ─── Test 7: getRoomStatus returns 5 live counts ──────────────────────────

  it('Test 7: getRoomStatus() returns { occupied, reserved, cleaning, maintenance, available }', async () => {
    prismaMock.room.count
      .mockResolvedValueOnce(10) // occupied
      .mockResolvedValueOnce(3)  // reserved (or on-hold)
      .mockResolvedValueOnce(4)  // cleaning
      .mockResolvedValueOnce(2)  // maintenance
      .mockResolvedValueOnce(5); // available

    const result = await service.getRoomStatus();

    expect(result).toHaveProperty('occupied');
    expect(result).toHaveProperty('cleaning');
    expect(result).toHaveProperty('maintenance');
    expect(result).toHaveProperty('available');
  });
});
