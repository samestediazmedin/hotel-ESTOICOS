/**
 * get-room-types-summary.tool.ts — OpenAI function-calling tool: get_room_types_summary
 *
 * READ-ONLY: returns public summary of room types filtered by isActive + isPublished.
 * No prisma.*.create/update/delete/upsert calls allowed here — enforced by
 * concierge-tool-registry.spec.ts (grep test, CON-04).
 *
 * SECURITY — fields deliberately excluded from output (Phase 22 requirement):
 *   - cost fields (any internal cost/supplier pricing)
 *   - occupancy data (current availability, booking counts)
 *   - internal tags or supplier info
 *   - room-level detail (individual room IDs, cleaning/physical status)
 *
 * basePrice is the public sale price — this is intentionally included.
 * Decimal → number conversion is required (Prisma returns Decimal objects).
 */

import { z } from 'zod';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ConciergeRepository } from '../concierge.repository';

export const GetRoomTypesSummarySchema = z.object({}).strict();

export type GetRoomTypesSummaryArgs = z.infer<typeof GetRoomTypesSummarySchema>;

export interface RoomTypeSummaryItem {
  id: string;
  name: string;
  capacity: number;
  basePriceCOP: number;
  description: string;
  amenities: string[];
}

export interface RoomTypesSummaryDto {
  roomTypes: RoomTypeSummaryItem[];
}

export const GetRoomTypesSummaryTool = {
  name: 'get_room_types_summary' as const,
  schema: GetRoomTypesSummarySchema,

  definition: {
    type: 'function' as const,
    function: {
      name: 'get_room_types_summary',
      description:
        'Get a public summary of available room types at this hotel, sorted by price (cheapest first). ' +
        'Each entry includes the room name, guest capacity, base price in Colombian pesos (COP), ' +
        'description, and included amenities. ' +
        'Use this when guests ask "¿qué habitaciones tienen?", "¿cuánto cuesta una habitación?", ' +
        'or "¿hay habitaciones para familias?".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  async handler(
    _args: GetRoomTypesSummaryArgs,
    deps: { repo: ConciergeRepository; prisma?: PrismaService },
  ): Promise<RoomTypesSummaryDto | { error: string; message: string }> {
    if (!deps.prisma) {
      return { error: 'unavailable', message: 'Room types service not available.' };
    }

    const roomTypes = await deps.prisma.roomType.findMany({
      where: { isActive: true, isPublished: true },
      orderBy: { basePrice: 'asc' },
      // Only select public fields — no cost/supplier/occupancy data
      select: {
        id: true,
        name: true,
        maxOccupancy: true,
        basePrice: true,
        description: true,
        amenities: true,
      },
    });

    const result: RoomTypeSummaryItem[] = roomTypes.map((rt) => ({
      id: rt.id,
      name: rt.name,
      capacity: rt.maxOccupancy,
      basePriceCOP: Number(rt.basePrice), // Decimal → number
      description: rt.description ?? '',
      amenities: rt.amenities,
    }));

    return { roomTypes: result };
  },
};
