import { z } from 'zod';
import type { GetRoomCleaningStatusOutputDto } from '../dto/tool-output.dto';
import type { ToolDeps, UserContext } from '../tool-registry';

export const GetRoomCleaningStatusSchema = z.object({
  roomNumber: z.string().max(20).optional(),
});

export type GetRoomCleaningStatusInput = z.infer<typeof GetRoomCleaningStatusSchema>;

/**
 * get_room_cleaning_status — read-only query of room cleaning/physical status.
 *
 * Returns active rooms with their current cleaningStatus and physicalStatus.
 * Optionally filtered by roomNumber. No IDs or internal notes exposed (AI-06).
 *
 * Allowed roles: ADMIN, MANAGER, RECEPTION, HOUSEKEEPING.
 */
export async function getRoomCleaningStatusHandler(
  input: GetRoomCleaningStatusInput,
  _userCtx: UserContext,
  deps: ToolDeps,
): Promise<GetRoomCleaningStatusOutputDto> {
  const where: Record<string, unknown> = { isActive: true };
  if (input.roomNumber) {
    where.number = input.roomNumber;
  }

  const rooms = await deps.prisma.room.findMany({
    where,
    orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    select: {
      number: true,
      floor: true,
      physicalStatus: true,
      cleaningStatus: true,
      updatedAt: true,
    },
  });

  return {
    rooms: rooms.map((r) => ({
      roomNumber: r.number,
      floor: r.floor,
      physicalStatus: r.physicalStatus,
      cleaningStatus: r.cleaningStatus,
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: rooms.length,
  };
}
