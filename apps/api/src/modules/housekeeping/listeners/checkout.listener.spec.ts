import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { CheckoutListener } from './checkout.listener';
import { HousekeepingService } from '../housekeeping.service';
import { HousekeepingRepository } from '../housekeeping.repository';
import { PrismaService } from '../../../prisma/prisma.service';

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('CheckoutListener', () => {
  let listener: CheckoutListener;
  let hkServiceMock: any;

  beforeEach(async () => {
    hkServiceMock = {
      forceTransitionToDirty: vi.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutListener,
        { provide: HousekeepingService, useValue: hkServiceMock },
      ],
    }).compile();

    listener = module.get(CheckoutListener);
  });

  // ── Test 1: @OnEvent('reservation.checked_out') decorator metadata ──────

  it('Test 1 — @OnEvent("reservation.checked_out") metadata is present on handleCheckout', () => {
    const proto = CheckoutListener.prototype;
    // @nestjs/event-emitter v2.x uses extendArrayMetadata — stores an ARRAY of listener configs
    // Key: 'EVENT_LISTENER_METADATA' (from @nestjs/event-emitter/dist/constants.js)
    // Shape: [{ event: string, options?: object }]
    const metaArray = Reflect.getMetadata('EVENT_LISTENER_METADATA', proto.handleCheckout);
    expect(Array.isArray(metaArray)).toBe(true);
    expect(metaArray.length).toBeGreaterThan(0);
    const meta = metaArray[0];
    expect(meta.event).toBe('reservation.checked_out');
  });

  // ── Test 2: calls forceTransitionToDirty with payload values ────────────

  it('Test 2 — handleCheckout calls forceTransitionToDirty with roomId and at', async () => {
    const event = {
      reservationId: 'res-001',
      roomId: 'room-001',
      at: '2026-05-15T10:00:00.000Z',
    };

    await listener.handleCheckout(event);

    expect(hkServiceMock.forceTransitionToDirty).toHaveBeenCalledWith(
      'room-001',
      '2026-05-15T10:00:00.000Z',
    );
  });

  // ── Test 3: listener does NOT throw when service rejects ─────────────────

  it('Test 3 — handleCheckout does not throw when forceTransitionToDirty rejects', async () => {
    hkServiceMock.forceTransitionToDirty.mockRejectedValue(
      new Error('DB connection lost'),
    );

    // The listener must catch the error and NOT rethrow (P1 from RESEARCH §5)
    await expect(
      listener.handleCheckout({ reservationId: 'res-001', roomId: 'room-001', at: '2026-05-15T10:00:00.000Z' }),
    ).resolves.toBeUndefined();
  });
});
