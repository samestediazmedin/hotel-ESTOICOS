import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginAttemptService } from './login-attempt.service';

const EMAIL_GLOBAL_IP = '0.0.0.0/email-global';

const mockPrisma = {
  loginAttempt: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

describe('LoginAttemptService', () => {
  let service: LoginAttemptService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoginAttemptService(mockPrisma as any);
  });

  describe('validateAttempt', () => {
    it('should NOT throw if no record exists', async () => {
      mockPrisma.loginAttempt.findUnique.mockResolvedValue(null);

      await expect(
        service.validateAttempt('user@hotel.com', '127.0.0.1'),
      ).resolves.not.toThrow();
    });

    it('should NOT throw if record exists but not blocked', async () => {
      mockPrisma.loginAttempt.findUnique.mockResolvedValue({
        id: 'la-1',
        email: 'user@hotel.com',
        ip: '127.0.0.1',
        count: 3,
        blockedAt: null,
        expiresAt: null,
      });

      await expect(
        service.validateAttempt('user@hotel.com', '127.0.0.1'),
      ).resolves.not.toThrow();
    });

    it('should NOT throw if blockedAt is set but expiresAt is in the past', async () => {
      mockPrisma.loginAttempt.findUnique.mockResolvedValue({
        id: 'la-1',
        count: 5,
        blockedAt: new Date(Date.now() - 20 * 60 * 1000),
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // expired 5 min ago
      });

      await expect(
        service.validateAttempt('user@hotel.com', '127.0.0.1'),
      ).resolves.not.toThrow();
    });

    it('should throw HttpException 429 if per-IP block is active', async () => {
      // Return per-IP blocked, per-email not blocked
      mockPrisma.loginAttempt.findUnique.mockImplementation(({ where }: any) => {
        if (where.email_ip.ip === EMAIL_GLOBAL_IP) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          id: 'la-1',
          count: 5,
          blockedAt: new Date(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });
      });

      await expect(
        service.validateAttempt('user@hotel.com', '127.0.0.1'),
      ).rejects.toThrow();

      try {
        await service.validateAttempt('user@hotel.com', '127.0.0.1');
      } catch (err: any) {
        expect(err.status).toBe(429);
      }
    });

    it('should throw HttpException 429 if per-email global block is active', async () => {
      // Per-IP not blocked, per-email blocked
      mockPrisma.loginAttempt.findUnique.mockImplementation(({ where }: any) => {
        if (where.email_ip.ip === EMAIL_GLOBAL_IP) {
          return Promise.resolve({
            id: 'la-email',
            count: 15,
            blockedAt: new Date(),
            expiresAt: new Date(Date.now() + 20 * 60 * 1000),
          });
        }
        return Promise.resolve(null); // per-IP not blocked
      });

      await expect(
        service.validateAttempt('user@hotel.com', '127.0.0.1'),
      ).rejects.toThrow();

      try {
        await service.validateAttempt('user@hotel.com', '127.0.0.1');
      } catch (err: any) {
        expect(err.status).toBe(429);
      }
    });

    it('should check both per-IP and per-email records', async () => {
      mockPrisma.loginAttempt.findUnique.mockResolvedValue(null);

      await service.validateAttempt('test@hotel.com', '10.0.0.1');

      // Should have been called twice: once for per-IP, once for per-email
      expect(mockPrisma.loginAttempt.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrisma.loginAttempt.findUnique).toHaveBeenCalledWith({
        where: { email_ip: { email: 'test@hotel.com', ip: '10.0.0.1' } },
      });
      expect(mockPrisma.loginAttempt.findUnique).toHaveBeenCalledWith({
        where: { email_ip: { email: 'test@hotel.com', ip: EMAIL_GLOBAL_IP } },
      });
    });
  });

  describe('recordFailure', () => {
    it('should upsert both per-IP and per-email rows on each failure', async () => {
      mockPrisma.loginAttempt.upsert.mockResolvedValue({
        count: 1,
        blockedAt: null,
        expiresAt: null,
      });
      mockPrisma.loginAttempt.findUnique.mockResolvedValue({
        count: 1,
        blockedAt: null,
        expiresAt: null,
      });

      await service.recordFailure('user@hotel.com', '127.0.0.1');

      // 2 upserts: per-IP + per-email
      expect(mockPrisma.loginAttempt.upsert).toHaveBeenCalledTimes(2);

      const calls = mockPrisma.loginAttempt.upsert.mock.calls;
      const ips = calls.map((c: any) => c[0].where.email_ip.ip);
      expect(ips).toContain('127.0.0.1');
      expect(ips).toContain(EMAIL_GLOBAL_IP);
    });

    it('should block per-IP when count reaches 5', async () => {
      mockPrisma.loginAttempt.upsert.mockResolvedValue({
        count: 5,
        blockedAt: null,
        expiresAt: null,
      });
      // After upsert, findUnique returns count=5
      mockPrisma.loginAttempt.findUnique.mockResolvedValue({
        count: 5,
        blockedAt: null,
        expiresAt: null,
      });
      mockPrisma.loginAttempt.update.mockResolvedValue({});

      await service.recordFailure('user@hotel.com', '127.0.0.1');

      // Should have called update to set blockedAt/expiresAt
      expect(mockPrisma.loginAttempt.update).toHaveBeenCalled();
    });

    it('after 4 per-IP failures, validateAttempt still passes', async () => {
      mockPrisma.loginAttempt.findUnique.mockImplementation(({ where }: any) => {
        if (where.email_ip.ip === EMAIL_GLOBAL_IP) {
          return Promise.resolve({ count: 4, blockedAt: null, expiresAt: null });
        }
        return Promise.resolve({ id: 'la-1', count: 4, blockedAt: null, expiresAt: null });
      });

      await expect(
        service.validateAttempt('user@hotel.com', '127.0.0.1'),
      ).resolves.not.toThrow();
    });
  });

  describe('clearAttempts', () => {
    it('should delete both per-IP and per-email rows', async () => {
      mockPrisma.loginAttempt.delete.mockResolvedValue({ id: 'la-1' });

      await service.clearAttempts('user@hotel.com', '127.0.0.1');

      expect(mockPrisma.loginAttempt.delete).toHaveBeenCalledTimes(2);
      expect(mockPrisma.loginAttempt.delete).toHaveBeenCalledWith({
        where: { email_ip: { email: 'user@hotel.com', ip: '127.0.0.1' } },
      });
      expect(mockPrisma.loginAttempt.delete).toHaveBeenCalledWith({
        where: { email_ip: { email: 'user@hotel.com', ip: EMAIL_GLOBAL_IP } },
      });
    });

    it('should NOT throw if rows do not exist', async () => {
      mockPrisma.loginAttempt.delete.mockRejectedValue({
        code: 'P2025', // Prisma record not found
      });

      await expect(
        service.clearAttempts('noone@hotel.com', '0.0.0.0'),
      ).resolves.not.toThrow();
    });
  });
});
