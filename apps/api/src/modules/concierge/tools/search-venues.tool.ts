/**
 * search-venues.tool.ts — OpenAI function-calling tool: search_venues
 *
 * 2026-05-25 refactor: data source switched from the local `bogota_venues` table
 * to live Foursquare Places API results within a configurable radius around the
 * hotel (default 5 km). The tool surface is unchanged on purpose so the existing
 * system prompt, registry, and downstream UI work without modification.
 *
 * READ-ONLY: handler only calls FoursquareClient (GET requests, no DB writes).
 * CON-04 (read-only guarantee) preserved because no Prisma mutation methods are
 * invoked here — verified by concierge-tool-registry.spec.ts grep test.
 *
 * Graceful degradation: if FOURSQUARE_API_KEY is not configured OR the upstream
 * API fails, the handler returns a structured `{ error, message, venues: [] }`
 * payload. ConciergeToolExecutorService surfaces this to the LLM, which is
 * instructed to apologise and recommend asking at the front desk.
 */

import { z } from 'zod';
import type { FoursquareClient } from '../clients/foursquare.client';
import { FoursquareError } from '../clients/foursquare.client';

/**
 * Map of high-level English venue types (kept for backward prompt compatibility) to
 * Foursquare category IDs. Source: https://docs.foursquare.com/data-products/docs/categories
 * Category IDs are stable v3 IDs at the time of writing (2026-05).
 */
const FOURSQUARE_CATEGORY_IDS: Record<string, string> = {
  RESTAURANT: '13065',
  BAR: '13003',
  CAFE: '13035',
  MUSEUM: '10027',
  PARK: '16032',
  SHOPPING: '17000',
  NIGHTLIFE: '10032',
  TRANSPORT_HUB: '19000',
  EVENT_VENUE: '10000',
  OTHER: '',
};

export const SearchVenuesSchema = z.object({
  query: z.string().max(200).optional(),
  type: z
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
  maxDistanceKm: z.number().positive().max(50).optional(),
  minRating: z.number().min(0).max(5).optional(),
});

export type SearchVenuesArgs = z.infer<typeof SearchVenuesSchema>;

export const SearchVenuesTool = {
  name: 'search_venues' as const,
  schema: SearchVenuesSchema,

  definition: {
    type: 'function' as const,
    function: {
      name: 'search_venues',
      description:
        'Search nearby places in Bogotá using live Foursquare data within a configurable ' +
        'radius around the hotel (default 5 km). Returns up to 10 results sorted by distance ' +
        'with rating, address, opening status, and a Google Maps deep-link for each place. ' +
        'Use this whenever a guest asks for restaurants, cafés, bars, museums, parks, or any ' +
        'other place to go in the city.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Free-text search term — venue name, cuisine, or any keyword the guest used ' +
              '(e.g. "italian", "vegan brunch", "rooftop", "museo del oro").',
          },
          type: {
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
            description: 'Optional venue category filter',
          },
          maxDistanceKm: {
            type: 'number',
            description: 'Maximum distance from hotel in kilometres (default 5, max 50).',
          },
          minRating: {
            type: 'number',
            description: 'Minimum venue rating on a 0-5 scale.',
          },
        },
        required: [],
      },
    },
  },

  async handler(
    args: SearchVenuesArgs,
    deps: { foursquare: FoursquareClient },
  ): Promise<unknown> {
    if (!deps.foursquare.isConfigured()) {
      return {
        error: 'configuration_missing',
        message:
          'El concierge no está conectado al directorio de lugares en este momento. ' +
          'Sugerí preguntar en la recepción del hotel.',
        venues: [],
      };
    }

    const categoryIds =
      args.type && FOURSQUARE_CATEGORY_IDS[args.type]
        ? FOURSQUARE_CATEGORY_IDS[args.type]
        : undefined;

    try {
      const places = await deps.foursquare.searchNearby({
        query: args.query,
        categoryIds,
        maxDistanceKm: args.maxDistanceKm ?? 5,
        minRating: args.minRating,
        limit: 10,
      });
      return { venues: places };
    } catch (err) {
      const message = err instanceof FoursquareError ? err.message : String(err);
      return {
        error: 'upstream_failure',
        message:
          'No pude consultar el directorio de lugares ahora mismo. Disculpame, podés ' +
          'intentar de nuevo en un momento o preguntar en la recepción.',
        debug: message,
        venues: [],
      };
    }
  },
};
