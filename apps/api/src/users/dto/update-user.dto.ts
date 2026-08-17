import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// PartialType makes all fields optional.
// OmitType removes password — admins cannot change passwords via PATCH /users/:id
// Use POST /users/:id/reset-password instead (D-17).
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {}
