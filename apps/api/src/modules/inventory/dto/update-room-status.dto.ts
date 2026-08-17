import { IsEnum, IsOptional } from 'class-validator';
import {
  PhysicalStatus,
  CleaningStatus,
} from '../../../generated/prisma/client';

/**
 * UpdateRoomStatusDto — update physical and/or cleaning status independently.
 *
 * CRITICAL: Both fields are optional. The service updates ONLY the field(s)
 * present in the payload. NEVER couples them — updating physicalStatus must
 * NEVER change cleaningStatus and vice versa.
 */
export class UpdateRoomStatusDto {
  @IsOptional()
  @IsEnum(PhysicalStatus)
  declare physicalStatus?: PhysicalStatus;

  @IsOptional()
  @IsEnum(CleaningStatus)
  declare cleaningStatus?: CleaningStatus;
}
