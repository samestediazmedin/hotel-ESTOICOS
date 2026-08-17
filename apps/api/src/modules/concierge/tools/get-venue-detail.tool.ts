/**
 * get-venue-detail.tool.ts — OpenAI function-calling tool: get_venue_detail
 *
 * 2026-05-25 refactor: now backed by Foursquare /places/{fsq_id} instead of the
 * local `bogota_venues` table. The `id` field accepted by this tool is the
 * Foursquare `fsq_id` returned by search_venues.
 *
 * READ-ONLY: handler only calls FoursquareClient (GET requests, no DB writes).
 * CON-04 preserved.
 */

import { z } from 'zod';
import type { FoursquareClient } from '../clients/foursquare.client';
import { FoursquareError } from '../clients/foursquare.client';

export const GetVenueDetailSchema = z.object({
  id: z.string().min(1),
});

export type GetVenueDetailArgs = z.infer<typeof GetVenueDetailSchema>;

export const GetVenueDetailTool = {
  name: 'get_venue_detail' as const,
  schema: GetVenueDetailSchema,

  definition: {
    type: 'function' as const,
    function: {
      name: 'get_venue_detail',
      description:
        'Get full details for a specific Bogotá place (Foursquare fsq_id from search_venues): ' +
        'description, contact info, opening hours, photos, and a Google Maps deep-link.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Foursquare fsq_id from a previous search_venues result.',
          },
        },
        required: ['id'],
      },
    },
  },

  async handler(
    args: GetVenueDetailArgs,
    deps: { foursquare: FoursquareClient },
  ): Promise<unknown> {
    if (!deps.foursquare.isConfigured()) {
      return {
        error: 'configuration_missing',
        message:
          'El concierge no está conectado al directorio de lugares en este momento.',
      };
    }

    try {
      const venue = await deps.foursquare.getDetail(args.id);
      if (!venue) {
        return { error: 'not_found', message: 'Lugar no encontrado o sin información disponible.' };
      }
      return venue;
    } catch (err) {
      const message = err instanceof FoursquareError ? err.message : String(err);
      return {
        error: 'upstream_failure',
        message:
          'No pude consultar los detalles del lugar ahora mismo. Intentemos de nuevo en un momento.',
        debug: message,
      };
    }
  },
};
