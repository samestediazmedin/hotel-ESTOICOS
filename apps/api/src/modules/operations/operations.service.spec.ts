import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OperationsService } from './operations.service';
import { FolioService } from '../folio/folio.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigService } from '../../system-config/system-config.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FIXED_DATE = new Date('2026-05-15T00:00:00.000Z');

function makeReservation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'res-001',
    guestId: 'guest-001',
    roomId: 'room-001',
    roomTypeId: 'rt-001',
    checkInDate: FIXED_DATE,
    checkOutDate: new Date('2026-05-17T00:00:00.000Z'),
    status: 'CONFIRMED',
    source: 'DIRECT',
    adults: 2,
    children: 0,
    notes: null,
    totalNights: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    room: {
      id: 'room-001',
      number: '101',
      physicalStatus: 'AVAILABLE',
      cleaningStatus: 'CLEAN',
    },
    folio: null,
    ...overrides,
  };
}

function makeStay(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'stay-001',
    reservationId: 'res-001',
    roomId: 'room-001',
    arrivedAt: new Date(),
    departedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeFolio(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'folio-001',
    reservationId: 'res-001',
    isOpen: true,
    closedAt: null,
    snapshotHash: null,
    snapshotTotal: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('OperationsService', () => {
  let service: OperationsService;
  let prismaMock: any;
  let folioServiceMock: any;
  let eventEmitterMock: any;
  let txMock: any;

  beforeEach(async () => {
    // txMock simulates the Prisma transaction client
    txMock = {
      reservation: {
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
      },
      room: {
        update: vi.fn(),
      },
      stay: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      folio: {
        findUnique: vi.fn(),
      },
    };

    prismaMock = {
      $transaction: vi.fn(async (cb: any) => cb(txMock)),
      _txMock: txMock,
    };

    // FolioService mock — we test the real integration guard separately (Test 7)
    folioServiceMock = {
      openFolio: vi.fn().mockResolvedValue(makeFolio()),
      closeFolio: vi.fn().mockResolvedValue(makeFolio({ isOpen: false })),
      guardOpen: vi.fn(),
      postCharge: vi.fn(),
    };

    eventEmitterMock = {
      emitAsync: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FolioService, useValue: folioServiceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get(OperationsService);
  });

  // ── Test 1: checkIn wraps 4 mutations in $transaction ────────────────────

  it('Test 1 — checkIn: all 4 mutations called inside same $transaction (CONFIRMED→CHECKED_IN, OCCUPIED, Stay, Folio)', async () => {
    const reservation = makeReservation();
    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);
    txMock.reservation.update.mockResolvedValue({ ...reservation, status: 'CHECKED_IN' });
    txMock.room.update.mockResolvedValue({ ...reservation.room, physicalStatus: 'OCCUPIED' });
    txMock.stay.create.mockResolvedValue(makeStay());

    await service.checkIn('res-001', 'user-001');

    // Verify $transaction was called
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

    // Verify all 4 mutations called with the same tx client
    expect(txMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CHECKED_IN' } }),
    );
    expect(txMock.room.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ physicalStatus: 'OCCUPIED' }) }),
    );
    expect(txMock.stay.create).toHaveBeenCalled();
    expect(folioServiceMock.openFolio).toHaveBeenCalledWith(txMock, 'res-001');
  });

  // ── Test 2: checkIn throws if status != CONFIRMED ────────────────────────

  it('Test 2 — checkIn throws BadRequestException if reservation is not CONFIRMED', async () => {
    const reservation = makeReservation({ status: 'CHECKED_IN' });
    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);

    await expect(service.checkIn('res-001', 'user-001')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('Test 2b — checkIn throws BadRequestException if reservation is CANCELLED', async () => {
    const reservation = makeReservation({ status: 'CANCELLED' });
    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);

    await expect(service.checkIn('res-001', 'user-001')).rejects.toThrow(
      BadRequestException,
    );
  });

  // ── Test 3: checkIn throws 412 if cleaningStatus DIRTY or IN_PROGRESS ────

  it('Test 3a — checkIn throws PreconditionFailedException if room.cleaningStatus is DIRTY (OPS-03)', async () => {
    const reservation = makeReservation({ room: { id: 'room-001', number: '101', physicalStatus: 'AVAILABLE', cleaningStatus: 'DIRTY' } });
    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);

    await expect(service.checkIn('res-001', 'user-001')).rejects.toThrow(/412|PreconditionFailed|DIRTY/i);
  });

  it('Test 3b — checkIn throws PreconditionFailedException if room.cleaningStatus is IN_PROGRESS', async () => {
    const reservation = makeReservation({ room: { id: 'room-001', number: '101', physicalStatus: 'AVAILABLE', cleaningStatus: 'IN_PROGRESS' } });
    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);

    await expect(service.checkIn('res-001', 'user-001')).rejects.toThrow(/412|PreconditionFailed|IN_PROGRESS|cleaningStatus/i);
  });

  // ── Test 4: checkIn throws if roomId is NULL ─────────────────────────────

  it('Test 4 — checkIn throws BadRequestException if reservation.roomId is NULL (P12)', async () => {
    const reservation = makeReservation({ roomId: null, room: null });
    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);

    await expect(service.checkIn('res-001', 'user-001')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.checkIn('res-001', 'user-001')).rejects.toThrow(
      /room/i,
    );
  });

  // ── Test 4c: checkIn throws 409 when room is already OCCUPIED ───────────
  // Real-world trigger: room 101 has a prior CHECKED_IN reservation that was
  // never checked out.  Attempting to check in a second reservation assigned to
  // that room must return 409 ConflictException with the room number in the
  // message — NOT a raw DomainException / 500.

  it('Test 4c — checkIn throws ConflictException (409) when room.physicalStatus is already OCCUPIED', async () => {
    const reservation = makeReservation({
      room: {
        id: 'room-001',
        number: '101',
        physicalStatus: 'OCCUPIED',
        cleaningStatus: 'CLEAN',
      },
    });
    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);

    await expect(service.checkIn('res-001', 'user-001')).rejects.toThrow(
      ConflictException,
    );
    await expect(service.checkIn('res-001', 'user-001')).rejects.toThrow(
      /101/,
    );
  });

  it('Test 4d — checkIn throws ConflictException (409) for any other invalid physicalStatus transition (e.g. OUT_OF_SERVICE)', async () => {
    const reservation = makeReservation({
      room: {
        id: 'room-001',
        number: '202',
        physicalStatus: 'OUT_OF_SERVICE',
        cleaningStatus: 'CLEAN',
      },
    });
    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);

    // OUT_OF_SERVICE → OCCUPIED is not in PHYSICAL_TRANSITIONS — must surface as 409
    await expect(service.checkIn('res-001', 'user-001')).rejects.toThrow(
      ConflictException,
    );
  });

  // ── Test 5: checkOut wraps mutations + closeFolio in $transaction ─────────

  it('Test 5 — checkOut: transitions to CHECKED_OUT + AVAILABLE + Stay.departedAt + closeFolio', async () => {
    const reservation = makeReservation({
      status: 'CHECKED_IN',
      room: { id: 'room-001', number: '101', physicalStatus: 'OCCUPIED', cleaningStatus: 'CLEAN' },
    });
    const existingFolio = makeFolio();

    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);
    txMock.reservation.update.mockResolvedValue({ ...reservation, status: 'CHECKED_OUT' });
    txMock.room.update.mockResolvedValue({ ...reservation.room, physicalStatus: 'AVAILABLE' });
    txMock.stay.findFirst.mockResolvedValue(makeStay());
    txMock.stay.update.mockResolvedValue(makeStay({ departedAt: new Date() }));
    txMock.folio.findUnique.mockResolvedValue(existingFolio);

    await service.checkOut('res-001', 'user-001');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CHECKED_OUT' } }),
    );
    expect(txMock.room.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ physicalStatus: 'AVAILABLE' }) }),
    );
    expect(folioServiceMock.closeFolio).toHaveBeenCalledWith(txMock, 'folio-001');
  });

  // ── Test 6: checkOut throws if not CHECKED_IN ────────────────────────────

  it('Test 6 — checkOut throws BadRequestException if reservation is not CHECKED_IN', async () => {
    const reservation = makeReservation({ status: 'CONFIRMED' });
    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);

    await expect(service.checkOut('res-001', 'user-001')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('Test 6b — checkOut throws ConflictException (409) when room.physicalStatus is not OCCUPIED (invalid transition)', async () => {
    // Edge case: room was somehow set to AVAILABLE before checkOut was called.
    // transitionPhysicalStatus(AVAILABLE → AVAILABLE) is not in the state machine.
    const reservation = makeReservation({
      status: 'CHECKED_IN',
      room: {
        id: 'room-001',
        number: '101',
        physicalStatus: 'AVAILABLE',
        cleaningStatus: 'CLEAN',
      },
    });
    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);

    await expect(service.checkOut('res-001', 'user-001')).rejects.toThrow(
      ConflictException,
    );
    await expect(service.checkOut('res-001', 'user-001')).rejects.toThrow(
      /101/,
    );
  });

  // ── Test 7: folio immutable after checkOut ────────────────────────────────

  it('Test 7 — after checkOut, FolioService.closeFolio is called and folio is closed', async () => {
    const reservation = makeReservation({
      status: 'CHECKED_IN',
      room: { id: 'room-001', number: '101', physicalStatus: 'OCCUPIED', cleaningStatus: 'CLEAN' },
    });
    const closedFolio = makeFolio({ isOpen: false, snapshotHash: 'abc123' });

    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);
    txMock.reservation.update.mockResolvedValue({ ...reservation, status: 'CHECKED_OUT' });
    txMock.room.update.mockResolvedValue(reservation.room);
    txMock.stay.findFirst.mockResolvedValue(makeStay());
    txMock.stay.update.mockResolvedValue(makeStay({ departedAt: new Date() }));
    txMock.folio.findUnique.mockResolvedValue(makeFolio());
    folioServiceMock.closeFolio.mockResolvedValue(closedFolio);

    const result = await service.checkOut('res-001', 'user-001');

    // closeFolio was called
    expect(folioServiceMock.closeFolio).toHaveBeenCalled();
    // The folio returned from closeFolio is closed
    const folioResult = result.folio;
    expect(folioResult?.isOpen).toBe(false);
    expect(folioResult?.snapshotHash).toBe('abc123');
  });

  // ── Test 10: checkOut emits 'reservation.checked_out' AFTER $transaction ──

  it('Test 10 — checkOut emits reservation.checked_out event AFTER $transaction resolves', async () => {
    const reservation = makeReservation({
      status: 'CHECKED_IN',
      room: { id: 'room-001', number: '101', physicalStatus: 'OCCUPIED', cleaningStatus: 'CLEAN' },
    });

    txMock.reservation.findUniqueOrThrow.mockResolvedValue(reservation);
    txMock.reservation.update.mockResolvedValue({ ...reservation, status: 'CHECKED_OUT' });
    txMock.room.update.mockResolvedValue(reservation.room);
    txMock.stay.findFirst.mockResolvedValue(makeStay());
    txMock.stay.update.mockResolvedValue(makeStay({ departedAt: new Date() }));
    txMock.folio.findUnique.mockResolvedValue(makeFolio());

    await service.checkOut('res-001', 'user-001');

    // Event must be emitted AFTER the transaction completes
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(eventEmitterMock.emitAsync).toHaveBeenCalledWith(
      'reservation.checked_out',
      expect.objectContaining({
        reservationId: 'res-001',
        roomId: 'room-001',
      }),
    );

    // Ordering: transaction mock was called first (invocationCallOrder comparison)
    const txCallOrder = prismaMock.$transaction.mock.invocationCallOrder[0];
    const emitCallOrder = eventEmitterMock.emitAsync.mock.invocationCallOrder[0];
    expect(txCallOrder).toBeLessThan(emitCallOrder);
  });

  // ── Test 11: if $transaction rejects, emitAsync is NEVER called ──────────

  it('Test 11 — checkOut does NOT emit if $transaction rejects', async () => {
    prismaMock.$transaction.mockRejectedValue(new Error('DB error'));

    await expect(service.checkOut('res-001', 'user-001')).rejects.toThrow('DB error');

    expect(eventEmitterMock.emitAsync).not.toHaveBeenCalled();
  });
});
