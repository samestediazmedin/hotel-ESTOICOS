import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: InventoryService;

  const mockRoomType = {
    id: 'rt-123',
    name: 'Estándar',
    description: 'Habitación estándar',
    basePrice: 150000,
    maxOccupancy: 2,
    isActive: true,
  };

  const mockRoom = {
    id: 'room-123',
    number: '101',
    roomTypeId: 'rt-123',
    floor: 1,
    physicalStatus: 'AVAILABLE',
    cleaningStatus: 'CLEAN',
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: {
            findAllRoomTypes: vi.fn().mockResolvedValue([mockRoomType]),
            createRoomType: vi.fn().mockResolvedValue(mockRoomType),
            findRoomTypeById: vi.fn().mockResolvedValue(mockRoomType),
            updateRoomType: vi.fn().mockResolvedValue({ ...mockRoomType, name: 'Updated' }),
            deactivateRoomType: vi.fn().mockResolvedValue({ ...mockRoomType, isActive: false }),
            activateRoomType: vi.fn().mockResolvedValue({ ...mockRoomType, isActive: true }),
            findAllRooms: vi.fn().mockResolvedValue([mockRoom]),
            findAvailableRooms: vi.fn().mockResolvedValue([mockRoom]),
            createRoom: vi.fn().mockResolvedValue(mockRoom),
            findRoomById: vi.fn().mockResolvedValue(mockRoom),
            updateRoom: vi.fn().mockResolvedValue({ ...mockRoom, number: '102' }),
            updateRoomStatus: vi.fn().mockResolvedValue({ ...mockRoom, physicalStatus: 'OCCUPIED' }),
            deactivateRoom: vi.fn().mockResolvedValue({ ...mockRoom, isActive: false }),
            activateRoom: vi.fn().mockResolvedValue({ ...mockRoom, isActive: true }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InventoryController>(InventoryController);
    service = module.get<InventoryService>(InventoryService);
  });

  describe('Room Types', () => {
    it('GET /api/inventory/room-types should return all room types', async () => {
      const result = await controller.findAllRoomTypes();
      expect(service.findAllRoomTypes).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('POST /api/inventory/room-types should create room type', async () => {
      const dto = { name: 'Deluxe', basePrice: 250000, maxOccupancy: 2 } as any;
      const result = await controller.createRoomType(dto);
      expect(service.createRoomType).toHaveBeenCalledWith(dto);
      expect(result.id).toBe('rt-123');
    });

    it('GET /api/inventory/room-types/:id should return room type', async () => {
      const result = await controller.findRoomType('rt-123');
      expect(service.findRoomTypeById).toHaveBeenCalledWith('rt-123');
      expect(result.id).toBe('rt-123');
    });

    it('PATCH /api/inventory/room-types/:id should update room type', async () => {
      const dto = { name: 'Updated' } as any;
      const result = await controller.updateRoomType('rt-123', dto);
      expect(service.updateRoomType).toHaveBeenCalledWith('rt-123', dto);
      expect(result.name).toBe('Updated');
    });

    it('POST /api/inventory/room-types/:id/deactivate should deactivate', async () => {
      const result = await controller.deactivateRoomType('rt-123');
      expect(service.deactivateRoomType).toHaveBeenCalledWith('rt-123');
      expect(result.isActive).toBe(false);
    });

    it('POST /api/inventory/room-types/:id/activate should activate', async () => {
      const result = await controller.activateRoomType('rt-123');
      expect(service.activateRoomType).toHaveBeenCalledWith('rt-123');
      expect(result.isActive).toBe(true);
    });
  });

  describe('Rooms', () => {
    it('GET /api/inventory/rooms should return all rooms', async () => {
      const result = await controller.findAllRooms();
      expect(service.findAllRooms).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('GET /api/inventory/rooms/available should return available rooms', async () => {
      const result = await controller.findAvailableRooms();
      expect(service.findAvailableRooms).toHaveBeenCalledWith(undefined);
      expect(Array.isArray(result)).toBe(true);
    });

    it('GET /api/inventory/rooms/available?roomTypeId should filter by type', async () => {
      await controller.findAvailableRooms('rt-123');
      expect(service.findAvailableRooms).toHaveBeenCalledWith('rt-123');
    });

    it('POST /api/inventory/rooms should create room', async () => {
      const dto = { number: '101', roomTypeId: 'rt-123', floor: 1 } as any;
      const result = await controller.createRoom(dto);
      expect(service.createRoom).toHaveBeenCalledWith(dto);
      expect(result.number).toBe('101');
    });

    it('GET /api/inventory/rooms/:id should return room', async () => {
      const result = await controller.findRoom('room-123');
      expect(service.findRoomById).toHaveBeenCalledWith('room-123');
      expect(result.id).toBe('room-123');
    });

    it('PATCH /api/inventory/rooms/:id should update room', async () => {
      const dto = { number: '102' } as any;
      const result = await controller.updateRoom('room-123', dto);
      expect(service.updateRoom).toHaveBeenCalledWith('room-123', dto);
      expect(result.number).toBe('102');
    });

    it('PATCH /api/inventory/rooms/:id/status should update status', async () => {
      const dto = { physicalStatus: 'OCCUPIED' } as any;
      const result = await controller.updateRoomStatus('room-123', dto);
      expect(service.updateRoomStatus).toHaveBeenCalledWith('room-123', dto);
      expect(result.physicalStatus).toBe('OCCUPIED');
    });

    it('POST /api/inventory/rooms/:id/deactivate should deactivate', async () => {
      const result = await controller.deactivateRoom('room-123');
      expect(service.deactivateRoom).toHaveBeenCalledWith('room-123');
      expect(result.isActive).toBe(false);
    });

    it('POST /api/inventory/rooms/:id/activate should activate', async () => {
      const result = await controller.activateRoom('room-123');
      expect(service.activateRoom).toHaveBeenCalledWith('room-123');
      expect(result.isActive).toBe(true);
    });
  });
});
