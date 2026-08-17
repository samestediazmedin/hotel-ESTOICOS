import { z } from 'zod';
import { CreateGuestSchema } from './create-guest.dto';
import { PipeTransform, BadRequestException } from '@nestjs/common';

/**
 * UpdateGuestSchema — partial of CreateGuestSchema.
 * All fields optional — service only updates fields that are present.
 */
export const UpdateGuestSchema = CreateGuestSchema.partial();

export type UpdateGuestDto = z.infer<typeof UpdateGuestSchema>;

export class UpdateGuestPipe implements PipeTransform {
  transform(value: unknown): UpdateGuestDto {
    const result = UpdateGuestSchema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }
    return result.data;
  }
}
