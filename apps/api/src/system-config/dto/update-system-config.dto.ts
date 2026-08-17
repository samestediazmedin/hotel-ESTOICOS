import { z } from 'zod';

/**
 * UpdateSystemConfigSchema — Zod schema for PATCH /api/system-config.
 *
 * All fields optional (partial update). DTO field `name` maps to Prisma column
 * `hotelName` — the mapping happens in SystemConfigService.update(), not here.
 *
 * Tags: max 8 tags, each 2–40 chars. Tags are stored as a PostgreSQL TEXT[] array.
 * Phone: E.164-ish regex — accepts +57 300 123 4567, (601) 234-5678, etc.
 */
export const UpdateSystemConfigSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  address: z.string().min(5).max(200).optional(),
  tagline: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  phone: z
    .string()
    .regex(/^\+?[\d\s()+-]{7,20}$/, 'Invalid phone format')
    .optional()
    .nullable(),
  tags: z.array(z.string().min(2).max(40)).max(8).optional(),
  // 2026-05-29 — Controls public homepage IVA price display.
  // true  → show base * (1 + ivaRate) with "IVA incluido" note.
  // false → show bare base price.
  displayPricesWithIva: z.boolean().optional(),
});

export type UpdateSystemConfigDto = z.infer<typeof UpdateSystemConfigSchema>;
