/**
 * reservations.repository.spec.ts
 *
 * Regression tests for the RESERVATION_SELECT shape.
 *
 * Root cause (2026-05-29): RESERVATION_SELECT was missing the `guest` and `room`
 * relations. Every admin list/findById response carried `guest: undefined`,
 * crashing the admin UI whenever a component read `.guest.fullName` without a
 * null guard.
 *
 * These tests verify that:
 * 1. findAll() forwards a select that includes `guest` (proves the fix).
 * 2. findById() forwards a select that includes `room`.
 * 3. findAll() includes `sourceOffer` (non-regression for the 2026-05-28 field).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReservationsRepository } from './reservations.repository';
import { PrismaService } from '../../prisma/prisma.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal Prisma reservation record that includes the guest + room relations. */
function makeReservationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'res-001',
    guestId: 'guest-001',
    roomId: 'room-001',
    roomTypeId: 'rt-001',
    checkInDate: new Date('2026-07-01'),
    checkOutDate: new Date('2026-07-03'),
    status: 'CONFIRMED',
    source: 'DIRECT',
    adults: 2,
    children: 0,
    totalNights: 2,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sourceOfferId: null,
    sourceOffer: null,
    guest: {
      id: 'guest-001',
      fullName: 'Ana Torres',
      email: 'ana@example.com',
      phone: '+573001234567',
      documentType: 'CC',
      nationality: 'CO',
      dateOfBirth: new Date('1990-01-01'),
    },
    room: {
      id: 'room-001',
      number: '101',
      floor: 1,
      roomTypeId: 'rt-001',
      roomType: { id: 'rt-001', name: 'Standard', basePrice: 200000 },
    },
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ReservationsRepository — RESERVATION_SELECT shape (regression: guest + room)', () => {
  let repository: ReservationsRepository;
  let reservationMock: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    reservationMock = {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ReservationsRepository,
        {
          provide: PrismaService,
          useValue: { reservation: reservationMock },
        },
      ],
    }).compile();

    repository = module.get(ReservationsRepository);
  });

  // ── Test R1: findAll() select includes guest ──────────────────────────────

  it('R1 — findAll() passes a select that includes a guest sub-select', async () => {
    reservationMock.findMany.mockResolvedValue([makeReservationRow()]);

    await repository.findAll();

    expect(reservationMock.findMany).toHaveBeenCalledTimes(1);
    const callArgs = reservationMock.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    // The select object must contain a `guest` key with a nested select
    expect(callArgs.select).toBeDefined();
    expect(callArgs.select['guest']).toBeDefined();
    expect(typeof callArgs.select['guest']).toBe('object');
    // Verify guest.select contains at least fullName and id
    const guestSelect = (callArgs.select['guest'] as { select: Record<string, unknown> }).select;
    expect(guestSelect['fullName']).toBe(true);
    expect(guestSelect['id']).toBe(true);
  });

  // ── Test R2: findAll() select includes room ───────────────────────────────

  it('R2 — findAll() passes a select that includes a room sub-select', async () => {
    reservationMock.findMany.mockResolvedValue([makeReservationRow()]);

    await repository.findAll();

    const callArgs = reservationMock.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(callArgs.select['room']).toBeDefined();
    const roomSelect = (callArgs.select['room'] as { select: Record<string, unknown> }).select;
    expect(roomSelect['number']).toBe(true);
    expect(roomSelect['id']).toBe(true);
  });

  // ── Test R3: findById() select includes guest ─────────────────────────────

  it('R3 — findById() passes a select that includes guest (row with guest relation)', async () => {
    const row = makeReservationRow();
    reservationMock.findUnique.mockResolvedValue(row);

    const result = await repository.findById('res-001');

    expect(result.id).toBe('res-001');
    const callArgs = reservationMock.findUnique.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(callArgs.select['guest']).toBeDefined();
  });

  // ── Test R4: findById() throws NotFoundException when row is null ─────────

  it('R4 — findById() throws NotFoundException when reservation not found', async () => {
    reservationMock.findUnique.mockResolvedValue(null);

    await expect(repository.findById('nonexistent')).rejects.toThrow(NotFoundException);
  });

  // ── Test R5: findAll() select still includes sourceOffer (non-regression) ──

  it('R5 — findAll() select still includes sourceOffer sub-select (2026-05-28 non-regression)', async () => {
    reservationMock.findMany.mockResolvedValue([makeReservationRow()]);

    await repository.findAll();

    const callArgs = reservationMock.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(callArgs.select['sourceOffer']).toBeDefined();
    const offerSelect = (callArgs.select['sourceOffer'] as { select: Record<string, unknown> }).select;
    expect(offerSelect['title']).toBe(true);
  });
});
