import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsRepository } from './reservations.repository';
import { GuestsRepository } from '../guests/guests.repository';
import { InventoryRepository } from '../inventory/inventory.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { CreateReservationSchema } from './dto/create-reservation.dto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal valid CreateReservationDto for tests */
const validDto = {
  guestId: 'cmte4a1c2fd8bcf83b0ba4b18',
  roomId: 'cmtreservtest0000reservid',
  roomTypeId: 'cmtgueststest0000guestxid',
  checkInDate: '2026-06-10',
  checkOutDate: '2026-06-13',
  source: 'DIRECT' as const,
  adults: 2,
};

/** Make a PrismaClientKnownRequestError with given code + optional meta */
function makePrismaError(code: string, metaCode?: string): PrismaClientKnownRequestError {
  const err = new PrismaClientKnownRequestError('test error', {
    code,
    clientVersion: '7.0.0',
    meta: metaCode ? { code: metaCode } : undefined,
  });
  return err;
}

/** Make a raw error with given code property */
function makeRawError(code: string) {
  const err = new Error('raw error') as any;
  err.code = code;
  return err;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('ReservationsService', () => {
  let service: ReservationsService;
  let txMock: {
    $executeRaw: ReturnType<typeof vi.fn>;
    reservation: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let prismaMock: {
    $transaction: ReturnType<typeof vi.fn>;
  };
  let reservationsRepoMock: {
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let guestsRepoMock: {
    findById: ReturnType<typeof vi.fn>;
  };
  let inventoryRepoMock: {
    findRoomById: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    txMock = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      reservation: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    prismaMock = {
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
    };

    reservationsRepoMock = {
      findById: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    };

    guestsRepoMock = {
      findById: vi.fn().mockResolvedValue({ id: validDto.guestId }),
    };

    inventoryRepoMock = {
      findRoomById: vi.fn().mockResolvedValue({ id: validDto.roomId }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ReservationsRepository, useValue: reservationsRepoMock },
        { provide: GuestsRepository, useValue: guestsRepoMock },
        { provide: InventoryRepository, useValue: inventoryRepoMock },
      ],
    }).compile();

    service = module.get(ReservationsService);
  });

  // ── Test 1: Transaction + SELECT FOR UPDATE call order ────────────────────

  it('Test 1 — create() calls $transaction once; $executeRaw (SELECT FOR UPDATE) before reservation.create', async () => {
    const createdReservation = { id: 'res-1', ...validDto, totalNights: 3, status: 'CONFIRMED', children: 0 };
    txMock.reservation.create.mockResolvedValue(createdReservation);

    await service.create(validDto);

    // $transaction called exactly once
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

    // $executeRaw called before reservation.create (call order check)
    const executeOrder = txMock.$executeRaw.mock.invocationCallOrder[0];
    const createOrder = txMock.reservation.create.mock.invocationCallOrder[0];
    expect(executeOrder).toBeLessThan(createOrder);
  });

  // ── Test 2: 23P01 raw error → ConflictException ────────────────────────────

  it('Test 2 — raw err.code=23P01 → ConflictException with "Habitación no disponible"', async () => {
    txMock.reservation.create.mockRejectedValue(makeRawError('23P01'));

    await expect(service.create(validDto)).rejects.toThrow(ConflictException);
    await expect(service.create(validDto)).rejects.toThrow('Habitación no disponible');
  });

  // ── Test 3: PrismaClientKnownRequestError meta.code=23P01 → ConflictException

  it('Test 3 — PrismaClientKnownRequestError meta.code=23P01 → ConflictException (Pitfall P2)', async () => {
    // Prisma wraps 23P01 in meta.code on some paths
    txMock.reservation.create.mockRejectedValue(makePrismaError('P2010', '23P01'));

    await expect(service.create(validDto)).rejects.toThrow(ConflictException);
  });

  // ── Test 4: Unrelated error passes through ────────────────────────────────

  it('Test 4 — unrelated error (P2003 FK violation) is re-thrown as-is', async () => {
    const fkError = makePrismaError('P2003');
    txMock.reservation.create.mockRejectedValue(fkError);

    await expect(service.create(validDto)).rejects.toThrow(fkError);
    // Must NOT be wrapped as ConflictException
    await expect(service.create(validDto)).rejects.not.toThrow(ConflictException);
  });

  // ── Test 5: modify() catches 23P01 (Pitfall P7) ───────────────────────────

  it('Test 5 — modify() with 23P01 from update → ConflictException (Pitfall P7)', async () => {
    const existingReservation = { id: 'res-1', status: 'CONFIRMED', roomId: validDto.roomId };
    reservationsRepoMock.findById.mockResolvedValue(existingReservation);
    txMock.reservation.update.mockRejectedValue(makeRawError('23P01'));

    await expect(
      service.modify('res-1', { checkInDate: '2026-06-11', checkOutDate: '2026-06-14' }),
    ).rejects.toThrow(ConflictException);
  });

  // ── Test 6: cancel() sets status CANCELLED (does not delete) ──────────────

  it('Test 6 — cancel() calls repository.cancel(id) without deleting the row', async () => {
    const existing = { id: 'res-1', status: 'CONFIRMED' };
    reservationsRepoMock.findById.mockResolvedValue(existing);
    reservationsRepoMock.cancel.mockResolvedValue({ ...existing, status: 'CANCELLED' });

    await service.cancel('res-1');

    expect(reservationsRepoMock.cancel).toHaveBeenCalledWith('res-1');
    expect(reservationsRepoMock.cancel).toHaveBeenCalledTimes(1);
  });

  // ── Test 7: CreateReservationSchema accepts body without roomId ──────────
  //
  // 2026-05-27 — With the 'request to book by type' model the admin may create
  // a reservation that has no physical room assigned yet (the room is chosen at
  // check-in). roomId is therefore optional on the staff create endpoint.

  it('Test 7 — CreateReservationSchema accepts body without roomId (assigned later)', () => {
    const { roomId: _, ...noRoomId } = validDto;
    const result = CreateReservationSchema.safeParse(noRoomId);
    expect(result.success).toBe(true);
  });

  // ── Test 8: CreateReservationSchema rejects invalid source ────────────────

  it('Test 8 — CreateReservationSchema rejects invalid source value', () => {
    const result = CreateReservationSchema.safeParse({ ...validDto, source: 'INVALID_SOURCE' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('source');
    }
  });

  // ── Test 9: reactivate() happy path ───────────────────────────────────────

  it('Test 9 — reactivate() on CANCELLED reservation returns reservation in PENDING', async () => {
    const cancelled = { id: 'res-1', status: 'CANCELLED' };
    const reactivated = { ...cancelled, status: 'PENDING' };
    reservationsRepoMock.findById.mockResolvedValue(cancelled);
    reservationsRepoMock.update.mockResolvedValue(reactivated);

    const result = await service.reactivate('res-1');

    expect(reservationsRepoMock.update).toHaveBeenCalledWith('res-1', { status: 'PENDING' });
    expect(result).toMatchObject({ id: 'res-1', status: 'PENDING' });
  });

  // ── Test 10: reactivate() 23P01 exclusion violation → ConflictException ────
  //
  // Regression for: POST /api/reservations/:id/reactivate returning HTTP 500
  // when the room already has an overlapping active reservation.
  // Root cause: missing try/catch around repo.update — the DB exclusion
  // constraint no_overlapping_reservations (migration 20260516000000) fires
  // 23P01 which propagated as a raw 500. Fix: same pattern as create() /
  // modify() / confirm() (Pitfall P7).

  it('Test 10 — reactivate() with raw 23P01 error → ConflictException (not raw 500)', async () => {
    const cancelled = { id: 'res-1', status: 'CANCELLED' };
    reservationsRepoMock.findById.mockResolvedValue(cancelled);
    reservationsRepoMock.update.mockRejectedValue(makeRawError('23P01'));

    await expect(service.reactivate('res-1')).rejects.toThrow(ConflictException);
    await expect(service.reactivate('res-1')).rejects.toThrow(
      'No se puede reactivar: la habitación ya está reservada por otra reserva en esas fechas.',
    );
  });

  it('Test 11 — reactivate() with PrismaClientKnownRequestError meta.code=23P01 → ConflictException', async () => {
    const cancelled = { id: 'res-1', status: 'CANCELLED' };
    reservationsRepoMock.findById.mockResolvedValue(cancelled);
    reservationsRepoMock.update.mockRejectedValue(makePrismaError('P2010', '23P01'));

    await expect(service.reactivate('res-1')).rejects.toThrow(ConflictException);
  });

  it('Test 12 — reactivate() unrelated error is re-thrown as-is (not swallowed)', async () => {
    const cancelled = { id: 'res-1', status: 'CANCELLED' };
    const dbError = makePrismaError('P2003');
    reservationsRepoMock.findById.mockResolvedValue(cancelled);
    reservationsRepoMock.update.mockRejectedValue(dbError);

    await expect(service.reactivate('res-1')).rejects.toThrow(dbError);
    await expect(service.reactivate('res-1')).rejects.not.toThrow(ConflictException);
  });

  // ── Test 13: create() computes totalNights correctly ──────────────────────

  it('Test 13 — create() computes totalNights = 3 for Jun 10 → Jun 13', async () => {
    let capturedData: any;
    txMock.reservation.create.mockImplementation(async ({ data }: any) => {
      capturedData = data;
      return { id: 'res-1', ...data, status: 'CONFIRMED' };
    });

    await service.create(validDto); // checkIn Jun 10, checkOut Jun 13 = 3 nights

    expect(capturedData.totalNights).toBe(3);
  });
});
