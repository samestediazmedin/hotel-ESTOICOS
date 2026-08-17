import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser = {
    id: 'u-123',
    email: 'staff@hotel.com',
    name: 'Staff Member',
    role: 'RECEPTION',
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            createUser: vi.fn().mockResolvedValue(mockUser),
            findAll: vi.fn().mockResolvedValue([mockUser]),
            findOne: vi.fn().mockResolvedValue(mockUser),
            updateUser: vi.fn().mockResolvedValue(mockUser),
            changeStatus: vi.fn().mockResolvedValue({ ...mockUser, status: 'ACTIVE' }),
            changePassword: vi.fn().mockResolvedValue({ ...mockUser, mustChangePassword: true }),
            resetPassword: vi.fn().mockResolvedValue({ ...mockUser, mustChangePassword: true }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  describe('POST /api/users', () => {
    it('should create a user successfully', async () => {
      const dto = {
        email: 'staff@hotel.com',
        name: 'Staff Member',
        password: 'MyPass123',
        role: 'RECEPTION' as const,
      };
      const req = { user: { sub: 'admin-123', role: 'ADMIN' } } as any;

      const result = await controller.create(dto, req);

      expect(service.createUser).toHaveBeenCalledWith(dto, req.user);
      expect(result).toEqual(mockUser);
    });

    it('should handle duplicate email error', async () => {
      const dto = {
        email: 'existing@hotel.com',
        name: 'Staff Member',
        password: 'MyPass123',
        role: 'RECEPTION' as const,
      };
      const req = { user: { sub: 'admin-123', role: 'ADMIN' } } as any;

      vi.spyOn(service, 'createUser').mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`email`)'),
      );

      await expect(controller.create(dto, req)).rejects.toThrow();
    });
  });

  describe('GET /api/users', () => {
    it('should return list of users', async () => {
      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return a single user', async () => {
      const result = await controller.findOne('u-123');

      expect(service.findOne).toHaveBeenCalledWith('u-123');
      expect(result).toEqual(mockUser);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('should update a user', async () => {
      const dto = { name: 'Updated Name' };
      const req = { user: { sub: 'admin-123', role: 'ADMIN' } };
      const result = await controller.update('u-123', dto, req as any);

      expect(service.updateUser).toHaveBeenCalledWith('u-123', dto, req.user);
      expect(result).toEqual(mockUser);
    });
  });

  describe('POST /api/users/:id/activate', () => {
    it('should activate a user', async () => {
      const req = { user: { sub: 'admin-123', role: 'ADMIN' } };
      const result = await controller.activate('u-123', req as any);

      expect(service.changeStatus).toHaveBeenCalledWith('u-123', 'ACTIVE', req.user);
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('POST /api/users/:id/suspend', () => {
    it('should suspend a user', async () => {
      const req = { user: { sub: 'admin-123', role: 'ADMIN' } };
      const result = await controller.suspend('u-123', req as any);

      expect(service.changeStatus).toHaveBeenCalledWith('u-123', 'SUSPENDED', req.user);
    });
  });

  describe('POST /api/users/:id/deactivate', () => {
    it('should deactivate a user', async () => {
      const req = { user: { sub: 'admin-123', role: 'ADMIN' } };
      const result = await controller.deactivate('u-123', req as any);

      expect(service.changeStatus).toHaveBeenCalledWith('u-123', 'INACTIVE', req.user);
    });
  });

  describe('POST /api/users/:id/change-password', () => {
    it('should change password', async () => {
      const dto = { tempPassword: 'NewTemp123' };
      const req = { user: { sub: 'admin-123', role: 'ADMIN' } };
      const result = await controller.changePassword('u-123', dto, req as any);

      expect(service.changePassword).toHaveBeenCalledWith('u-123', dto, req.user);
      expect(result.mustChangePassword).toBe(true);
    });
  });
});
