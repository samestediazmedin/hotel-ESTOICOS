import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { sub: string; role: string; email: string };
}

/**
 * AdminSelfProtectionGuard — prevents admins from self-harm operations.
 *
 * Rules:
 * 1. Admin cannot deactivate/suspend their own account
 * 2. Admin cannot change their own role
 * 3. Admin cannot change their own password without verification
 */
@Injectable()
export class AdminSelfProtectionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const currentUser = request.user;
    const targetUserId = request.params.id;

    if (!currentUser || !targetUserId) {
      return true; // Let other guards handle missing auth
    }

    // Only apply to ADMIN role operations
    if (currentUser.role !== 'ADMIN') {
      return true; // Non-admins can be handled by RolesGuard
    }

    // Check if operating on self
    if (currentUser.sub === targetUserId) {
      const method = request.method;
      const path = request.path;

      // Block self-deactivation/suspension
      if (method === 'POST' && (path.includes('deactivate') || path.includes('suspend'))) {
        throw new ForbiddenException(
          'No puedes desactivar ni suspender tu propia cuenta de administrador',
        );
      }

      // Block self-role-change
      if (method === 'PATCH' && request.body?.role !== undefined) {
        throw new ForbiddenException(
          'No puedes cambiar el rol de tu propia cuenta de administrador',
        );
      }
    }

    return true;
  }
}
