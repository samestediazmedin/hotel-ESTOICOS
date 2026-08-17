/**
 * get-hotel-info.tool.spec.ts — Unit tests for get_hotel_info tool handler.
 *
 * Phase 22 — hotel knowledge tools.
 * Tests: happy path, missing config row, missing prisma dep.
 */

import { describe, it, expect, vi } from 'vitest';
import { GetHotelInfoTool } from './get-hotel-info.tool';
import type { ConciergeRepository } from '../concierge.repository';

const mockRepo = {} as ConciergeRepository;

const baseConfig = {
  id: 'cfg-1',
  hotelName: 'Hotel Sumapaz',
  address: 'Calle 100 #15-20, Bogotá',
  tagline: 'Tu refugio en Bogotá',
  description: 'Hotel boutique en el norte de Bogotá.',
  phone: '+57 601 123 4567',
  tags: ['Boutique', 'Negocios'],
  hotelTimezone: 'America/Bogota',
  // internal fields — must NOT appear in output
  ivaRate: 0.19 as unknown as never,
  hotelBusinessDate: new Date('2026-05-25') as unknown as never,
  hotelLogoUrl: '/uploads/logo.png' as unknown as never,
  updatedAt: new Date() as unknown as never,
};

describe('GetHotelInfoTool — handler', () => {
  it('returns public hotel info fields (happy path)', async () => {
    const mockPrisma = {
      systemConfig: {
        findFirst: vi.fn().mockResolvedValue(baseConfig),
      },
    } as any;

    const result = await GetHotelInfoTool.handler({}, { repo: mockRepo, prisma: mockPrisma });

    expect(result).toEqual({
      name: 'Hotel Sumapaz',
      address: 'Calle 100 #15-20, Bogotá',
      tagline: 'Tu refugio en Bogotá',
      description: 'Hotel boutique en el norte de Bogotá.',
      phone: '+57 601 123 4567',
      tags: ['Boutique', 'Negocios'],
      timezone: 'America/Bogota',
    });

    // Must NOT contain internal fields
    expect(result).not.toHaveProperty('ivaRate');
    expect(result).not.toHaveProperty('hotelBusinessDate');
    expect(result).not.toHaveProperty('hotelLogoUrl');
  });

  it('returns not_found error when system_config row is missing', async () => {
    const mockPrisma = {
      systemConfig: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as any;

    const result = await GetHotelInfoTool.handler({}, { repo: mockRepo, prisma: mockPrisma });

    expect(result).toMatchObject({ error: 'not_found' });
  });

  it('returns unavailable error when prisma dep is not provided', async () => {
    const result = await GetHotelInfoTool.handler({}, { repo: mockRepo });

    expect(result).toMatchObject({ error: 'unavailable' });
  });
});
