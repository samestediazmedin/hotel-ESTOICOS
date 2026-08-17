import { IsString, IsNumber, IsOptional, MinLength, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(1)
  declare number: string;

  @IsNumber()
  @Min(1)
  declare floor: number;

  @IsString()
  @MinLength(1)
  declare roomTypeId: string;

  @IsOptional()
  @IsString()
  declare notes?: string;
}
