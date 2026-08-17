import {
  IsString,
  IsDateString,
  IsNumber,
  Min,
  Max,
  IsOptional,
  Matches,
} from 'class-validator';

/**
 * CUID format: lowercase `c` followed by 24 base-36 chars (25 chars total).
 * The project uses Prisma's default @id @default(cuid()) — NOT UUIDs.
 * Bug history (2026-05-28): @IsUUID rejected legitimate CUIDs with HTTP 400.
 */
const CUID_REGEX = /^c[0-9a-z]{24}$/;

export class CreateSeasonDto {
  // 2026-05-29 — changed from ratePlanId to roomTypeId.
  // Seasons are now a property of the room type, shared by all its rate plans.
  @IsString()
  @Matches(CUID_REGEX, { message: 'roomTypeId must be a valid CUID' })
  declare roomTypeId: string;

  @IsString()
  declare name: string;  // HIGH | MID | LOW convention — free text in v1

  @IsDateString()
  declare startDate: string;  // "2026-06-01" ISO date string

  @IsDateString()
  declare endDate: string;    // must be after startDate (validated in service)

  @IsNumber()
  @Min(0.1)
  @Max(5.0)
  declare multiplier: number;  // e.g. 1.25 for +25%, 0.85 for -15%

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  declare minNights?: number;  // default 1
}
