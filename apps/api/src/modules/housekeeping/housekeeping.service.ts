import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HousekeepingRepository } from './housekeeping.repository';
import { HousekeepingGateway } from './housekeeping.gateway';
import {
  transitionCleaningStatus,
} from './domain/cleaning-transitions';
import type { CleaningStatus, HousekeepingPriority } from '../../generated/prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  roomId: string;
  assignedToId?: string | null;
  priority: HousekeepingPriority;
  notes?: string;
}

export interface CleaningTransitionResult {
  roomId: string;
  from: CleaningStatus;
  to: CleaningStatus;
  byUserId: string | null;
  at: string;
}

/**
 * HousekeepingService — cleaning state machine enforcement + task CRUD.
 *
 * RBAC rules enforced at the service layer (not just controller decorators):
 * - HOUSEKEEPING: can only transition rooms with their assigned OPEN/IN_PROGRESS task
 * - RECEPTION: read-only (blocked on any write operation)
 * - MANAGER / ADMIN: full access, no ownership check
 *
 * forceTransitionToDirty() is used by the checkout event listener.
 * It bypasses the state machine guard because checkout always wins.
 * It is idempotent: if room is already DIRTY, returns early.
 *
 * Gateway is injected for socket broadcasts.
 * emitStatusUpdate is called AFTER prisma.room.update commits (P3 — never inside $transaction).
 * Gateway never calls back into Service — one-way dependency (P5 — no circular imports).
 */
@Injectable()
export class HousekeepingService {
  private readonly logger = new Logger(HousekeepingService.name);
  private systemUserIdCache: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: HousekeepingRepository,
    private readonly gateway: HousekeepingGateway,
  ) {}

  // ─── Room cleaning state machine ─────────────────────────────────────────

  /**
   * transitionRoomCleaningStatus — enforce state machine + RBAC, then update room.
   *
   * HOUSEKEEPING role: must have an OPEN or IN_PROGRESS task for the room.
   * RECEPTION role: always forbidden (read-only).
   * MANAGER/ADMIN: bypass ownership check.
   * All roles: CleaningDomainException if transition is invalid per CLEANING_TRANSITIONS.
   */
  async transitionRoomCleaningStatus(
    roomId: string,
    next: CleaningStatus,
    userId: string,
    role: string,
  ): Promise<CleaningTransitionResult> {
    // Guard: RECEPTION is read-only
    if (role === 'RECEPTION') {
      throw new ForbiddenException(
        'RECEPTION role cannot transition room cleaning status',
      );
    }

    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    const current = room.cleaningStatus as CleaningStatus;

    // Guard: HOUSEKEEPING can only transition their own assigned rooms
    if (role === 'HOUSEKEEPING') {
      const activeTask = await this.repo.findUserActiveTaskForRoom(userId, roomId);
      if (!activeTask) {
        throw new ForbiddenException(
          `User ${userId} does not have an active task for room ${roomId}`,
        );
      }
    }

    // State machine guard — throws CleaningDomainException on invalid transition
    transitionCleaningStatus(current, next);

    // Persist
    await this.prisma.room.update({
      where: { id: roomId },
      data: { cleaningStatus: next },
    });

    const result: CleaningTransitionResult = {
      roomId,
      from: current,
      to: next,
      byUserId: userId,
      at: new Date().toISOString(),
    };

    // Broadcast AFTER prisma.room.update commits (P3 — emit never inside $transaction)
    // Fire-and-forget — no await; if gateway throws, caller is not affected
    this.gateway.emitStatusUpdate(result);
    return result;
  }

  /**
   * forceTransitionToDirty — called by the checkout domain event listener.
   *
   * Bypasses the state machine guard: checkout always marks a room DIRTY.
   * Idempotent: if room is already DIRTY, returns early without a DB write.
   * Used for rooms in any state (IN_PROGRESS mid-clean = mid-cleaning checkout edge case).
   */
  async forceTransitionToDirty(
    roomId: string,
    at: string,
  ): Promise<CleaningTransitionResult | null> {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    const current = room.cleaningStatus as CleaningStatus;

    // Idempotent: already DIRTY — no-op
    if (current === 'DIRTY') {
      this.logger.log(`Room ${roomId} already DIRTY — skipping forceTransitionToDirty`);
      return null;
    }

    await this.prisma.room.update({
      where: { id: roomId },
      data: { cleaningStatus: 'DIRTY' },
    });

    const result: CleaningTransitionResult = {
      roomId,
      from: current,
      to: 'DIRTY',
      byUserId: null, // system-initiated (checkout event)
      at,
    };

    // Broadcast AFTER prisma.room.update commits (P3 — emit never inside $transaction)
    // byUserId: null signals this is a system-initiated transition (checkout event)
    this.gateway.emitStatusUpdate(result);
    return result;
  }

  // ─── HousekeepingTask CRUD ────────────────────────────────────────────────

  /**
   * createTask — create a work order for a room.
   *
   * RECEPTION role is blocked (read-only).
   * businessDate is today's hotel calendar date (DATE column — no timezone shift).
   */
  async createTask(
    input: CreateTaskInput,
    createdById: string,
    callerRole?: string,
  ) {
    // Guard: RECEPTION cannot create tasks
    if (callerRole === 'RECEPTION') {
      throw new ForbiddenException('RECEPTION role cannot create housekeeping tasks');
    }

    const businessDate = this.todayDate();

    return this.prisma.housekeepingTask.create({
      data: {
        roomId: input.roomId,
        assignedToId: input.assignedToId ?? null,
        priority: input.priority,
        notes: input.notes ?? null,
        createdById,
        status: 'OPEN',
        businessDate,
      },
    });
  }

  /**
   * listTasksForUser — filtered task list based on role.
   *
   * HOUSEKEEPING: tasks assigned to user OR unassigned, excluding DONE.
   * All other roles: all tasks (optionally filtered by query params).
   */
  async listTasksForUser(
    userId: string,
    role: string,
    filters?: { status?: string; roomId?: string },
  ) {
    if (role === 'HOUSEKEEPING') {
      return this.prisma.housekeepingTask.findMany({
        where: {
          OR: [
            { assignedToId: userId },
            { assignedToId: null },
          ],
          NOT: { status: 'DONE' },
          ...(filters?.roomId ? { roomId: filters.roomId } : {}),
        },
        include: { room: { select: { number: true } } },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      });
    }

    return this.prisma.housekeepingTask.findMany({
      where: {
        ...(filters?.status ? { status: filters.status as any } : {}),
        ...(filters?.roomId ? { roomId: filters.roomId } : {}),
      },
      include: { room: { select: { number: true } } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * updateTaskStatus — update a task's status.
   *
   * HOUSEKEEPING: can only update tasks they are assigned to.
   * MANAGER/ADMIN: can update any task.
   */
  async updateTaskStatus(
    taskId: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'DONE',
    callerId: string,
    role: string,
  ) {
    const task = await this.prisma.housekeepingTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    // Guard: HOUSEKEEPING can only update their own tasks
    if (role === 'HOUSEKEEPING' && task.assignedToId !== callerId) {
      throw new ForbiddenException(
        `User ${callerId} is not assigned to task ${taskId}`,
      );
    }

    const data: Record<string, unknown> = { status };
    if (status === 'DONE') {
      data.completedAt = new Date();
    }

    return this.prisma.housekeepingTask.update({
      where: { id: taskId },
      data: data as any,
    });
  }

  /**
   * listRoomsForBoard — all rooms with cleaningStatus + active task summary.
   * Used by Plan 05-03 kanban board (HK-01 read-side).
   */
  async listRoomsForBoard() {
    const rooms = await this.prisma.room.findMany({
      where: { isActive: true },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      include: {
        housekeepingTasks: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
          orderBy: { priority: 'asc' },
          take: 1,
          include: { assignedTo: { select: { name: true } } },
        },
      },
    });

    return {
      rooms: rooms.map((room) => {
        const activeTask = room.housekeepingTasks[0] ?? null;
        return {
          id: room.id,
          number: room.number,
          floor: room.floor,
          cleaningStatus: room.cleaningStatus,
          physicalStatus: room.physicalStatus,
          activeTask: activeTask
            ? {
                id: activeTask.id,
                priority: activeTask.priority,
                status: activeTask.status,
                assignedToName: activeTask.assignedTo?.name ?? null,
              }
            : null,
        };
      }),
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * todayDate — returns today as a Date object at midnight UTC.
   * Uses UTC to avoid server-timezone shifts on DATE columns.
   */
  private todayDate(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }
}
