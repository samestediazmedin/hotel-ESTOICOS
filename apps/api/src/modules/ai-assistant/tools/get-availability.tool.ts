import { z } from 'zod';
import type { GetAvailabilityOutputDto } from '../dto/tool-output.dto';
import type { ToolDeps, UserContext } from '../tool-registry';

export const GetAvailabilitySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
  maxOccupancy: z.number().int().min(1).max(20).optional(),
});

export type GetAvailabilityInput = z.infer<typeof GetAvailabilitySchema>;

const MAX_ROOMS = 20;

export async function getAvailabilityHandler(
  input: GetAvailabilityInput,
  _userCtx: UserContext,
  deps: ToolDeps,
): Promise<GetAvailabilityOutputDto> {
  const checkIn = new Date(input.startDate + 'T00:00:00.000Z');
  const checkOut = new Date(input.endDate + 'T00:00:00.000Z');
  const adults = input.maxOccupancy ?? 1;

  const allRooms = await deps.availability.searchAvailable(checkIn, checkOut, adults);

  const truncated = allRooms.length > MAX_ROOMS;
  const rooms = allRooms.slice(0, MAX_ROOMS).map((r: any) => ({
    roomId: r.id,
    roomNumber: r.number,
    typeName: r.roomType?.name ?? r.roomTypeId,
    floor: r.floor,
    pricePerNight: Math.round(Number(r.pricing?.totalPrice ?? r.pricing?.basePrice ?? 0)),
  }));

  return { rooms, truncated, total: allRooms.length };
}
