import { z } from 'zod';
import { PipeTransform, BadRequestException } from '@nestjs/common';

/**
 * CreateReservationSchema — validates staff reservation creation payload.
 *
 * Locked decisions:
 * - roomId is REQUIRED (not optional, not nullable) — Locked Q1 from research.
 *   The Prisma column stays nullable for future type-level bookings, but the
 *   staff API ALWAYS requires a specific room assignment.
 * - source must be one of the three defined values (RES-07).
 * - Zod v4: no invalid_type_error on z.number() — use plain validators.
 */
export const CreateReservationSchema = z.object({
  guestId: z.string().cuid(),
  /**
   * roomId — OPTIONAL + NULLABLE. With the 2026-05-27 'request-to-book by type'
   * model the physical room is assigned at check-in (or anytime by the admin via
   * PATCH). Staff who already know the room can still provide it on create.
   * Passing null on PATCH explicitly UNASSIGNS the previously held room.
   */
  roomId: z.string().cuid().nullable().optional(),
  roomTypeId: z.string().cuid(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkInDate must be YYYY-MM-DD'),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOutDate must be YYYY-MM-DD'),
  source: z.enum(['DIRECT', 'WALK_IN', 'OTA_FUTURE']),
  adults: z.number().int().min(1).max(10),
  children: z.number().int().min(0).max(10).optional(),
  status: z.enum(['PENDING', 'CONFIRMED']).optional(), // staff defaults to CONFIRMED
  notes: z.string().max(1000).nullable().optional(),
});

export type CreateReservationDto = z.infer<typeof CreateReservationSchema>;

/**
 * CreateReservationPipe — NestJS pipe that validates the request body
 * against CreateReservationSchema. Returns the typed DTO or throws 400.
 */
export class CreateReservationPipe implements PipeTransform {
  transform(value: unknown): CreateReservationDto {
    const result = CreateReservationSchema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }
    return result.data;
  }
}
