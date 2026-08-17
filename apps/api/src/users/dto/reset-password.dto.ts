import { IsString, MinLength } from 'class-validator';

/**
 * ResetPasswordDto — validates tempPassword for admin password reset.
 *
 * MEDIUM-3 fix: Previously accepted any string without validation.
 * Enforces minimum 8 characters, consistent with:
 * - CreateUserDto.password (@MinLength(8))
 * - seed-admin.command.ts (SEED_ADMIN_PASSWORD >= 8 chars)
 */
export class ResetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'La contraseña temporal debe tener al menos 8 caracteres' })
  declare tempPassword: string;
}
