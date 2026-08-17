/**
 * get-room-types-summary.tool.spec.ts — Unit tests for get_room_types_summary tool handler.
 *
 * Phase 22 — hotel knowledge tools.
 * Tests: happy path (Decimal conversion + field shape), empty result, missing prisma dep.
 */

import { describe, it, expect, vi } from 'vitest';
import { GetRoomTypesSummaryTool } from './get-room-types-summary.tool';
import type { ConciergeRepository } from '../concierge.repository';

const mockRepo = {} as ConciergeRepository;

// Prisma returns Decimal objects — simulate with an object that has toString/valueOf
function makeDecimal(value: number) {
  return {
    valueOf: () => value,
    toString: () => String(value),
    toFixed: (d: number) => value.toFixed(d),
    // Number() coercion — Prisma Decimal supports this
    [Symbol.toPrimitive]: (hint: string) => (hint === 'number' ? value : String(value)),
  };
}

const mockRoomTypes = [
  {
    id: 'rt-1',
    name: 'Habitación Estándar',
    maxOccupancy: 2,
    basePrice: makeDecimal(150000),
    description: 'Cómoda habitación para dos personas.',
    amenities: ['WiFi gratis', 'Aire acondicionado'],
  },
  {
    id: 'rt-2',
    name: 'Suite Junior',
    maxOccupancy: 3,
    basePrice: makeDecimal(280000),
    description: 'Suite amplia con sala de estar.',
    amenities: ['WiFi gratis', 'Minibar', 'Bañera'],
  },
];

describe('GetRoomTypesSummaryTool — handler', () => {
  it('returns public room type summary with Decimal converted to number (happy path)', async () => {
    const mockPrisma = {
      roomType: {
        findMany: vi.fn().mockResolvedValue(mockRoomTypes),
      },
    } as any;

    const result = await GetRoomTypesSummaryTool.handler({}, { repo: mockRepo, prisma: mockPrisma }) as any;

    expect(result).toHaveProperty('roomTypes');
    expect(result.roomTypes).toHaveLength(2);

    const first = result.roomTypes[0];
    expect(first.id).toBe('rt-1');
    expect(first.name).toBe('Habitación Estándar');
    expect(first.capacity).toBe(2);
    // Decimal → number conversion
    expect(typeof first.basePriceCOP).toBe('number');
    expect(first.basePriceCOP).toBe(150000);
    expect(first.description).toBe('Cómoda habitación para dos personas.');
    expect(first.amenities).toEqual(['WiFi gratis', 'Aire acondicionado']);

    // Must NOT contain internal fields
    expect(first).not.toHaveProperty('maxOccupancy'); // renamed to capacity
    expect(first).not.toHaveProperty('basePrice');     // renamed to basePriceCOP
  });

  it('returns empty roomTypes array when no published active types exist', async () => {
    const mockPrisma = {
      roomType: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    const result = await GetRoomTypesSummaryTool.handler({}, { repo: mockRepo, prisma: mockPrisma }) as any;

    expect(result).toEqual({ roomTypes: [] });
  });

  it('returns unavailable error when prisma dep is not provided', async () => {
    const result = await GetRoomTypesSummaryTool.handler({}, { repo: mockRepo });

    expect(result).toMatchObject({ error: 'unavailable' });
  });
});
