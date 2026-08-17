/**
 * get-hotel-info.tool.ts — OpenAI function-calling tool: get_hotel_info
 *
 * READ-ONLY: queries system_config for public hotel metadata.
 * No prisma.*.create/update/delete/upsert calls allowed here — enforced by
 * concierge-tool-registry.spec.ts (grep test, CON-04).
 *
 * SECURITY — fields deliberately excluded from output (Phase 22 requirement):
 *   - ivaRate      → internal financial config, irrelevant to guests
 *   - hotelBusinessDate → internal PMS state
 *   - hotelLogoUrl → raw storage path, not a public guest-facing field
 */

import { z } from 'zod';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { ConciergeRepository } from '../concierge.repository';

export const GetHotelInfoSchema = z.object({}).strict();

export type GetHotelInfoArgs = z.infer<typeof GetHotelInfoSchema>;

export interface HotelInfoDto {
  name: string;
  address: string;
  tagline: string;
  description: string;
  phone: string;
  tags: string[];
  timezone: string;
}

export const GetHotelInfoTool = {
  name: 'get_hotel_info' as const,
  schema: GetHotelInfoSchema,

  definition: {
    type: 'function' as const,
    function: {
      name: 'get_hotel_info',
      description:
        'Get public information about this hotel: name, address, contact phone, description, ' +
        'amenity tags, and timezone. Use this when guests ask about the hotel itself — ' +
        'its location, how to contact it, or what kind of establishment it is.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  async handler(
    _args: GetHotelInfoArgs,
    deps: { repo: ConciergeRepository; prisma?: PrismaService },
  ): Promise<HotelInfoDto | { error: string; message: string }> {
    if (!deps.prisma) {
      return { error: 'unavailable', message: 'Hotel info service not available.' };
    }

    const config = await deps.prisma.systemConfig.findFirst();
    if (!config) {
      return { error: 'not_found', message: 'Hotel configuration not found.' };
    }

    // Explicitly map only public fields — never return ivaRate, hotelBusinessDate, hotelLogoUrl
    return {
      name: config.hotelName,
      address: config.address ?? '',
      tagline: config.tagline ?? '',
      description: config.description ?? '',
      phone: config.phone ?? '',
      tags: config.tags,
      timezone: config.hotelTimezone,
    };
  },
};
