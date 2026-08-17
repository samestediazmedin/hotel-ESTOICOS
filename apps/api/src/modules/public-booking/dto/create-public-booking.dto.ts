import { z } from 'zod';

/**
 * CreatePublicBookingSchema — Zod v4 validation for the public booking form.
 *
 * Zod v4 notes:
 * - No invalid_type_error options (removed in v4 — use .message() if needed)
 * - .issues (not .errors) on ZodError
 */
export const CreatePublicBookingSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(5).max(40),
  documentType: z.enum(['CC', 'CE', 'PASSPORT', 'TI', 'NIT']),
  documentNumber: z.string().min(3).max(40),
  nationality: z.string().length(2),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be YYYY-MM-DD'),
  /**
   * roomId — OPTIONAL on public bookings. The public flow is 'request to book' by
   * room TYPE; the admin (recepción) assigns a specific physical room at check-in.
   * Kept here so internal pipelines that DO know the room (e.g. walk-in via public API
   * shim) can still pass it; left undefined for the standard public form submission.
   */
  roomId: z.string().cuid().optional(),
  roomTypeId: z.string().cuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be YYYY-MM-DD'),
  adults: z.number().int().min(1).max(10),
  // Phase 15 — Extended contact capture (GCC-03)
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
  /**
   * sourceOfferId (2026-05-28) — set when the guest clicked "Reservar" on a
   * published Offer on the public homepage. The admin sees this in the
   * reservation drawer so the call/WhatsApp follow-up has full context.
   * Optional; reservations created from the generic booking widget leave it null.
   */
  sourceOfferId: z.string().cuid().nullable().optional(),
  /**
   * ratePlanId (2026-05-29) — the rate plan (BAR / PROMO / PACKAGE) chosen by
   * the guest on the rate-selector step. Optional — when absent, the service
   * defaults to BAR (backward compatible with the flat-price flow).
   * Validated server-side: must belong to dto.roomTypeId and be active.
   */
  ratePlanId: z.string().cuid().nullable().optional(),
}).refine(
  (data) => data.checkOut > data.checkIn,
  {
    message: 'La fecha de salida debe ser posterior a la de entrada (mínimo 1 noche)',
    path: ['checkOut'],
  },
);

export type CreatePublicBookingDto = z.infer<typeof CreatePublicBookingSchema>;
