import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { HousekeepingService } from './housekeeping.service';
import { HousekeepingRepository } from './housekeeping.repository';
import { HousekeepingGateway } from './housekeeping.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { CleaningDomainException } from './domain/cleaning-transitions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRoom(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'room-001',
    number: '101',
    floor: 1,
    roomTypeId: 'rt-001',
    physicalStatus: 'AVAILABLE',
    cleaningStatus: 'DIRTY',
    notes: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'task-001',
    roomId: 'room-001',
    assignedToId: 'user-001',
    createdById: 'manager-001',
    priority: 'HIGH',
    status: 'OPEN',
    notes: null,
    completedAt: null,
    businessDate: new Date('2026-05-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('HousekeepingService', () => {
  let service: HousekeepingService;
  let prismaMock: any;
  let repoMock: any;
  let gatewayMock: { emitStatusUpdate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prismaMock = {
      room: {
        findUniqueOrThrow: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      housekeepingTask: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
    };

    repoMock = {
      findUserActiveTaskForRoom: vi.fn(),
    };

    gatewayMock = {
      emitStatusUpdate: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HousekeepingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: HousekeepingRepository, useValue: repoMock },
        { provide: HousekeepingGateway, useValue: gatewayMock },
      ],
    }).compile();

    service = module.get(HousekeepingService);
  });

  // ── Test 1: HOUSEKEEPING role with assigned task succeeds ─────────────────

  it('Test 1 — transitionRoomCleaningStatus: HOUSEKEEPING role + assigned task → updates room', async () => {
    const room = makeRoom({ cleaningStatus: 'DIRTY' });
    prismaMock.room.findUniqueOrThrow.mockResolvedValue(room);
    repoMock.findUserActiveTaskForRoom.mockResolvedValue(makeTask());
    prismaMock.room.update.mockResolvedValue({ ...room, cleaningStatus: 'IN_PROGRESS' });

    const result = await service.transitionRoomCleaningStatus(
      'room-001',
      'IN_PROGRESS',
      'user-001',
      'HOUSEKEEPING',
    );

    expect(prismaMock.room.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { cleaningStatus: 'IN_PROGRESS' } }),
    );
    expect(result.to).toBe('IN_PROGRESS');
  });

  // ── Test 2: HOUSEKEEPING role without assigned task throws ForbiddenException ──

  it('Test 2 — transitionRoomCleaningStatus: HOUSEKEEPING + no assigned task → ForbiddenException', async () => {
    const room = makeRoom({ cleaningStatus: 'DIRTY' });
    prismaMock.room.findUniqueOrThrow.mockResolvedValue(room);
    repoMock.findUserActiveTaskForRoom.mockResolvedValue(null); // no active task

    await expect(
      service.transitionRoomCleaningStatus('room-001', 'IN_PROGRESS', 'user-001', 'HOUSEKEEPING'),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Test 3: MANAGER role bypasses ownership check ─────────────────────────

  it('Test 3 — transitionRoomCleaningStatus: MANAGER role succeeds without task ownership check', async () => {
    const room = makeRoom({ cleaningStatus: 'DIRTY' });
    prismaMock.room.findUniqueOrThrow.mockResolvedValue(room);
    prismaMock.room.update.mockResolvedValue({ ...room, cleaningStatus: 'IN_PROGRESS' });

    await service.transitionRoomCleaningStatus(
      'room-001',
      'IN_PROGRESS',
      'manager-001',
      'MANAGER',
    );

    // findUserActiveTaskForRoom should NOT be called for MANAGER
    expect(repoMock.findUserActiveTaskForRoom).not.toHaveBeenCalled();
    expect(prismaMock.room.update).toHaveBeenCalled();
  });

  // ── Test 4: ADMIN role blocked by state machine (DIRTY→CLEAN) ─────────────

  it('Test 4 — transitionRoomCleaningStatus: ADMIN + DIRTY→CLEAN throws CleaningDomainException', async () => {
    const room = makeRoom({ cleaningStatus: 'DIRTY' });
    prismaMock.room.findUniqueOrThrow.mockResolvedValue(room);

    await expect(
      service.transitionRoomCleaningStatus('room-001', 'CLEAN', 'admin-001', 'ADMIN'),
    ).rejects.toThrow(CleaningDomainException);
    await expect(
      service.transitionRoomCleaningStatus('room-001', 'CLEAN', 'admin-001', 'ADMIN'),
    ).rejects.toThrow(/Invalid cleaningStatus transition: DIRTY → CLEAN/);
  });

  // ── Test 5: createTask creates task with status OPEN ─────────────────────

  it('Test 5 — createTask: returns task with status=OPEN, createdById=callerId, businessDate=today', async () => {
    const expectedTask = makeTask({ status: 'OPEN', createdById: 'manager-001' });
    prismaMock.housekeepingTask.create.mockResolvedValue(expectedTask);

    const result = await service.createTask(
      { roomId: 'room-001', assignedToId: 'user-001', priority: 'HIGH', notes: undefined },
      'manager-001',
    );

    expect(prismaMock.housekeepingTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'OPEN',
          createdById: 'manager-001',
          priority: 'HIGH',
        }),
      }),
    );
    expect(result.status).toBe('OPEN');
  });

  // ── Test 6: listTasksForUser filters correctly for HOUSEKEEPING role ──────

  it('Test 6 — listTasksForUser: HOUSEKEEPING role returns tasks for user or unassigned', async () => {
    const tasks = [makeTask(), makeTask({ id: 'task-002', assignedToId: null })];
    prismaMock.housekeepingTask.findMany.mockResolvedValue(tasks);

    await service.listTasksForUser('user-001', 'HOUSEKEEPING');

    expect(prismaMock.housekeepingTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ assignedToId: 'user-001' }),
            expect.objectContaining({ assignedToId: null }),
          ]),
          NOT: { status: 'DONE' },
        }),
      }),
    );
  });

  // ── Test 7: updateTaskStatus enforces ownership for HOUSEKEEPING ──────────

  it('Test 7 — updateTaskStatus: HOUSEKEEPING role throws ForbiddenException if not task owner', async () => {
    const task = makeTask({ assignedToId: 'other-user' }); // caller is 'user-001'
    prismaMock.housekeepingTask.findUnique.mockResolvedValue(task);

    await expect(
      service.updateTaskStatus('task-001', 'IN_PROGRESS', 'user-001', 'HOUSEKEEPING'),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Test 8: forceTransitionToDirty idempotent when already DIRTY ──────────

  it('Test 8 — forceTransitionToDirty: idempotent when room.cleaningStatus already DIRTY', async () => {
    const room = makeRoom({ cleaningStatus: 'DIRTY' });
    prismaMock.room.findUniqueOrThrow.mockResolvedValue(room);

    await service.forceTransitionToDirty('room-001', new Date().toISOString());

    // prisma.room.update must NOT be called
    expect(prismaMock.room.update).not.toHaveBeenCalled();
  });

  // ── Test W4 (Plan-check W4): RECEPTION role → ForbiddenException on createTask ──

  it('Test W4 — createTask: RECEPTION role throws ForbiddenException (read-only)', async () => {
    await expect(
      service.createTask(
        { roomId: 'room-001', assignedToId: null, priority: 'MEDIUM' },
        'receptionist-001',
        'RECEPTION',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Test: RECEPTION blocked on transitionRoomCleaningStatus ──────────────

  it('Test 9 — transitionRoomCleaningStatus: RECEPTION role throws ForbiddenException', async () => {
    const room = makeRoom({ cleaningStatus: 'DIRTY' });
    prismaMock.room.findUniqueOrThrow.mockResolvedValue(room);

    await expect(
      service.transitionRoomCleaningStatus('room-001', 'IN_PROGRESS', 'reception-001', 'RECEPTION'),
    ).rejects.toThrow(ForbiddenException);
  });

  // ─── Phase 05-02 Tests: gateway emit ─────────────────────────────────────

  // ── Test 11: transitionRoomCleaningStatus calls gateway.emitStatusUpdate AFTER prisma.room.update ──

  it('Test 11 — transitionRoomCleaningStatus: calls gateway.emitStatusUpdate AFTER prisma.room.update', async () => {
    const room = makeRoom({ cleaningStatus: 'DIRTY' });
    prismaMock.room.findUniqueOrThrow.mockResolvedValue(room);
    prismaMock.room.update.mockResolvedValue({ ...room, cleaningStatus: 'IN_PROGRESS' });

    // Track call order
    const callOrder: string[] = [];
    prismaMock.room.update.mockImplementation(async (...args: unknown[]) => {
      callOrder.push('prisma.room.update');
      return { ...room, cleaningStatus: 'IN_PROGRESS' };
    });
    gatewayMock.emitStatusUpdate.mockImplementation((...args: unknown[]) => {
      callOrder.push('gateway.emitStatusUpdate');
    });

    await service.transitionRoomCleaningStatus(
      'room-001',
      'IN_PROGRESS',
      'manager-001',
      'MANAGER',
    );

    expect(gatewayMock.emitStatusUpdate).toHaveBeenCalledOnce();
    expect(gatewayMock.emitStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-001',
        from: 'DIRTY',
        to: 'IN_PROGRESS',
        byUserId: 'manager-001',
      }),
    );
    // P3: prisma.update MUST precede emit in call order
    expect(callOrder.indexOf('prisma.room.update')).toBeLessThan(
      callOrder.indexOf('gateway.emitStatusUpdate'),
    );
  });

  // ── Test 12: transitionRoomCleaningStatus does NOT call emitStatusUpdate on state machine error ──

  it('Test 12 — transitionRoomCleaningStatus: state machine throws → gateway.emitStatusUpdate NOT called', async () => {
    const room = makeRoom({ cleaningStatus: 'DIRTY' });
    prismaMock.room.findUniqueOrThrow.mockResolvedValue(room);

    // DIRTY → CLEAN is invalid
    await expect(
      service.transitionRoomCleaningStatus('room-001', 'CLEAN', 'admin-001', 'ADMIN'),
    ).rejects.toThrow(CleaningDomainException);

    expect(gatewayMock.emitStatusUpdate).not.toHaveBeenCalled();
  });

  // ── Test 13: forceTransitionToDirty calls emitStatusUpdate with byUserId null (non-idempotent path) ──

  it('Test 13 — forceTransitionToDirty: calls gateway.emitStatusUpdate with byUserId: null AFTER update (non-DIRTY room)', async () => {
    const room = makeRoom({ cleaningStatus: 'CLEAN' }); // Not DIRTY → update happens
    prismaMock.room.findUniqueOrThrow.mockResolvedValue(room);
    prismaMock.room.update.mockResolvedValue({ ...room, cleaningStatus: 'DIRTY' });

    const callOrder: string[] = [];
    prismaMock.room.update.mockImplementation(async (...args: unknown[]) => {
      callOrder.push('prisma.room.update');
      return { ...room, cleaningStatus: 'DIRTY' };
    });
    gatewayMock.emitStatusUpdate.mockImplementation((...args: unknown[]) => {
      callOrder.push('gateway.emitStatusUpdate');
    });

    await service.forceTransitionToDirty('room-001', '2026-05-15T12:00:00.000Z');

    expect(gatewayMock.emitStatusUpdate).toHaveBeenCalledOnce();
    expect(gatewayMock.emitStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-001',
        from: 'CLEAN',
        to: 'DIRTY',
        byUserId: null,
        at: '2026-05-15T12:00:00.000Z',
      }),
    );
    // P3: prisma.update MUST precede emit
    expect(callOrder.indexOf('prisma.room.update')).toBeLessThan(
      callOrder.indexOf('gateway.emitStatusUpdate'),
    );
  });

  // ── Test: forceTransitionToDirty idempotent (already DIRTY) → NO emit ────

  it('Test 14 — forceTransitionToDirty: idempotent when already DIRTY → NO emit', async () => {
    const room = makeRoom({ cleaningStatus: 'DIRTY' });
    prismaMock.room.findUniqueOrThrow.mockResolvedValue(room);

    await service.forceTransitionToDirty('room-001', new Date().toISOString());

    expect(prismaMock.room.update).not.toHaveBeenCalled();
    expect(gatewayMock.emitStatusUpdate).not.toHaveBeenCalled();
  });
});
