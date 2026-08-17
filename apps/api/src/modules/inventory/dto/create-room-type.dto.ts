import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
  MinLength,
  IsPositive,
} from 'class-validator';

export class CreateRoomTypeDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  /** Base price in COP — stored as Decimal(12,2) */
  @IsNumber()
  @IsPositive()
  declare basePrice: number;

  @IsNumber()
  @Min(1)
  declare maxOccupancy: number;

  @IsArray()
  @IsString({ each: true })
  declare amenities: string[];
}
