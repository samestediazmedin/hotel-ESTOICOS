/**
 * get-event-info.tool.ts — OpenAI function-calling tool: get_event_info
 *
 * READ-ONLY: this handler calls ONLY ConciergeRepository read methods.
 * No prisma.*.create/update/delete/upsert calls allowed here — enforced by
 * concierge-tool-registry.spec.ts (grep test, CON-04).
 */

import { z } from 'zod';
import { VenueType } from '../../../generated/prisma/client';
import type { ConciergeRepository } from '../concierge.repository';

export const GetEventInfoSchema = z.object({
  startDate: z.string().optional(), // ISO 8601 date string
  endDate: z.string().optional(),   // ISO 8601 date string
  venueType: z
    .enum([
      'RESTAURANT',
      'BAR',
      'CAFE',
      'MUSEUM',
      'PARK',
      'SHOPPING',
      'NIGHTLIFE',
      'TRANSPORT_HUB',
      'EVENT_VENUE',
      'OTHER',
    ] as const)
    .optional(),
});

export type GetEventInfoArgs = z.infer<typeof GetEventInfoSchema>;

export const GetEventInfoTool = {
  name: 'get_event_info' as const,
  schema: GetEventInfoSchema,

  definition: {
    type: 'function' as const,
    function: {
      name: 'get_event_info',
      description:
        'Get upcoming events and activities in Bogotá. Can filter by date range and venue type. ' +
        'Returns event title, dates, description, and optional ticket URL.',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Filter events starting on or after this date (ISO 8601, e.g. "2026-05-16")',
          },
          endDate: {
            type: 'string',
            description: 'Filter events ending on or before this date (ISO 8601)',
          },
          venueType: {
            type: 'string',
            enum: [
              'RESTAURANT',
              'BAR',
              'CAFE',
              'MUSEUM',
              'PARK',
              'SHOPPING',
              'NIGHTLIFE',
              'TRANSPORT_HUB',
              'EVENT_VENUE',
              'OTHER',
            ],
            description: 'Filter events by venue category',
          },
        },
        required: [],
      },
    },
  },

  async handler(
    args: GetEventInfoArgs,
    deps: { repo: ConciergeRepository },
  ): Promise<unknown> {
    const events = await deps.repo.getEvents({
      startDate: args.startDate,
      endDate: args.endDate,
      venueType: args.venueType as VenueType | undefined,
    });
    return { events };
  },
};
