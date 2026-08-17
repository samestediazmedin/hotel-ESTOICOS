import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

const mockPrisma = {
  user: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

const mockTokenService = {
  revokeAllSessions: vi.fn(),
};

const mockAuditService = {
  log: vi.fn(),
};

const mockActor = { sub: 'admin-123', role: 'ADMIN', email: 'admin@hotel.com' };

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService(mockPrisma as any, mockTokenService as any, mockAuditService as any);
  });

  describe('createUser', () => {
    it('should hash password with bcrypt and create user', async () => {
      mockPrisma.user.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'u-new',
          email: data.email,
          name: data.name,
          role: data.role,
          status: 'ACTIVE',
          isActive: true,
          mustChangePassword: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const result = await service.createUser({
        email: 'staff@hotel.com',
        name: 'Staff Member',
        password: 'MyPass123',
        role: 'RECEPTION',
      }, mockActor);

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).toBeDefined();
      expect(createCall.data.passwordHash).not.toBe('MyPass123');
      const isValidHash = await bcrypt.compare('MyPass123', createCall.data.passwordHash);
      expect(isValidHash).toBe(true);
    });

    it('should log audit on user creation', async () => {
      mockPrisma.user.create.mockResolvedValue({
        id: 'u-new',
        email: 'staff@hotel.com',
        name: 'Staff Member',
        role: 'RECEPTION',
      });

      await service.createUser({
        email: 'staff@hotel.com',
        name: 'Staff Member',
        password: 'MyPass123',
        role: 'RECEPTION',
      }, mockActor);

      expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'USER_CREATE',
        actorId: 'admin-123',
        targetId: 'u-new',
      }));
    });

    it('should throw ConflictException on duplicate email (P2002)', async () => {
      mockPrisma.user.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['email'] },
      });

      await expect(service.createUser({
        email: 'existing@hotel.com',
        name: 'Staff Member',
        password: 'MyPass123',
        role: 'RECEPTION',
      }, mockActor)).rejects.toThrow('Ya existe un usuario con este email');
    });
  });

  describe('changeStatus', () => {
    it('should set status and call revokeAllSessions for SUSPENDED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'RECEPTION',
        status: 'ACTIVE',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        status: 'SUSPENDED',
        isActive: false,
      });
      mockTokenService.revokeAllSessions.mockResolvedValue(2);

      await service.changeStatus('u1', 'SUSPENDED', mockActor);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { status: 'SUSPENDED', isActive: false },
        select: expect.any(Object),
      });
      expect(mockTokenService.revokeAllSessions).toHaveBeenCalledWith('u1');
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should block admin self-suspension', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-123',
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      await expect(service.changeStatus('admin-123', 'SUSPENDED', mockActor))
        .rejects.toThrow('No puedes desactivar ni suspender tu propia cuenta de administrador');
    });
  });

  describe('changePassword', () => {
    it('should change password for regular user without verification', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'RECEPTION',
        passwordHash: await bcrypt.hash('oldpass', 12),
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', mustChangePassword: true });

      await service.changePassword('u1', { tempPassword: 'NewPass123' }, mockActor);

      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockTokenService.revokeAllSessions).toHaveBeenCalledWith('u1');
    });

    it('should require current password for admin target', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'ADMIN',
        passwordHash: await bcrypt.hash('oldpass', 12),
      });

      await expect(service.changePassword('u1', { tempPassword: 'AdminPass123!' }, mockActor))
        .rejects.toThrow('Para cambiar la contraseña de un administrador, debes confirmar tu contraseña actual');
    });

    it('should validate admin password complexity', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'ADMIN',
        passwordHash: await bcrypt.hash('oldpass', 12),
      });

      await expect(service.changePassword('u1', {
        tempPassword: 'short',
        currentPassword: 'admin123',
      }, mockActor))
        .rejects.toThrow('Requisitos de contraseña no cumplidos');
    });
  });

  describe('updateUser', () => {
    it('should block admin self-role-change', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-123',
        role: 'ADMIN',
      });

      await expect(service.updateUser('admin-123', { role: 'MANAGER' }, mockActor))
        .rejects.toThrow('No puedes cambiar el rol de tu propia cuenta de administrador');
    });

    it('should update user and log audit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'RECEPTION',
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', name: 'Updated' });

      await service.updateUser('u1', { name: 'Updated' }, mockActor);

      expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'USER_UPDATE',
        actorId: 'admin-123',
        targetId: 'u1',
      }));
    });
  });

  describe('resetPassword', () => {
    it('should reset password and log audit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        role: 'RECEPTION',
        email: 'staff@hotel.com',
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', mustChangePassword: true });

      await service.resetPassword('u1', 'NewTemp123', mockActor);

      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'USER_PASSWORD_RESET',
        actorId: 'admin-123',
        targetId: 'u1',
      }));
    });

    it('should throw BadRequestException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('u1', 'NewTemp123', mockActor))
        .rejects.toThrow('Usuario no encontrado');
    });
  });
});