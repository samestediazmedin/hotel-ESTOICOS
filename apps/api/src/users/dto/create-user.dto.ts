import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  declare email: string;

  @IsString()
  declare name: string;

  @IsString()
  @MinLength(8)
  declare password: string;

  @IsEnum(['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING'])
  declare role: string;
}
