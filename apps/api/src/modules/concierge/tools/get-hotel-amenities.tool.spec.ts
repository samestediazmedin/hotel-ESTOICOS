/**
 * get-hotel-amenities.tool.spec.ts — Unit tests for get_hotel_amenities tool handler.
 *
 * Phase 22 — hotel knowledge tools.
 * Tests: happy path (dedup + sort), empty amenities, missing prisma dep.
 */

import { describe, it, expect, vi } from 'vitest';
import { GetHotelAmenitiesTool } from './get-hotel-amenities.tool';
import type { ConciergeRepository } from '../concierge.repository';

const mockRepo = {} as ConciergeRepository;

describe('GetHotelAmenitiesTool — handler', () => {
  it('returns deduplicated alphabetically sorted amenities (happy path)', async () => {
    const mockPrisma = {
      roomType: {
        findMany: vi.fn().mockResolvedValue([
          { amenities: ['WiFi gratis', 'Aire acondicionado', 'Piscina'] },
          { amenities: ['WiFi gratis', 'Gimnasio', 'Desayuno incluido'] },
          { amenities: ['Aire acondicionado', 'Minibar'] },
        ]),
      },
    } as any;

    const result = await GetHotelAmenitiesTool.handler({}, { repo: mockRepo, prisma: mockPrisma }) as any;

    expect(result).toHaveProperty('amenities');
    // Deduplicated: WiFi gratis, Aire acondicionado, Piscina, Gimnasio, Desayuno incluido, Minibar = 6 unique
    expect(result.amenities).toHaveLength(6);
    // Sorted alphabetically (es locale)
    expect(result.amenities).toEqual([...result.amenities].sort((a: string, b: string) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' }),
    ));
  });

  it('returns empty array when no active room types exist', async () => {
    const mockPrisma = {
      roomType: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const result = await GetHotelAmenitiesTool.handler({}, { repo: mockRepo, prisma: mockPrisma }) as any;

    expect(result).toEqual({ amenities: [] });
  });

  it('returns unavailable error when prisma dep is not provided', async () => {
    const result = await GetHotelAmenitiesTool.handler({}, { repo: mockRepo });

    expect(result).toMatchObject({ error: 'unavailable' });
  });
});
