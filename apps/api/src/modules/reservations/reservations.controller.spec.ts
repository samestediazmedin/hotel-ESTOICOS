import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';

describe('ReservationsController', () => {
  let controller: ReservationsController;
  let reservationsService: ReservationsService;
  let availabilityService: AvailabilityService;

  const mockReservation = {
    id: 'res-123',
    guestId: 'guest-123',
    roomId: 'room-123',
    checkIn: new Date('2026-07-01'),
    checkOut: new Date('2026-07-05'),
    status: 'CONFIRMED',
    adults: 2,
    children: 0,
    totalAmount: 500000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        {
          provide: ReservationsService,
          useValue: {
            findAll: vi.fn().mockResolvedValue([mockReservation]),
            findById: vi.fn().mockResolvedValue(mockReservation),
            create: vi.fn().mockResolvedValue(mockReservation),
            modify: vi.fn().mockResolvedValue(mockReservation),
            cancel: vi.fn().mockResolvedValue({ ...mockReservation, status: 'CANCELLED' }),
            confirmRequest: vi.fn().mockResolvedValue({ ...mockReservation, status: 'CONFIRMED' }),
            rejectRequest: vi.fn().mockResolvedValue({ ...mockReservation, status: 'CANCELLED', notes: 'Rejected: no availability' }),
            reactivate: vi.fn().mockResolvedValue({ ...mockReservation, status: 'PENDING' }),
          },
        },
        {
          provide: AvailabilityService,
          useValue: {
            searchAvailable: vi.fn().mockResolvedValue([{ id: 'room-1', number: '101', type: 'STANDARD' }]),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReservationsController>(ReservationsController);
    reservationsService = module.get<ReservationsService>(ReservationsService);
    availabilityService = module.get<AvailabilityService>(AvailabilityService);
  });

  describe('GET /api/availability', () => {
    it('should search available rooms with valid query', async () => {
      const query = { checkIn: '2026-07-01', checkOut: '2026-07-05', adults: '2' };
      const result = await controller.searchAvailability(query);

      expect(availabilityService.searchAvailable).toHaveBeenCalled();
      expect(result.rooms).toBeDefined();
      expect(Array.isArray(result.rooms)).toBe(true);
    });

    it('should throw BadRequestException for invalid query', async () => {
      const query = { checkIn: 'invalid', checkOut: '2026-07-05' };
      await expect(controller.searchAvailability(query)).rejects.toThrow();
    });
  });

  describe('GET /api/reservations', () => {
    it('should return list of reservations', async () => {
      const result = await controller.findAll();

      expect(reservationsService.findAll).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should pass query filters to service', async () => {
      await controller.findAll('2026-07-01', '2026-07-05', 'CONFIRMED', 'room-123', 'guest-123');

      expect(reservationsService.findAll).toHaveBeenCalledWith({
        from: '2026-07-01',
        to: '2026-07-05',
        status: 'CONFIRMED',
        roomId: 'room-123',
        guestId: 'guest-123',
      });
    });
  });

  describe('GET /api/reservations/:id', () => {
    it('should return a single reservation', async () => {
      const result = await controller.findOne('res-123');

      expect(reservationsService.findById).toHaveBeenCalledWith('res-123');
      expect(result.id).toBe('res-123');
    });
  });

  describe('POST /api/reservations', () => {
    it('should create a reservation', async () => {
      const dto = {
        guestId: 'guest-123',
        roomId: 'room-123',
        checkIn: new Date('2026-07-01'),
        checkOut: new Date('2026-07-05'),
        adults: 2,
      } as any;

      const result = await controller.create(dto);

      expect(reservationsService.create).toHaveBeenCalledWith(dto);
      expect(result.id).toBe('res-123');
    });
  });

  describe('PATCH /api/reservations/:id', () => {
    it('should modify a reservation', async () => {
      const dto = { adults: 3 } as any;
      const result = await controller.modify('res-123', dto);

      expect(reservationsService.modify).toHaveBeenCalledWith('res-123', dto);
      expect(result.id).toBe('res-123');
    });
  });

  describe('POST /api/reservations/:id/cancel', () => {
    it('should cancel a reservation', async () => {
      const result = await controller.cancel('res-123');

      expect(reservationsService.cancel).toHaveBeenCalledWith('res-123');
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('POST /api/reservations/:id/confirm', () => {
    it('should confirm a pending reservation', async () => {
      const result = await controller.confirmRequest('res-123');

      expect(reservationsService.confirmRequest).toHaveBeenCalledWith('res-123');
      expect(result.status).toBe('CONFIRMED');
    });
  });

  describe('POST /api/reservations/:id/reject', () => {
    it('should reject a reservation with reason', async () => {
      const result = await controller.rejectRequest('res-123', { reason: 'No availability' });

      expect(reservationsService.rejectRequest).toHaveBeenCalledWith('res-123', 'No availability');
      expect(result.status).toBe('CANCELLED');
    });

    it('should reject a reservation without reason', async () => {
      const result = await controller.rejectRequest('res-123', {});

      expect(reservationsService.rejectRequest).toHaveBeenCalledWith('res-123', undefined);
    });
  });

  describe('POST /api/reservations/:id/reactivate', () => {
    it('should reactivate a cancelled reservation', async () => {
      const result = await controller.reactivate('res-123');

      expect(reservationsService.reactivate).toHaveBeenCalledWith('res-123');
      expect(result.status).toBe('PENDING');
    });
  });
});
