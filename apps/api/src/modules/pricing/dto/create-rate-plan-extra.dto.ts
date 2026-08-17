import {
  IsString,
  IsIn,
  IsNumber,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';

const PRICING_MODES = ['PER_STAY', 'PER_NIGHT', 'PER_PERSON_PER_NIGHT'] as const;

export class CreateRatePlanExtraDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  declare name: string;

  /**
   * Amount in COP — positive number.
   * Prisma stores it as Decimal(10,2) but we accept a plain number at the HTTP
   * boundary and let Prisma coerce it.
   */
  @IsNumber()
  @Min(0.01, { message: 'amount must be positive' })
  declare amount: number;

  @IsIn(PRICING_MODES, {
    message: `pricingMode must be one of: ${PRICING_MODES.join(', ')}`,
  })
  declare pricingMode: string;
}
