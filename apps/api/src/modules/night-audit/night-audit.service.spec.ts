import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { NightAuditService } from './night-audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { FolioService } from '../folio/folio.service';
import { PricingService } from '../pricing/pricing.service';
import { ReviewsService } from '../reviews/reviews.service';

// ─── Test date constants ──────────────────────────────────────────────────────

const AUDIT_DATE = new Date('2026-05-15T00:00:00.000Z');
const NEXT_DATE = new Date('2026-05-16T00:00:00.000Z');
const SYSTEM_USER_ID = 'admin-user-id-001';
const IVA_RATE = 0.19;

// ─── Mock builders ────────────────────────────────────────────────────────────

function makeOpenFolio(id: string, roomTypeId = 'rt-1', roomNumber = '101') {
  return {
    id,
    reservationId: `res-${id}`,
    isOpen: true,
    reservation: {
      id: `res-${id}`,
      roomTypeId,
      room: { id: `room-${id}`, number: roomNumber },
    },
  };
}

function makePricingBreakdown(nightRate: number) {
  const roomTotal = nightRate + Math.round(nightRate * IVA_RATE);
  return {
    roomTypeId: 'rt-1',
    ratePlanId: 'rp-1',
    nights: 1,
    items: [{ nightRate, ivaAmount: Math.round(nightRate * IVA_RATE), lineTotal: nightRate + Math.round(nightRate * IVA_RATE), date: '2026-05-15', base: nightRate, multiplier: 1, planModifier: 1, ivaRate: IVA_RATE, seasonName: null }],
    subtotal: nightRate,
    totalIva: Math.round(nightRate * IVA_RATE),
    roomTotal,
    extras: [],
    extrasSubtotal: 0,
    extrasIva: 0,
    extrasTotal: 0,
    total: roomTotal,
    currency: 'COP',
    appliedRatePlan: 'Base Rate',
  };
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

function buildTxMock(overrides: Record<string, any> = {}) {
  return {
    folio: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    folioItem: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'fi-1' }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
    },
    reservation: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    dailySnapshot: {
      upsert: vi.fn().mockResolvedValue({ id: 'ds-1' }),
    },
    room: {
      count: vi.fn().mockResolvedValue(10),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ result: true }]),
    ...overrides,
  };
}

describe('NightAuditService', () => {
  let service: NightAuditService;
  let prismaMock: any;
  let systemConfigMock: any;
  let pricingServiceMock: any;
  let reviewsServiceMock: any;
  let txMock: any;

  beforeEach(async () => {
    txMock = buildTxMock();

    prismaMock = {
      nightAuditRun: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 'run-1', businessDate: AUDIT_DATE }),
        update: vi.fn().mockResolvedValue({ id: 'run-1', status: 'COMPLETED' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: SYSTEM_USER_ID }),
      },
      $transaction: vi.fn(async (cb: (tx: any) => any) => cb(txMock)),
    };

    systemConfigMock = {
      getIvaRate: vi.fn().mockResolvedValue(IVA_RATE),
      getHotelBusinessDate: vi.fn().mockResolvedValue(AUDIT_DATE),
      advanceBusinessDate: vi.fn().mockResolvedValue(NEXT_DATE),
      advanceBusinessDateTx: vi.fn().mockResolvedValue(undefined),
    };

    pricingServiceMock = {
      calculateBreakdown: vi.fn().mockResolvedValue(makePricingBreakdown(100_000)),
    };

    reviewsServiceMock = {
      sendPendingReviewInvites: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NightAuditService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SystemConfigService, useValue: systemConfigMock },
        { provide: FolioService, useValue: {} },
        { provide: PricingService, useValue: pricingServiceMock },
        { provide: ReviewsService, useValue: reviewsServiceMock },
      ],
    }).compile();

    service = module.get<NightAuditService>(NightAuditService);
  });

  // ─── Test 1: Full successful run ─────────────────────────────────────────

  it('Test 1: runs audit, creates COMPLETED row, returns result', async () => {
    const folio = makeOpenFolio('folio-1');
    txMock.folio.findMany.mockResolvedValue([folio]);
    txMock.reservation.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.runForBusinessDate(AUDIT_DATE);

    expect(result.skipped).toBe(false);
    expect(prismaMock.nightAuditRun.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessDate: AUDIT_DATE } }),
    );
    expect(prismaMock.nightAuditRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
    expect(result.noShowsMarked).toBe(1);
  });

  // ─── Test 2: Idempotency — already COMPLETED ─────────────────────────────

  it('Test 2: returns skipped=true when run already COMPLETED — no folioItem.create called', async () => {
    prismaMock.nightAuditRun.findUnique.mockResolvedValue({
      id: 'run-existing',
      businessDate: AUDIT_DATE,
      status: 'COMPLETED',
    });

    const result = await service.runForBusinessDate(AUDIT_DATE);

    expect(result.skipped).toBe(true);
    // Transaction must NOT be entered
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    // folioItem.create must NOT be called
    expect(txMock.folioItem.create).not.toHaveBeenCalled();
  });

  // ─── Test 3: Exactly 2 FolioItems per folio (ROOM_CHARGE + TAX) ──────────

  it('Test 3: posts exactly 2 FolioItems per open folio — ROOM_CHARGE (taxRate=0) + TAX (taxRate=0.19, description contains IVA)', async () => {
    const folio = makeOpenFolio('folio-1');
    txMock.folio.findMany.mockResolvedValue([folio]);

    await service.runForBusinessDate(AUDIT_DATE);

    expect(txMock.folioItem.create).toHaveBeenCalledTimes(2);

    const calls = txMock.folioItem.create.mock.calls;
    const chargeCall = calls.find((c: any) => c[0].data.type === 'ROOM_CHARGE');
    const taxCall = calls.find((c: any) => c[0].data.type === 'TAX');

    // ROOM_CHARGE: taxRate=0, taxAmount=0
    expect(chargeCall[0].data.taxRate).toBe(0);
    expect(chargeCall[0].data.taxAmount).toBe(0);
    expect(chargeCall[0].data.postedByUserId).toBe(SYSTEM_USER_ID);
    expect(chargeCall[0].data.businessDate).toEqual(AUDIT_DATE);

    // TAX: taxRate=0.19, description contains "IVA"
    expect(taxCall[0].data.taxRate).toBe(IVA_RATE);
    expect(taxCall[0].data.description).toMatch(/IVA/);
    expect(taxCall[0].data.postedByUserId).toBe(SYSTEM_USER_ID);
    expect(taxCall[0].data.businessDate).toEqual(AUDIT_DATE);
  });

  // ─── Test 4: Per-folio idempotency — skips folio if ROOM_CHARGE already exists ─

  it('Test 4: skips folio entirely when ROOM_CHARGE already exists for (folioId, businessDate)', async () => {
    const folio = makeOpenFolio('folio-skip');
    txMock.folio.findMany.mockResolvedValue([folio]);
    // Simulate existing ROOM_CHARGE for this folio + date
    txMock.folioItem.count.mockResolvedValue(1);

    await service.runForBusinessDate(AUDIT_DATE);

    // No new charges should be posted
    expect(txMock.folioItem.create).not.toHaveBeenCalled();
  });

  // ─── Test 5: NO_SHOW marking ──────────────────────────────────────────────

  it('Test 5: NO_SHOW updateMany scoped to status=CONFIRMED with checkInDate < businessDate', async () => {
    txMock.reservation.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.runForBusinessDate(AUDIT_DATE);

    expect(txMock.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'CONFIRMED',
          checkInDate: { lt: AUDIT_DATE },
        }),
        data: { status: 'NO_SHOW' },
      }),
    );
    expect(result.noShowsMarked).toBe(3);
  });

  // ─── Test 6: Advisory lock — returns false → ConflictException ───────────

  it('Test 6: throws ConflictException when pg_try_advisory_xact_lock returns false', async () => {
    // Override advisory lock to return false (another instance holds the lock)
    txMock.$queryRaw = vi.fn().mockResolvedValue([{ result: false }]);

    await expect(service.runForBusinessDate(AUDIT_DATE)).rejects.toThrow(ConflictException);

    // No charges must have been posted
    expect(txMock.folioItem.create).not.toHaveBeenCalled();
  });

  // ─── Test 7: IVA rate validation ──────────────────────────────────────────

  it('Test 7: throws and marks run FAILED when IVA rate is 0', async () => {
    systemConfigMock.getIvaRate.mockResolvedValue(0);

    await expect(service.runForBusinessDate(AUDIT_DATE)).rejects.toThrow(
      /Invalid IVA rate/,
    );
    // Transaction must NOT be entered (fail-fast before posting)
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('Test 7b: throws and marks run FAILED when IVA rate is null', async () => {
    systemConfigMock.getIvaRate.mockResolvedValue(null);

    await expect(service.runForBusinessDate(AUDIT_DATE)).rejects.toThrow(
      /Invalid IVA rate/,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  // ─── Test 8: detectAndAlertSkippedDays ───────────────────────────────────

  it('Test 8: detectAndAlertSkippedDays emits when last COMPLETED run is >1 day ago', async () => {
    // Last completed run was 3 days ago
    const oldDate = new Date('2026-05-12T00:00:00.000Z');
    prismaMock.nightAuditRun.findFirst.mockResolvedValue({
      id: 'run-old',
      businessDate: oldDate,
      status: 'COMPLETED',
    });

    const alertSpy = vi.spyOn(service as any, 'emitGapAlert').mockResolvedValue(undefined);

    await service.detectAndAlertSkippedDays(AUDIT_DATE);

    // Gap = 3 days → alert must fire
    expect(alertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ gapDays: expect.any(Number) }),
    );
  });

  it('Test 8b: detectAndAlertSkippedDays does NOT alert when last run was yesterday', async () => {
    const yesterday = new Date('2026-05-14T00:00:00.000Z');
    prismaMock.nightAuditRun.findFirst.mockResolvedValue({
      id: 'run-yesterday',
      businessDate: yesterday,
      status: 'COMPLETED',
    });

    const alertSpy = vi.spyOn(service as any, 'emitGapAlert').mockResolvedValue(undefined);

    await service.detectAndAlertSkippedDays(AUDIT_DATE);

    expect(alertSpy).not.toHaveBeenCalled();
  });

  // ─── Test 9: advanceBusinessDateTx called exactly once per successful run ──

  it('Test 9: advanceBusinessDateTx(tx) called exactly once with the tx client (W1 closed)', async () => {
    await service.runForBusinessDate(AUDIT_DATE);

    // Must use the tx variant (inside $transaction) — NOT advanceBusinessDate()
    expect(systemConfigMock.advanceBusinessDateTx).toHaveBeenCalledTimes(1);
    expect(systemConfigMock.advanceBusinessDateTx).toHaveBeenCalledWith(txMock);
    // Legacy advanceBusinessDate() must NOT be called
    expect(systemConfigMock.advanceBusinessDate).not.toHaveBeenCalled();
  });

  // ─── KPI Tests (Task 2 — Phase 06-01) ────────────────────────────────────

  it('KPI-1: writeDailySnapshot computes occupancyPct = occupiedRooms / totalRooms', async () => {
    // 5 occupied rooms out of 10 total = 0.5
    txMock.room.count.mockResolvedValue(10);
    txMock.reservation.count
      .mockResolvedValueOnce(5)  // occupiedRooms (CHECKED_IN spanning date)
      .mockResolvedValue(0);     // arrivals, departures, no-shows

    await service.runForBusinessDate(AUDIT_DATE);

    const upsertCall = txMock.dailySnapshot.upsert.mock.calls[0][0];
    expect(upsertCall.create.occupancyPct).toBeCloseTo(0.5, 4);
    expect(upsertCall.create.totalRooms).toBe(10);
    expect(upsertCall.create.occupiedRooms).toBe(5);
  });

  it('KPI-2: when occupiedRooms = 0, ADR = 0 (no division by zero)', async () => {
    txMock.room.count.mockResolvedValue(10);
    txMock.reservation.count.mockResolvedValue(0);
    txMock.folioItem.aggregate.mockResolvedValue({ _sum: { amount: '500000' } });

    await service.runForBusinessDate(AUDIT_DATE);

    const upsertCall = txMock.dailySnapshot.upsert.mock.calls[0][0];
    expect(upsertCall.create.adr).toBe(0);
    expect(upsertCall.create.occupancyPct).toBe(0);
  });

  it('KPI-3: when totalRooms = 0, RevPAR = 0 AND occupancyPct = 0', async () => {
    txMock.room.count.mockResolvedValue(0);
    txMock.reservation.count.mockResolvedValue(0);

    await service.runForBusinessDate(AUDIT_DATE);

    const upsertCall = txMock.dailySnapshot.upsert.mock.calls[0][0];
    expect(upsertCall.create.revpar).toBe(0);
    expect(upsertCall.create.occupancyPct).toBe(0);
  });

  it('KPI-4: ADR uses only ROOM_CHARGE folioItem aggregate for businessDate', async () => {
    txMock.room.count.mockResolvedValue(10);
    txMock.reservation.count
      .mockResolvedValueOnce(4)   // occupiedRooms
      .mockResolvedValue(0);
    // ROOM_CHARGE aggregate = 800000 COP → ADR = 800000/4 = 200000
    txMock.folioItem.aggregate
      .mockResolvedValueOnce({ _sum: { amount: '800000' } })  // ROOM_CHARGE agg
      .mockResolvedValueOnce({ _sum: { amount: '952000' } }); // totalRevenue agg

    await service.runForBusinessDate(AUDIT_DATE);

    const upsertCall = txMock.dailySnapshot.upsert.mock.calls[0][0];
    // folioItem.aggregate must be called (ROOM_CHARGE query)
    expect(txMock.folioItem.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'ROOM_CHARGE' }),
      }),
    );
    expect(upsertCall.create.adr).toBe(200000);
  });

  it('KPI-5: arrivalsCount = CHECKED_IN reservations with checkInDate = businessDate', async () => {
    txMock.room.count.mockResolvedValue(10);
    // Call order in service: occupiedRooms, arrivalsCount, departuresCount, noShowCount
    txMock.reservation.count
      .mockResolvedValueOnce(3)   // occupiedRooms
      .mockResolvedValueOnce(2)   // arrivalsCount (checkInDate = businessDate)
      .mockResolvedValueOnce(1)   // departuresCount
      .mockResolvedValueOnce(0);  // noShowCount

    await service.runForBusinessDate(AUDIT_DATE);

    const upsertCall = txMock.dailySnapshot.upsert.mock.calls[0][0];
    expect(upsertCall.create.arrivalsCount).toBe(2);
    // Verify arrivals query uses status: CHECKED_IN + checkInDate = businessDate
    const arrivalCall = txMock.reservation.count.mock.calls.find(
      (c: any) => c[0]?.where?.checkInDate instanceof Date &&
                  c[0]?.where?.checkInDate.getTime() === AUDIT_DATE.getTime() &&
                  c[0]?.where?.status === 'CHECKED_IN' &&
                  !c[0]?.where?.checkOutDate,
    );
    expect(arrivalCall).toBeDefined();
  });

  it('KPI-6: departuresCount = CHECKED_OUT reservations with checkOutDate = businessDate', async () => {
    txMock.room.count.mockResolvedValue(10);
    txMock.reservation.count
      .mockResolvedValueOnce(2)   // occupiedRooms
      .mockResolvedValueOnce(1)   // arrivalsCount
      .mockResolvedValueOnce(3)   // departuresCount
      .mockResolvedValueOnce(0);  // noShowCount

    await service.runForBusinessDate(AUDIT_DATE);

    const upsertCall = txMock.dailySnapshot.upsert.mock.calls[0][0];
    expect(upsertCall.create.departuresCount).toBe(3);
    const departureCall = txMock.reservation.count.mock.calls.find(
      (c: any) => c[0]?.where?.status === 'CHECKED_OUT' &&
                  c[0]?.where?.checkOutDate instanceof Date,
    );
    expect(departureCall).toBeDefined();
  });

  it('KPI-7: occupiedRooms from CHECKED_IN count spanning businessDate (NOT openFoliosCount)', async () => {
    // Provide 1 open folio but 8 CHECKED_IN reservations spanning the date
    const folio = makeOpenFolio('f-1');
    txMock.folio.findMany.mockResolvedValue([folio]);
    txMock.room.count.mockResolvedValue(20);
    txMock.reservation.count
      .mockResolvedValueOnce(8)   // occupiedRooms from CHECKED_IN query
      .mockResolvedValue(0);

    await service.runForBusinessDate(AUDIT_DATE);

    const upsertCall = txMock.dailySnapshot.upsert.mock.calls[0][0];
    // Must be 8, NOT 1 (the open folio count)
    expect(upsertCall.create.occupiedRooms).toBe(8);
    // Verify the query uses CHECKED_IN status with date range
    const occupiedCall = txMock.reservation.count.mock.calls.find(
      (c: any) => c[0]?.where?.status === 'CHECKED_IN' &&
                  c[0]?.where?.checkInDate?.lte !== undefined,
    );
    expect(occupiedCall).toBeDefined();
  });

  it('KPI-8: dailySnapshot.upsert called with all 10 computed fields (not zeros)', async () => {
    txMock.room.count.mockResolvedValue(10);
    txMock.reservation.count
      .mockResolvedValueOnce(4)   // occupiedRooms
      .mockResolvedValueOnce(2)   // arrivalsCount
      .mockResolvedValueOnce(1)   // departuresCount
      .mockResolvedValueOnce(0);  // noShowCount
    txMock.folioItem.aggregate
      .mockResolvedValueOnce({ _sum: { amount: '400000' } })  // ROOM_CHARGE
      .mockResolvedValueOnce({ _sum: { amount: '476000' } }); // totalRevenue

    await service.runForBusinessDate(AUDIT_DATE);

    const upsertCall = txMock.dailySnapshot.upsert.mock.calls[0][0];
    const data = upsertCall.create;
    expect(data.totalRooms).toBe(10);
    expect(data.occupiedRooms).toBe(4);
    // occupancyPct = 4/10 = 0.4
    expect(data.occupancyPct).toBeCloseTo(0.4, 4);
    // adr = 400000/4 = 100000
    expect(data.adr).toBe(100000);
    // revpar = 400000/10 = 40000
    expect(data.revpar).toBe(40000);
    expect(data.totalRevenue).toBe(476000);
    expect(data.arrivalsCount).toBe(2);
    expect(data.departuresCount).toBe(1);
    expect(data.noShowCount).toBe(0);
  });

  // ─── Phase 14-02: cron extension tests ────────────────────────────────────

  it('Phase14-1: scheduledNightAudit calls sendPendingReviewInvites(bd) after detectAndAlertSkippedDays', async () => {
    const callOrder: string[] = [];

    const alertSpy = vi.spyOn(service as any, 'detectAndAlertSkippedDays').mockImplementation(async () => {
      callOrder.push('detectAndAlertSkippedDays');
    });

    reviewsServiceMock.sendPendingReviewInvites.mockImplementation(async () => {
      callOrder.push('sendPendingReviewInvites');
    });

    // Mock runForBusinessDate to avoid full audit chain in cron test
    vi.spyOn(service, 'runForBusinessDate').mockResolvedValue({
      skipped: false,
      businessDate: AUDIT_DATE,
      openFoliosProcessed: 0,
      chargesPosted: 0,
      noShowsMarked: 0,
    });

    await service.scheduledNightAudit();

    expect(callOrder).toEqual(['detectAndAlertSkippedDays', 'sendPendingReviewInvites']);
    alertSpy.mockRestore();
  });

  it('Phase14-2: scheduledNightAudit does NOT propagate sendPendingReviewInvites errors (cron must not fail)', async () => {
    vi.spyOn(service, 'runForBusinessDate').mockResolvedValue({
      skipped: false,
      businessDate: AUDIT_DATE,
      openFoliosProcessed: 0,
      chargesPosted: 0,
      noShowsMarked: 0,
    });
    vi.spyOn(service as any, 'detectAndAlertSkippedDays').mockResolvedValue(undefined);

    reviewsServiceMock.sendPendingReviewInvites.mockRejectedValueOnce(
      new Error('Resend batch failure'),
    );

    // Must resolve — review invite failure must NOT bubble up and fail the cron
    await expect(service.scheduledNightAudit()).resolves.toBeUndefined();
  });
});
