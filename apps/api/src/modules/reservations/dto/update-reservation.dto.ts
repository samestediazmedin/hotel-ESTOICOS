import { z } from 'zod';
import { PipeTransform, BadRequestException } from '@nestjs/common';
import { CreateReservationSchema } from './create-reservation.dto';

/**
 * UpdateReservationSchema — partial of CreateReservationSchema.
 * All fields optional — only provided fields are updated.
 * Modification only allowed when status IN ('PENDING', 'CONFIRMED') — service enforces this.
 */
export const UpdateReservationSchema = CreateReservationSchema.partial();

export type UpdateReservationDto = z.infer<typeof UpdateReservationSchema>;

/**
 * UpdateReservationPipe — NestJS pipe for partial reservation updates.
 */
export class UpdateReservationPipe implements PipeTransform {
  transform(value: unknown): UpdateReservationDto {
    const result = UpdateReservationSchema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }
    return result.data;
  }
}
