/**
 * get-hotel-amenities.tool.ts — OpenAI function-calling tool: get_hotel_amenities
 *
 * READ-ONLY: aggregates amenities across all active room types.
 * No prisma.*.create/update/delete/upsert calls allowed here — enforced by
 * concierge-tool-registry.spec.ts (grep test, CON-04).
 *
 * Algorithm:
 *   1. Query all RoomType rows where isActive=true (amenities column is String[]).
 *   2. Flatten all amenity arrays into a single set.
 *   3. Deduplicate (Set) + sort alphabetically (locale-aware).
 *   4. Return { amenities: string[] }.
 */

import { z } from 'zod';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ConciergeRepository } from '../concierge.repository';

export const GetHotelAmenitiesSchema = z.object({}).strict();

export type GetHotelAmenitiesArgs = z.infer<typeof GetHotelAmenitiesSchema>;

export interface HotelAmenitiesDto {
  amenities: string[];
}

export const GetHotelAmenitiesTool = {
  name: 'get_hotel_amenities' as const,
  schema: GetHotelAmenitiesSchema,

  definition: {
    type: 'function' as const,
    function: {
      name: 'get_hotel_amenities',
      description:
        'Get the complete list of amenities offered across all active room types at this hotel ' +
        '(e.g. WiFi, air conditioning, pool, gym, breakfast). ' +
        'Returns a deduplicated alphabetical list. ' +
        'Use this when guests ask "¿qué servicios tienen?" or "¿hay piscina / gimnasio?".',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  async handler(
    _args: GetHotelAmenitiesArgs,
    deps: { repo: ConciergeRepository; prisma?: PrismaService },
  ): Promise<HotelAmenitiesDto | { error: string; message: string }> {
    if (!deps.prisma) {
      return { error: 'unavailable', message: 'Amenities service not available.' };
    }

    const roomTypes = await deps.prisma.roomType.findMany({
      where: { isActive: true },
      select: { amenities: true },
    });

    const amenitiesSet = new Set<string>();
    for (const rt of roomTypes) {
      for (const amenity of rt.amenities) {
        amenitiesSet.add(amenity);
      }
    }

    const amenities = [...amenitiesSet].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' }),
    );

    return { amenities };
  },
};
