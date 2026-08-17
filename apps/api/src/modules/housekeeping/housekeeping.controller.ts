import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { HousekeepingService } from './housekeeping.service';
import { AssignTaskSchema } from './dto/assign-task.dto';
import { TransitionCleaningStatusSchema } from './dto/transition-cleaning-status.dto';
import { UpdateTaskStatusSchema } from './dto/update-task-status.dto';

/**
 * HousekeepingController — REST surface for cleaning state + task CRUD.
 *
 * Base path: /api/housekeeping (prefix via main.ts or global prefix)
 *
 * RBAC matrix:
 * - GET  /rooms/board                  — all roles
 * - PATCH /rooms/:id/cleaning-status   — ADMIN, MANAGER, HOUSEKEEPING
 * - GET  /tasks                        — all roles (HOUSEKEEPING sees own only via service)
 * - POST /tasks                        — ADMIN, MANAGER
 * - PATCH /tasks/:id/status            — ADMIN, MANAGER, HOUSEKEEPING
 *
 * HOUSEKEEPING ownership checks are enforced at the SERVICE layer.
 * RECEPTION is blocked on mutations by @Roles decorator AND service guard.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('housekeeping')
export class HousekeepingController {
  constructor(private readonly hkService: HousekeepingService) {}

  // ─── Board view (read-only) ────────────────────────────────────────────────

  /**
   * GET /api/housekeeping/rooms/board
   * Returns all rooms with cleaningStatus + active task summary for kanban.
   */
  @Get('rooms/board')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING')
  listRoomsForBoard() {
    return this.hkService.listRoomsForBoard();
  }

  // ─── Cleaning status transition ────────────────────────────────────────────

  /**
   * PATCH /api/housekeeping/rooms/:id/cleaning-status
   * Transitions a room's cleaningStatus via the state machine.
   * HOUSEKEEPING: must have an active task for the room.
   */
  @Patch('rooms/:id/cleaning-status')
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING')
  async transitionCleaningStatus(
    @Param('id') roomId: string,
    @Body() body: unknown,
    @CurrentUser() user: { id: string; role: string },
  ) {
    const parsed = TransitionCleaningStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join(', '));
    }
    return this.hkService.transitionRoomCleaningStatus(
      roomId,
      parsed.data.next,
      user.id,
      user.role,
    );
  }

  // ─── Task CRUD ─────────────────────────────────────────────────────────────

  /**
   * GET /api/housekeeping/tasks
   * HOUSEKEEPING: returns own + unassigned tasks (not DONE).
   * ADMIN/MANAGER/RECEPTION: all tasks with optional filters.
   */
  @Get('tasks')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING')
  listTasks(
    @CurrentUser() user: { id: string; role: string },
    @Query('status') status?: string,
    @Query('roomId') roomId?: string,
  ) {
    return this.hkService.listTasksForUser(user.id, user.role, { status, roomId });
  }

  /**
   * POST /api/housekeeping/tasks
   * Create a work order. ADMIN and MANAGER only.
   */
  @Post('tasks')
  @Roles('ADMIN', 'MANAGER')
  async createTask(
    @Body() body: unknown,
    @CurrentUser() user: { id: string; role: string },
  ) {
    const parsed = AssignTaskSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join(', '));
    }
    return this.hkService.createTask(
      {
        roomId: parsed.data.roomId,
        assignedToId: parsed.data.assignedToId ?? null,
        priority: parsed.data.priority as any,
        notes: parsed.data.notes,
      },
      user.id,
      user.role,
    );
  }

  /**
   * PATCH /api/housekeeping/tasks/:id/status
   * Update task status. HOUSEKEEPING can only update their own tasks.
   */
  @Patch('tasks/:id/status')
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING')
  async updateTaskStatus(
    @Param('id') taskId: string,
    @Body() body: unknown,
    @CurrentUser() user: { id: string; role: string },
  ) {
    const parsed = UpdateTaskStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join(', '));
    }
    return this.hkService.updateTaskStatus(taskId, parsed.data.status, user.id, user.role);
  }
}
