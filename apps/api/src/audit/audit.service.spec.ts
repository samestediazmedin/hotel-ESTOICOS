import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };
    service = new AuditService(mockPrisma);
  });

  describe('log', () => {
    it('should create audit log with all fields', async () => {
      const entry = {
        action: 'USER_UPDATE',
        actorId: 'admin-123',
        targetId: 'user-456',
        targetType: 'USER',
        details: { changes: { name: 'Updated' } },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1', ...entry });

      const result = await service.log(entry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'USER_UPDATE',
          actorId: 'admin-123',
          targetId: 'user-456',
          targetType: 'USER',
          details: { changes: { name: 'Updated' } },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      });
      expect(result.id).toBe('log-1');
    });

    it('should default targetType to USER when not provided', async () => {
      const entry = {
        action: 'USER_LOGIN',
        actorId: 'admin-123',
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1', ...entry, targetType: 'USER' });

      await service.log(entry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetType: 'USER',
        }),
      });
    });

    it('should default details to empty object when not provided', async () => {
      const entry = {
        action: 'USER_LOGOUT',
        actorId: 'admin-123',
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.log(entry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: {},
        }),
      });
    });

    it('should handle null targetId (actions without target)', async () => {
      const entry = {
        action: 'SYSTEM_BACKUP',
        actorId: 'admin-123',
        targetId: undefined,
      };

      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.log(entry);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetId: undefined,
        }),
      });
    });
  });

  describe('getLogsForTarget', () => {
    it('should retrieve logs for target with default limit', async () => {
      const logs = [
        { id: 'log-1', action: 'USER_UPDATE', actor: { name: 'Admin' } },
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.getLogsForTarget('user-456');

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { targetId: 'user-456' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });
      expect(result).toEqual(logs);
    });

    it('should respect custom limit', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      await service.getLogsForTarget('user-456', 10);

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('getLogsByActor', () => {
    it('should retrieve logs by actor with default limit', async () => {
      const logs = [
        { id: 'log-1', action: 'USER_UPDATE', target: { name: 'User' } },
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(logs);

      const result = await service.getLogsByActor('admin-123');

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { actorId: 'admin-123' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          target: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });
      expect(result).toEqual(logs);
    });
  });
});
