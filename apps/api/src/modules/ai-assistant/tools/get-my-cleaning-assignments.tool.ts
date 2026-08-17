import { z } from 'zod';
import type { GetMyCleaningAssignmentsOutputDto } from '../dto/tool-output.dto';
import type { ToolDeps, UserContext } from '../tool-registry';

export const GetMyCleaningAssignmentsSchema = z.object({}).strict();

export type GetMyCleaningAssignmentsInput = z.infer<typeof GetMyCleaningAssignmentsSchema>;

/**
 * get_my_cleaning_assignments — returns housekeeping tasks assigned to the calling user.
 *
 * Filters: assignedToId = userCtx.id AND (completedAt IS NULL OR completedAt within today).
 * No input required — uses server-side user context for ownership filtering.
 *
 * Allowed roles: ADMIN, MANAGER, HOUSEKEEPING.
 */
export async function getMyCleaningAssignmentsHandler(
  _input: GetMyCleaningAssignmentsInput,
  userCtx: UserContext,
  deps: ToolDeps,
): Promise<GetMyCleaningAssignmentsOutputDto> {
  // Build today's business date range (UTC midnight to midnight)
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);

  const tasks = await deps.prisma.housekeepingTask.findMany({
    where: {
      assignedToId: userCtx.id,
      OR: [
        { completedAt: null },
        { completedAt: { gte: todayStart, lt: tomorrowStart } },
      ],
    },
    include: {
      room: { select: { number: true, floor: true } },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
  });

  return {
    assignments: tasks.map((t) => ({
      taskId: t.id,
      roomNumber: t.room.number,
      floor: t.room.floor,
      priority: t.priority,
      notes: t.notes,
      businessDate: t.businessDate.toISOString().slice(0, 10),
      completedAt: t.completedAt?.toISOString() ?? null,
    })),
    total: tasks.length,
  };
}
