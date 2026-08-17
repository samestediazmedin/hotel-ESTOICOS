import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  declare email: string;

  @IsString()
  @MinLength(8) // D-15: 8 chars minimum
  declare password: string;
}
