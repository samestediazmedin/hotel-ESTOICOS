import { z } from 'zod';

/**
 * HotelInfoSchema — mirror of backend UpdateSystemConfigSchema.
 *
 * Used with zodResolver in HotelInfoForm. All fields match the
 * PATCH /api/system-config contract from Plan 13-01.
 *
 * Notes:
 * - name + address are REQUIRED in the form (Zod min) even though the backend
 *   PATCH schema marks them optional (partial-update tolerance).
 * - phone accepts empty string (form clears → send as undefined via transform).
 * - tags: array of 2-40 char strings, max 8 entries.
 */
export const HotelInfoSchema = z.object({
  name: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  address: z
    .string()
    .min(5, 'Mínimo 5 caracteres')
    .max(200, 'Máximo 200 caracteres'),
  tagline: z.string().max(120, 'Máximo 120 caracteres').optional().default(''),
  description: z
    .string()
    .max(2000, 'Máximo 2000 caracteres')
    .optional()
    .default(''),
  phone: z
    .string()
    .regex(/^\+?[\d\s()+-]{7,20}$/, 'Formato de teléfono inválido')
    .or(z.literal(''))
    .optional()
    .default(''),
  tags: z
    .array(z.string().min(2).max(40))
    .max(8, 'Máximo 8 etiquetas')
    .default([]),
  // 2026-05-29 — admin toggle: show IVA-inclusive prices on the public homepage
  displayPricesWithIva: z.boolean().default(true),
});

export type HotelInfoFormInput = z.input<typeof HotelInfoSchema>;
export type HotelInfoFormData = z.output<typeof HotelInfoSchema>;

/** Backend response shape — matches GET /api/system-config and PATCH return. */
export interface AdminSystemConfig {
  name: string;
  address: string;
  tagline: string;
  description: string;
  phone: string;
  tags: string[];
  // 2026-05-29 — present after migration is deployed; default true matches schema.
  displayPricesWithIva: boolean;
}
