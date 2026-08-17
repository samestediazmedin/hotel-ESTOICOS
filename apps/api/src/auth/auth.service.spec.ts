import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

// Mocks
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
};

const mockTokenService = {
  createTokenPair: vi.fn(),
  revokeToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  rotateRefreshTokenWithUserId: vi.fn(),
};

const mockLoginAttemptService = {
  validateAttempt: vi.fn(),
  recordFailure: vi.fn(),
  clearAttempts: vi.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockPrisma as any,
      mockTokenService as any,
      mockLoginAttemptService as any,
    );
  });

  describe('login', () => {
    it('should return accessToken and rawRefreshToken on valid credentials', async () => {
      const passwordHash = await bcrypt.hash('Password1', 10);
      mockLoginAttemptService.validateAttempt.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@hotel.com',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        mustChangePassword: false,
      });
      mockLoginAttemptService.clearAttempts.mockResolvedValue(undefined);
      mockTokenService.createTokenPair.mockResolvedValue({
        accessToken: 'access-tok',
        rawRefreshToken: 'refresh-tok',
      });

      const result = await service.login('admin@hotel.com', 'Password1', '127.0.0.1');

      expect(result.accessToken).toBe('access-tok');
      expect(result.rawRefreshToken).toBe('refresh-tok');
    });

    it('should call validateAttempt BEFORE checking credentials', async () => {
      const callOrder: string[] = [];
      mockLoginAttemptService.validateAttempt.mockImplementation(() => {
        callOrder.push('validate');
        return Promise.resolve();
      });
      const passwordHash = await bcrypt.hash('Password1', 10);
      mockPrisma.user.findUnique.mockImplementation(() => {
        callOrder.push('findUser');
        return Promise.resolve({
          id: 'u1',
          email: 'admin@hotel.com',
          passwordHash,
          isActive: true,
          mustChangePassword: false,
          role: 'ADMIN',
        });
      });
      mockLoginAttemptService.clearAttempts.mockResolvedValue(undefined);
      mockTokenService.createTokenPair.mockResolvedValue({
        accessToken: 'tok',
        rawRefreshToken: 'rtok',
      });

      await service.login('admin@hotel.com', 'Password1', '127.0.0.1');

      expect(callOrder[0]).toBe('validate');
      expect(callOrder[1]).toBe('findUser');
    });

    it('should throw UnauthorizedException with generic message for wrong password', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass1', 10);
      mockLoginAttemptService.validateAttempt.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@hotel.com',
        passwordHash,
        isActive: true,
        mustChangePassword: false,
        role: 'RECEPTION',
      });
      mockLoginAttemptService.recordFailure.mockResolvedValue(undefined);

      await expect(
        service.login('user@hotel.com', 'WrongPass', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should call recordFailure on wrong password before throwing', async () => {
      const passwordHash = await bcrypt.hash('CorrectPass1', 10);
      mockLoginAttemptService.validateAttempt.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@hotel.com',
        passwordHash,
        isActive: true,
        mustChangePassword: false,
        role: 'RECEPTION',
      });
      mockLoginAttemptService.recordFailure.mockResolvedValue(undefined);

      try {
        await service.login('user@hotel.com', 'WrongPass', '127.0.0.1');
      } catch {}

      expect(mockLoginAttemptService.recordFailure).toHaveBeenCalledWith(
        'user@hotel.com',
        '127.0.0.1',
      );
    });

    it('should throw UnauthorizedException for unknown email (same generic message)', async () => {
      mockLoginAttemptService.validateAttempt.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockLoginAttemptService.recordFailure.mockResolvedValue(undefined);

      await expect(
        service.login('unknown@hotel.com', 'AnyPass1', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should record failure for unknown email (no enumeration — same flow)', async () => {
      mockLoginAttemptService.validateAttempt.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockLoginAttemptService.recordFailure.mockResolvedValue(undefined);

      try {
        await service.login('unknown@hotel.com', 'AnyPass1', '127.0.0.1');
      } catch {}

      expect(mockLoginAttemptService.recordFailure).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for inactive user (same generic message)', async () => {
      const passwordHash = await bcrypt.hash('Password1', 10);
      mockLoginAttemptService.validateAttempt.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'inactive@hotel.com',
        passwordHash,
        isActive: false,
        mustChangePassword: false,
        role: 'RECEPTION',
      });
      mockLoginAttemptService.recordFailure.mockResolvedValue(undefined);

      await expect(
        service.login('inactive@hotel.com', 'Password1', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should NOT call clearAttempts for inactive user', async () => {
      const passwordHash = await bcrypt.hash('Password1', 10);
      mockLoginAttemptService.validateAttempt.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'inactive@hotel.com',
        passwordHash,
        isActive: false,
        mustChangePassword: false,
        role: 'RECEPTION',
      });
      mockLoginAttemptService.recordFailure.mockResolvedValue(undefined);

      try {
        await service.login('inactive@hotel.com', 'Password1', '127.0.0.1');
      } catch {}

      expect(mockLoginAttemptService.clearAttempts).not.toHaveBeenCalled();
    });

    it('should include mustChangePassword in response when true', async () => {
      const passwordHash = await bcrypt.hash('TempPass1', 10);
      mockLoginAttemptService.validateAttempt.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'new@hotel.com',
        passwordHash,
        isActive: true,
        mustChangePassword: true,
        role: 'RECEPTION',
      });
      mockLoginAttemptService.clearAttempts.mockResolvedValue(undefined);
      mockTokenService.createTokenPair.mockResolvedValue({
        accessToken: 'tok',
        rawRefreshToken: 'rtok',
      });

      const result = await service.login('new@hotel.com', 'TempPass1', '127.0.0.1');

      expect(result.mustChangePassword).toBe(true);
    });

    it('should throw error from validateAttempt (429 propagates)', async () => {
      const { HttpException } = await import('@nestjs/common');
      mockLoginAttemptService.validateAttempt.mockRejectedValue(
        new HttpException('Too many requests', 429),
      );

      await expect(
        service.login('blocked@hotel.com', 'AnyPass', '127.0.0.1'),
      ).rejects.toThrow();
    });
  });

  describe('refresh', () => {
    it('should rotate the refresh token, fetch the user, and echo it in the response (2026-05-28 sidebar role fix)', async () => {
      mockTokenService.rotateRefreshTokenWithUserId.mockResolvedValue({
        tokenPair: { accessToken: 'new-access', rawRefreshToken: 'new-raw' },
        userId: 'user-1',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'admin@hotel.com',
        name: 'Admin',
        role: 'ADMIN',
        isActive: true,
      });

      const result = await service.refresh('old-raw-token');

      expect(mockTokenService.rotateRefreshTokenWithUserId).toHaveBeenCalledWith('old-raw-token');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { id: true, email: true, name: true, role: true, isActive: true },
      });
      expect(result.accessToken).toBe('new-access');
      expect(result.user).toMatchObject({ id: 'user-1', email: 'admin@hotel.com', role: 'ADMIN' });
    });

    it('should reject with 401 when the user has been deactivated since last login', async () => {
      mockTokenService.rotateRefreshTokenWithUserId.mockResolvedValue({
        tokenPair: { accessToken: 'new-access', rawRefreshToken: 'new-raw' },
        userId: 'user-1',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'a@b.co', name: 'A', role: 'ADMIN', isActive: false,
      });
      await expect(service.refresh('old')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delegate to tokenService.revokeToken', async () => {
      mockTokenService.revokeToken.mockResolvedValue(undefined);

      await service.logout('raw-token-to-revoke');

      expect(mockTokenService.revokeToken).toHaveBeenCalledWith('raw-token-to-revoke');
    });
  });
});
