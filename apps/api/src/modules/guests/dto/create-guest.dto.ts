import { z } from 'zod';
import { PipeTransform, BadRequestException } from '@nestjs/common';

/**
 * CreateGuestSchema — Zod v4 schema for guest creation.
 *
 * Conventions (Phase 02-01):
 *  - NO `invalid_type_error` on z.number() — use .message or omit (Zod v4 breaking change)
 *  - nationality is ISO-3166-1 alpha-2 (2 uppercase letters)
 *  - dateOfBirth is YYYY-MM-DD string (serialized as UTC midnight by service)
 */
export const CreateGuestSchema = z.object({
  fullName: z.string().min(2, 'Nombre mínimo 2 caracteres').max(120, 'Nombre máximo 120 caracteres'),
  email: z.string().email('Email inválido').nullable().optional(),
  phone: z.string().nullable().optional(),
  documentType: z.enum(['CC', 'CE', 'PASSPORT', 'TI', 'NIT'], {
    message: 'Tipo de documento inválido',
  }),
  documentNumber: z.string().min(3, 'Documento mínimo 3 caracteres').max(40, 'Documento máximo 40 caracteres'),
  nationality: z.string().length(2, 'Nacionalidad debe ser código ISO-2 (ej: CO, US)'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de nacimiento debe ser YYYY-MM-DD'),
  // Phase 15 — Extended contact capture (GCC-01, GCC-02)
  preferredLanguage: z.enum(['es', 'en']).optional().default('es'),
  contactPreference: z.enum(['EMAIL', 'PHONE', 'WHATSAPP']).nullable().optional(),
  whatsappNumber: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, 'WhatsApp debe ser formato E.164 (ej: +573001234567)')
    .nullable()
    .optional(),
  marketingConsent: z.boolean().optional().default(false),
  dietaryRestrictions: z.string().max(500, 'Máximo 500 caracteres').nullable().optional(),
  specialRequests: z.string().max(1000, 'Máximo 1000 caracteres').nullable().optional(),
});

export type CreateGuestDto = z.infer<typeof CreateGuestSchema>;

/**
 * CreateGuestPipe — NestJS pipe that validates the request body
 * against CreateGuestSchema. Returns the typed DTO or throws 400.
 */
export class CreateGuestPipe implements PipeTransform {
  transform(value: unknown): CreateGuestDto {
    const result = CreateGuestSchema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }
    return result.data;
  }
}
