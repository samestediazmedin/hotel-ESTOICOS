import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockRoomType = {
  id: 'rt-1',
  name: 'Suite Ejecutiva',
  description: 'Vista panorámica',
  basePrice: 350000,
  maxOccupancy: 2,
  amenities: ['WiFi', 'Minibar', 'Jacuzzi'],
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockRoom = {
  id: 'rm-1',
  number: '101',
  floor: 1,
  roomTypeId: 'rt-1',
  roomType: { id: 'rt-1', name: 'Suite Ejecutiva', basePrice: 350000 },
  physicalStatus: 'AVAILABLE' as const,
  cleaningStatus: 'CLEAN' as const,
  notes: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// ─── Mock InventoryRepository ─────────────────────────────────────────────────

const mockRepo = {
  findAllRoomTypes: vi.fn(),
  findRoomTypeById: vi.fn(),
  createRoomType: vi.fn(),
  updateRoomType: vi.fn(),
  deactivateRoomType: vi.fn(),
  activateRoomType: vi.fn(),
  findAllRooms: vi.fn(),
  findRoomById: vi.fn(),
  createRoom: vi.fn(),
  updateRoom: vi.fn(),
  updateRoomStatus: vi.fn(),
  deactivateRoom: vi.fn(),
  activateRoom: vi.fn(),
  findAvailableRooms: vi.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: InventoryRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  // ─── Room Type Tests ──────────────────────────────────────────────────────

  it('createRoomType stores name, basePrice, maxOccupancy, amenities', async () => {
    mockRepo.createRoomType.mockResolvedValue(mockRoomType);
    const dto = {
      name: 'Suite Ejecutiva',
      basePrice: 350000,
      maxOccupancy: 2,
      amenities: ['WiFi', 'Minibar', 'Jacuzzi'],
    };

    const result = await service.createRoomType(dto as any);

    expect(mockRepo.createRoomType).toHaveBeenCalledWith(dto);
    expect(result.name).toBe('Suite Ejecutiva');
    expect(result.basePrice).toBe(350000);
    expect(result.maxOccupancy).toBe(2);
    expect(result.amenities).toEqual(['WiFi', 'Minibar', 'Jacuzzi']);
  });

  it('findAllRoomTypes returns array without internal Prisma metadata', async () => {
    mockRepo.findAllRoomTypes.mockResolvedValue([mockRoomType]);

    const result = await service.findAllRoomTypes();

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).not.toHaveProperty('passwordHash');
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('basePrice');
  });

  it('updateRoomType — partial update: only provided fields change', async () => {
    mockRepo.findRoomTypeById.mockResolvedValue(mockRoomType);
    const updated = { ...mockRoomType, name: 'Suite Presidencial' };
    mockRepo.updateRoomType.mockResolvedValue(updated);

    const result = await service.updateRoomType('rt-1', { name: 'Suite Presidencial' });

    expect(mockRepo.updateRoomType).toHaveBeenCalledWith('rt-1', {
      name: 'Suite Presidencial',
    });
    expect(result.name).toBe('Suite Presidencial');
    // Other fields are unchanged
    expect(result.basePrice).toBe(350000);
  });

  it('deactivateRoomType sets isActive=false (not a delete)', async () => {
    mockRepo.findRoomTypeById.mockResolvedValue(mockRoomType);
    const deactivated = { ...mockRoomType, isActive: false };
    mockRepo.deactivateRoomType.mockResolvedValue(deactivated);

    const result = await service.deactivateRoomType('rt-1');

    expect(mockRepo.deactivateRoomType).toHaveBeenCalledWith('rt-1');
    expect(result.isActive).toBe(false);
    // Record still exists — just inactive
    expect(result.id).toBe('rt-1');
  });

  it('findRoomTypeById throws NotFoundException when id does not exist', async () => {
    mockRepo.findRoomTypeById.mockResolvedValue(null);

    await expect(service.findRoomTypeById('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  // ─── Room Tests ───────────────────────────────────────────────────────────

  it('createRoom stores number, floor, roomTypeId, notes; physicalStatus defaults AVAILABLE; cleaningStatus defaults CLEAN', async () => {
    const newRoom = { ...mockRoom };
    mockRepo.createRoom.mockResolvedValue(newRoom);
    const dto = {
      number: '101',
      floor: 1,
      roomTypeId: 'rt-1',
      notes: 'Corner room',
    };

    const result = await service.createRoom(dto as any);

    expect(mockRepo.createRoom).toHaveBeenCalledWith(dto);
    expect(result.physicalStatus).toBe('AVAILABLE');
    expect(result.cleaningStatus).toBe('CLEAN');
    expect(result.number).toBe('101');
  });

  it('updateRoomStatus — PATCH physicalStatus=OUT_OF_SERVICE on AVAILABLE room succeeds; cleaningStatus unchanged', async () => {
    mockRepo.findRoomById.mockResolvedValue({ ...mockRoom, physicalStatus: 'AVAILABLE', cleaningStatus: 'DIRTY' });
    const updated = { ...mockRoom, physicalStatus: 'OUT_OF_SERVICE', cleaningStatus: 'DIRTY' };
    mockRepo.updateRoomStatus.mockResolvedValue(updated);

    const result = await service.updateRoomStatus('rm-1', {
      physicalStatus: 'OUT_OF_SERVICE' as any,
    });

    // Only physicalStatus changed — cleaningStatus untouched
    expect(result.physicalStatus).toBe('OUT_OF_SERVICE');
    expect(result.cleaningStatus).toBe('DIRTY');
    expect(mockRepo.updateRoomStatus).toHaveBeenCalledWith('rm-1', {
      physicalStatus: 'OUT_OF_SERVICE',
    });
  });

  it('updateRoomStatus — PATCH physicalStatus=OCCUPIED when already OCCUPIED throws 422', async () => {
    mockRepo.findRoomById.mockResolvedValue({
      ...mockRoom,
      physicalStatus: 'OCCUPIED',
    });

    await expect(
      service.updateRoomStatus('rm-1', { physicalStatus: 'OCCUPIED' as any }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('updateRoomStatus — PATCH cleaningStatus=DIRTY does NOT change physicalStatus', async () => {
    mockRepo.findRoomById.mockResolvedValue({
      ...mockRoom,
      physicalStatus: 'AVAILABLE',
      cleaningStatus: 'CLEAN',
    });
    const updated = { ...mockRoom, physicalStatus: 'AVAILABLE', cleaningStatus: 'DIRTY' };
    mockRepo.updateRoomStatus.mockResolvedValue(updated);

    const result = await service.updateRoomStatus('rm-1', {
      cleaningStatus: 'DIRTY' as any,
    });

    // physicalStatus must not be included in the repo call
    expect(mockRepo.updateRoomStatus).toHaveBeenCalledWith('rm-1', {
      cleaningStatus: 'DIRTY',
    });
    expect(result.physicalStatus).toBe('AVAILABLE');
    expect(result.cleaningStatus).toBe('DIRTY');
  });

  it('findAvailableRooms excludes OUT_OF_SERVICE rooms', async () => {
    const availableRoom = { ...mockRoom, physicalStatus: 'AVAILABLE' };
    mockRepo.findAvailableRooms.mockResolvedValue([availableRoom]);

    const result = await service.findAvailableRooms();

    // Service delegates to repository; repository applies the filter
    expect(mockRepo.findAvailableRooms).toHaveBeenCalledWith(undefined);
    const statuses = result.map((r: any) => r.physicalStatus);
    expect(statuses).not.toContain('OUT_OF_SERVICE');
  });

  it('findAvailableRooms excludes ON_HOLD rooms', async () => {
    mockRepo.findAvailableRooms.mockResolvedValue([]);

    const result = await service.findAvailableRooms();

    const statuses = result.map((r: any) => r.physicalStatus);
    expect(statuses).not.toContain('ON_HOLD');
  });

  it('findAvailableRooms includes AVAILABLE rooms regardless of cleaningStatus', async () => {
    const dirtyAvailable = {
      ...mockRoom,
      physicalStatus: 'AVAILABLE',
      cleaningStatus: 'DIRTY',
    };
    mockRepo.findAvailableRooms.mockResolvedValue([dirtyAvailable]);

    const result = await service.findAvailableRooms();

    expect(result).toHaveLength(1);
    expect(result[0].physicalStatus).toBe('AVAILABLE');
    expect(result[0].cleaningStatus).toBe('DIRTY');
  });
});
