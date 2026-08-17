import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function createMockContext(user: any, roles?: string[]) {
  const mockReflector = {
    getAllAndOverride: vi.fn().mockReturnValue(roles),
  } as unknown as Reflector;

  const ctx = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue({ user }),
    }),
  } as any;

  return { guard: new RolesGuard(mockReflector), ctx };
}

describe('RolesGuard', () => {
  describe('canActivate', () => {
    it('should return true when no @Roles() metadata is set', () => {
      const { guard, ctx } = createMockContext({ id: 'u1', role: 'RECEPTION' }, undefined);

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should return true when empty roles array', () => {
      const { guard, ctx } = createMockContext({ id: 'u1', role: 'RECEPTION' }, []);

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should return true when user role matches required role', () => {
      const { guard, ctx } = createMockContext({ id: 'u1', role: 'ADMIN' }, ['ADMIN']);

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should return true when user role is in a multi-role list', () => {
      const { guard, ctx } = createMockContext(
        { id: 'u1', role: 'MANAGER' },
        ['ADMIN', 'MANAGER'],
      );

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should return false when user role does NOT match required role', () => {
      const { guard, ctx } = createMockContext({ id: 'u1', role: 'RECEPTION' }, ['ADMIN']);

      const result = guard.canActivate(ctx);

      expect(result).toBe(false);
    });

    it('should return false when req.user is undefined', () => {
      const { guard, ctx } = createMockContext(undefined, ['ADMIN']);

      const result = guard.canActivate(ctx);

      expect(result).toBe(false);
    });

    it('should return false when req.user is null', () => {
      const { guard, ctx } = createMockContext(null, ['ADMIN']);

      const result = guard.canActivate(ctx);

      expect(result).toBe(false);
    });

    it('should use ROLES_KEY for reflector lookup', () => {
      const mockReflector = {
        getAllAndOverride: vi.fn().mockReturnValue(['ADMIN']),
      } as unknown as Reflector;

      const guard = new RolesGuard(mockReflector);
      const ctx = {
        getHandler: vi.fn().mockReturnValue('handler'),
        getClass: vi.fn().mockReturnValue('class'),
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({ user: { role: 'ADMIN' } }),
        }),
      } as any;

      guard.canActivate(ctx);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        'handler',
        'class',
      ]);
    });
  });
});
