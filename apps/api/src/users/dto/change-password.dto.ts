import { IsString, IsOptional, MinLength, Matches } from 'class-validator';

/**
 * ChangePasswordDto — Secure password change with admin verification.
 *
 * For regular users: admin can change directly with tempPassword.
 * For admin users: requires currentPassword verification or 2FA.
 */
export class ChangePasswordDto {
  @IsString()
  @IsOptional()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  tempPassword?: string;

  @IsString()
  @IsOptional()
  currentPassword?: string; // Required when changing admin password

  @IsString()
  @IsOptional()
  verificationPin?: string; // 2FA/PIN for admin changes
}

/**
 * AdminPasswordPolicy — stricter password requirements for admins.
 */
export function validateAdminPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 10) {
    errors.push('Mínimo 10 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Al menos una mayúscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Al menos una minúscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Al menos un número');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Al menos un carácter especial');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Regular password policy for non-admin users.
 */
export function validateRegularPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Mínimo 8 caracteres');
  }

  return { valid: errors.length === 0, errors };
}
