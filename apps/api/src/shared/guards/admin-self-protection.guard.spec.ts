import { describe, it, expect, beforeEach } from 'vitest';
import { AdminSelfProtectionGuard } from './admin-self-protection.guard';
import { ExecutionContext } from '@nestjs/common';

describe('AdminSelfProtectionGuard', () => {
  let guard: AdminSelfProtectionGuard;

  beforeEach(() => {
    guard = new AdminSelfProtectionGuard();
  });

  const createMockContext = (user: any, params: any, method: string, path: string, body?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
          method,
          path,
          body,
        }),
      }),
    } as ExecutionContext;
  };

  describe('non-admin users', () => {
    it('should allow non-admin to deactivate self', () => {
      const context = createMockContext(
        { sub: 'user-123', role: 'RECEPTION' },
        { id: 'user-123' },
        'POST',
        '/api/users/user-123/deactivate',
      );

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('admin self-protection', () => {
    it('should block admin self-deactivation', () => {
      const context = createMockContext(
        { sub: 'admin-123', role: 'ADMIN' },
        { id: 'admin-123' },
        'POST',
        '/api/users/admin-123/deactivate',
      );

      expect(() => guard.canActivate(context)).toThrow(
        'No puedes desactivar ni suspender tu propia cuenta de administrador',
      );
    });

    it('should block admin self-suspension', () => {
      const context = createMockContext(
        { sub: 'admin-123', role: 'ADMIN' },
        { id: 'admin-123' },
        'POST',
        '/api/users/admin-123/suspend',
      );

      expect(() => guard.canActivate(context)).toThrow(
        'No puedes desactivar ni suspender tu propia cuenta de administrador',
      );
    });

    it('should allow admin self-activation', () => {
      const context = createMockContext(
        { sub: 'admin-123', role: 'ADMIN' },
        { id: 'admin-123' },
        'POST',
        '/api/users/admin-123/activate',
      );

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should block admin self-role-change', () => {
      const context = createMockContext(
        { sub: 'admin-123', role: 'ADMIN' },
        { id: 'admin-123' },
        'PATCH',
        '/api/users/admin-123',
        { role: 'MANAGER' },
      );

      expect(() => guard.canActivate(context)).toThrow(
        'No puedes cambiar el rol de tu propia cuenta de administrador',
      );
    });

    it('should allow admin to update self without role change', () => {
      const context = createMockContext(
        { sub: 'admin-123', role: 'ADMIN' },
        { id: 'admin-123' },
        'PATCH',
        '/api/users/admin-123',
        { name: 'Updated Name' },
      );

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow admin to operate on other users', () => {
      const context = createMockContext(
        { sub: 'admin-123', role: 'ADMIN' },
        { id: 'other-user' },
        'POST',
        '/api/users/other-user/deactivate',
      );

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('missing auth', () => {
    it('should pass through when no user (let other guards handle)', () => {
      const context = createMockContext(
        undefined,
        { id: 'user-123' },
        'POST',
        '/api/users/user-123/deactivate',
      );

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should pass through when no target id', () => {
      const context = createMockContext(
        { sub: 'admin-123', role: 'ADMIN' },
        {},
        'POST',
        '/api/users/deactivate',
      );

      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
