import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

// Mock PrismaService
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
};

// Mock JwtService
const mockJwtService = {
  sign: vi.fn(),
};

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TokenService(mockPrisma as any, mockJwtService as any);
  });

  describe('createTokenPair', () => {
    it('should create a refresh token row and return access + raw refresh', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });
      mockJwtService.sign.mockReturnValue('signed-access-token');

      const result = await service.createTokenPair('user-1');

      expect(result.accessToken).toBe('signed-access-token');
      expect(result.rawRefreshToken).toBeDefined();
      expect(result.rawRefreshToken).toHaveLength(128); // 64 bytes hex
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledOnce();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.createTokenPair('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should set expiresAt approximately 24h in the future', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });
      mockJwtService.sign.mockReturnValue('signed-access-token');

      const now = Date.now();
      await service.createTokenPair('user-1');

      const createCall = mockPrisma.refreshToken.create.mock.calls[0][0];
      const expMs = (createCall.data.expiresAt as Date).getTime();
      expect(expMs).toBeGreaterThan(now + 23 * 60 * 60 * 1000);
      expect(expMs).toBeLessThan(now + 25 * 60 * 60 * 1000);
    });
  });

  describe('rotateRefreshToken', () => {
    it('should delete old token and create new pair', async () => {
      const rawToken = 'a'.repeat(128);
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
      });
      // Atomic delete returns count (concurrency-safe — bugfix 2026-05-22)
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-2' });
      mockJwtService.sign.mockReturnValue('new-access');

      const result = await service.rotateRefreshToken(rawToken);

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
      expect(result.accessToken).toBe('new-access');
      expect(result.rawRefreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException if token row not found', async () => {
      mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        service.rotateRefreshToken('nonexistent'.padEnd(128, 'x')),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token is expired', async () => {
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-old',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000), // expired
      });

      await expect(
        service.rotateRefreshToken('sometoken'.padEnd(128, 'x')),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException (NOT 500) on concurrent rotation race', async () => {
      // Race scenario: findFirst finds the row, but by the time deleteMany runs,
      // another concurrent request has already rotated this token → count = 0.
      // This must produce 401, not crash 500. Bugfix 2026-05-22.
      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-race',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.rotateRefreshToken('racetoken'.padEnd(128, 'x')),
      ).rejects.toThrow(UnauthorizedException);

      // createTokenPair should NOT have been called
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('revokeToken', () => {
    it('should delete the matching token row', async () => {
      const rawToken = 'b'.repeat(128);
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.revokeToken(rawToken);

      // deleteMany filters by token hash (idempotent — no findFirst step needed)
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledOnce();
      const call = mockPrisma.refreshToken.deleteMany.mock.calls[0][0];
      expect(call.where).toHaveProperty('token');
      expect(typeof call.where.token).toBe('string');
    });

    it('should NOT throw if row not found', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.revokeToken('missing'.padEnd(128, 'x'))).resolves.not.toThrow();
    });
  });

  describe('revokeAllSessions', () => {
    it('should delete all RefreshToken rows for userId', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      const count = await service.revokeAllSessions('user-1');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(count).toBe(3);
    });

    it('should return 0 if no sessions exist', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const count = await service.revokeAllSessions('user-with-no-sessions');
      expect(count).toBe(0);
    });
  });
});
