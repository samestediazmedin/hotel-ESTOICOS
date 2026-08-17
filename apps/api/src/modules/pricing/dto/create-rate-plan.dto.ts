import {
  IsString,
  IsIn,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * CUID format: lowercase `c` followed by 24 base-36 chars (25 chars total).
 * The project uses Prisma's default @id @default(cuid()) — NOT UUIDs.
 * Bug history (2026-05-28): @IsUUID rejected legitimate CUIDs with HTTP 400.
 */
const CUID_REGEX = /^c[0-9a-z]{24}$/;

export class CreateRatePlanDto {
  @IsString()
  @MinLength(2)
  declare name: string;

  @IsIn(['BAR', 'PROMO', 'PACKAGE'])
  declare type: string;

  @IsString()
  @Matches(CUID_REGEX, { message: 'roomTypeId must be a valid CUID' })
  declare roomTypeId: string;

  @IsOptional()
  @IsBoolean()
  declare isActive?: boolean;

  /** Optional free-text description — max 500 chars. Shown to staff in the drawer. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare description?: string;

  /**
   * Per-plan price modifier applied on top of the room type's seasonal multiplier.
   * Formula: nightRate = round(basePrice × seasonMultiplier × priceModifier)
   * - 1.0 = no adjustment (standard BAR rate)
   * - < 1.0 = discount (e.g. 0.85 for PROMO plans)
   * - > 1.0 = premium (e.g. 1.1 for last-minute surcharge)
   * Minimum 0.01 to prevent zero/negative rates. Defaults to 1.0 when omitted.
   */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  declare priceModifier?: number;
}
