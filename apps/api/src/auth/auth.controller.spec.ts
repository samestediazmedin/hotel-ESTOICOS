import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService, type LoginResult, type RefreshResult } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: {
    login: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(() => {
    mockAuthService = {
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    };

    mockResponse = {
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
    };

    mockRequest = {
      ip: '127.0.0.1',
      cookies: {},
    };

    controller = new AuthController(mockAuthService as unknown as AuthService);
  });

  describe('POST /api/auth/login', () => {
    it('should return accessToken and user on valid credentials and set refreshToken cookie', async () => {
      const loginResult: LoginResult = {
        accessToken: 'access-token-123',
        rawRefreshToken: 'raw-refresh-token-456',
        user: {
          id: 'user-1',
          email: 'admin@hotel.com',
          name: 'Administrador',
          role: 'ADMIN',
        },
      };
      mockAuthService.login.mockResolvedValue(loginResult);

      const dto = { email: 'admin@hotel.com', password: 'admin123' };
      const result = await controller.login(dto, mockRequest, mockResponse);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        'admin@hotel.com',
        'admin123',
        '127.0.0.1',
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'raw-refresh-token-456',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000,
        }),
      );
      expect(result).toEqual({
        accessToken: 'access-token-123',
        user: loginResult.user,
      });
    });

    it('should include mustChangePassword flag when required', async () => {
      const loginResult: LoginResult = {
        accessToken: 'access-token',
        rawRefreshToken: 'raw-refresh',
        user: {
          id: 'user-2',
          email: 'new@hotel.com',
          name: 'New User',
          role: 'RECEPTION',
        },
        mustChangePassword: true,
      };
      mockAuthService.login.mockResolvedValue(loginResult);

      const dto = { email: 'new@hotel.com', password: 'temp12345' };
      const result = await controller.login(dto, mockRequest, mockResponse);

      expect(result.mustChangePassword).toBe(true);
    });

    it('should propagate UnauthorizedException for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Credenciales incorrectas'),
      );

      const dto = { email: 'bad@hotel.com', password: 'wrongpass' };
      await expect(controller.login(dto, mockRequest, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return new accessToken and set new refreshToken cookie', async () => {
      mockRequest.cookies = { refreshToken: 'old-raw-token' };
      mockAuthService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
        rawRefreshToken: 'new-raw-refresh',
        user: {
          id: 'user-1',
          email: 'admin@hotel.com',
          name: 'Administrador',
          role: 'ADMIN',
        },
      } as RefreshResult);

      const result = await controller.refresh(mockRequest, mockResponse);

      expect(mockAuthService.refresh).toHaveBeenCalledWith('old-raw-token');
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-raw-refresh',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(result.accessToken).toBe('new-access-token');
      expect(result.user.role).toBe('ADMIN');
    });

    it('should throw UnauthorizedException when refresh cookie is missing', async () => {
      mockRequest.cookies = {};

      await expect(controller.refresh(mockRequest, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockAuthService.refresh).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should revoke refresh token and clear cookie', async () => {
      mockRequest.cookies = { refreshToken: 'raw-token-to-revoke' };
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(mockRequest, mockResponse);

      expect(mockAuthService.logout).toHaveBeenCalledWith('raw-token-to-revoke');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(result).toEqual({});
    });

    it('should clear cookie even when no refresh token exists', async () => {
      mockRequest.cookies = {};
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(mockRequest, mockResponse);

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(result).toEqual({});
    });
  });
});
