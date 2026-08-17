/**
 * concierge-admin.service.spec.ts — Tests for ConciergeAdminService.
 *
 * Tests: create / update / disable venue happy paths + Zod validation rejection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConciergeAdminService } from './concierge-admin.service';
import { ConciergeAdminRepository } from './concierge-admin.repository';

const mockVenue = {
  id: 'venue-1',
  name: 'La Candelaria Cafe',
  type: 'CAFE',
  lat: 4.5981,
  lng: -74.0762,
  description: null,
  rating: null,
  address: 'Cra 7 #15-10, Bogotá',
  phone: null,
  photoUrl: null,
  mapsUrl: null,
  reservationUrl: null,
  website: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ConciergeAdminService', () => {
  let svc: ConciergeAdminService;
  let createMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;
  let disableMock: ReturnType<typeof vi.fn>;
  let listMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createMock = vi.fn().mockResolvedValue(mockVenue);
    updateMock = vi.fn().mockResolvedValue({ ...mockVenue, name: 'Updated' });
    disableMock = vi.fn().mockResolvedValue({ ...mockVenue, isActive: false });
    listMock = vi.fn().mockResolvedValue([mockVenue]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConciergeAdminService,
        {
          provide: ConciergeAdminRepository,
          useValue: {
            createVenue: createMock,
            updateVenue: updateMock,
            disableVenue: disableMock,
            listVenues: listMock,
          },
        },
      ],
    }).compile();

    svc = moduleRef.get(ConciergeAdminService);
  });

  // Test 1: create venue happy path
  it('createVenue — valid body delegates to repository', async () => {
    const body = {
      name: 'La Candelaria Cafe',
      type: 'CAFE',
      lat: 4.5981,
      lng: -74.0762,
      address: 'Cra 7 #15-10',
    };
    const result = await svc.createVenue(body);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('venue-1');
  });

  // Test 2: update venue happy path
  it('updateVenue — partial body delegates to repository', async () => {
    const result = await svc.updateVenue('venue-1', { name: 'Updated' });
    expect(updateMock).toHaveBeenCalledWith('venue-1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  // Test 3: disable venue (soft delete)
  it('disableVenue — delegates to repository and returns isActive=false', async () => {
    const result = await svc.disableVenue('venue-1');
    expect(disableMock).toHaveBeenCalledWith('venue-1');
    expect(result.isActive).toBe(false);
  });

  // Test 4: Zod validation rejects invalid body
  it('createVenue — throws BadRequestException on invalid body (missing lat/lng)', async () => {
    await expect(svc.createVenue({ name: 'X', type: 'CAFE' })).rejects.toThrow(BadRequestException);
    expect(createMock).not.toHaveBeenCalled();
  });

  // Test 5: Zod validation rejects invalid phone format
  it('createVenue — throws BadRequestException on wrong phone format', async () => {
    await expect(
      svc.createVenue({
        name: 'X',
        type: 'CAFE',
        lat: 4.0,
        lng: -74.0,
        phone: '3001234567', // missing +57 prefix
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // Test 6: valid Colombian phone format passes
  it('createVenue — accepts valid Colombia phone format +57XXXXXXXXXX', async () => {
    await svc.createVenue({
      name: 'La Candelaria Cafe',
      type: 'CAFE',
      lat: 4.5981,
      lng: -74.0762,
      phone: '+573001234567',
    });
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
