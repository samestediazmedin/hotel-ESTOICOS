import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { GuestsRepository } from './guests.repository';
import { GuestEncryptionService } from './encryption/guest-encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('GuestsController', () => {
  let controller: GuestsController;
  let service: GuestsService;

  const mockGuest = {
    id: 'guest-123',
    fullName: 'Test Guest',
    email: 'test@test.com',
    phone: '+573001234567',
    documentType: 'CC',
    documentNumber: 'encrypted-doc',
    nationality: 'CO',
    dateOfBirth: new Date('1990-01-01'),
    anonymizedAt: null,
    createdAt: new Date(),
    preferredLanguage: 'es',
    contactPreference: null,
    whatsappNumber: null,
    marketingConsent: false,
    dietaryRestrictions: null,
    specialRequests: null,
    contactEvents: [],
  };

  const mockGuestResponse = {
    id: 'guest-123',
    fullName: 'Test Guest',
    email: 'test@test.com',
    phone: '+573001234567',
    documentType: 'CC',
    documentNumber: '123456789',
    nationality: 'CO',
    dateOfBirth: '1990-01-01',
    anonymizedAt: null,
    createdAt: new Date().toISOString(),
    whatsappNumber: null,
    contactPreference: null,
    preferredLanguage: 'es',
    marketingConsent: false,
    dietaryRestrictions: null,
    specialRequests: null,
    lastContactEvent: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GuestsController],
      providers: [
        {
          provide: GuestsService,
          useValue: {
            create: vi.fn().mockResolvedValue(mockGuestResponse),
            findAll: vi.fn().mockResolvedValue([mockGuest]),
            findById: vi.fn().mockResolvedValue(mockGuest),
            update: vi.fn().mockResolvedValue(mockGuestResponse),
            getHistory: vi.fn().mockResolvedValue({
              guest: mockGuestResponse,
              reservations: [],
              totalNights: 0,
              totalSpent: 0,
            }),
            anonymize: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined),
            toResponseDto: vi.fn().mockReturnValue(mockGuestResponse),
            toPublicDto: vi.fn().mockReturnValue({
              ...mockGuestResponse,
              documentNumber: undefined,
            }),
            searchByNameForAI: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: GuestsRepository,
          useValue: {},
        },
        {
          provide: GuestEncryptionService,
          useValue: {
            encrypt: vi.fn().mockReturnValue('encrypted-doc'),
            decrypt: vi.fn().mockReturnValue('123456789'),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            guest: {
              create: vi.fn(),
              findUnique: vi.fn(),
              findMany: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
              count: vi.fn(),
            },
            reservation: {
              findMany: vi.fn(),
              count: vi.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<GuestsController>(GuestsController);
    service = module.get<GuestsService>(GuestsService);
  });

  describe('POST /api/guests', () => {
    it('should create a guest successfully', async () => {
      const dto = {
        fullName: 'Test Guest',
        email: 'test@test.com',
        phone: '+573001234567',
        documentType: 'CC' as const,
        documentNumber: '123456789',
        nationality: 'CO',
        dateOfBirth: '1990-01-01',
      };

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockGuestResponse);
    });

    it('should handle service errors gracefully', async () => {
      const dto = {
        fullName: 'Test Guest',
        email: 'test@test.com',
        phone: '+573001234567',
        documentType: 'CC' as const,
        documentNumber: '123456789',
        nationality: 'CO',
        dateOfBirth: '1990-01-01',
      };

      vi.spyOn(service, 'create').mockRejectedValue(new Error('Database error'));

      await expect(controller.create(dto)).rejects.toThrow();
    });
  });

  describe('GET /api/guests', () => {
    it('should return list of guests', async () => {
      const user = { sub: 'admin', role: 'ADMIN', email: 'admin@hotel.com' };
      const result = await controller.findAll(undefined, undefined, undefined, user);

      expect(service.findAll).toHaveBeenCalledWith(0, 50, undefined);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('GET /api/guests/:id', () => {
    it('should return a single guest', async () => {
      const user = { sub: 'admin', role: 'ADMIN', email: 'admin@hotel.com' };
      const result = await controller.findOne('guest-123', user);

      expect(service.findById).toHaveBeenCalledWith('guest-123');
      expect(result).toEqual(mockGuestResponse);
    });
  });

  describe('PATCH /api/guests/:id', () => {
    it('should update a guest', async () => {
      const dto = { fullName: 'Updated Name' };
      const result = await controller.update('guest-123', dto);

      expect(service.update).toHaveBeenCalledWith('guest-123', dto);
      expect(result).toEqual(mockGuestResponse);
    });
  });

  describe('DELETE /api/guests/:id', () => {
    it('should remove a guest', async () => {
      await controller.remove('guest-123');

      expect(service.remove).toHaveBeenCalledWith('guest-123');
    });
  });
});
