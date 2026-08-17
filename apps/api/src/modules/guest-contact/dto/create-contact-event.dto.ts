import { z } from 'zod';
import { PipeTransform, BadRequestException } from '@nestjs/common';

/**
 * CreateContactEventSchema — Zod v4 schema for logging a guest contact event.
 *
 * - method: enum (CALL | WHATSAPP | EMAIL) — required
 * - notes: optional free-text, max 500 chars (VarChar(500) in DB)
 */
export const CreateContactEventSchema = z.object({
  method: z.enum(['CALL', 'WHATSAPP', 'EMAIL'], {
    message: 'method debe ser CALL, WHATSAPP o EMAIL',
  }),
  notes: z.string().max(500, 'notes máximo 500 caracteres').optional(),
});

export type CreateContactEventDto = z.infer<typeof CreateContactEventSchema>;

/**
 * CreateContactEventPipe — NestJS pipe that validates the request body
 * against CreateContactEventSchema. Returns the typed DTO or throws 400.
 */
export class CreateContactEventPipe implements PipeTransform {
  transform(value: unknown): CreateContactEventDto {
    const result = CreateContactEventSchema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }
    return result.data;
  }
}

/**
 * ListContactEventsQuerySchema — query params for GET /api/guests/:id/contact-events
 *
 * - limit: 1..50, default 5
 */
export const ListContactEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
});

export type ListContactEventsQueryDto = z.infer<typeof ListContactEventsQuerySchema>;
