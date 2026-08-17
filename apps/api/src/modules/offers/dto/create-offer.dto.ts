import { z } from 'zod';

/**
 * CUID_REGEX — matches the cuid() output from Prisma (starts with 'c',
 * followed by 24 lowercase alphanumeric chars, total 25 chars).
 * NEVER use @IsUUID() for Prisma ids — they are CUIDs, not UUIDs.
 */
export const CUID_REGEX = /^c[0-9a-z]{24}$/;

/**
 * CreateOfferSchema — admin-only payload for POST /api/admin/offers.
 *
 * 2026-05-28 — Filesystem-first storage: `imageKey` is now the bare filename
 * produced by StorageService (e.g. `offer_1735393856123_a1b2c3d4.jpg`). It is
 * set server-side from the uploaded multipart file before this schema runs,
 * so the field is REQUIRED but its format is the new filesystem pattern.
 *
 * Dates are accepted as YYYY-MM-DD strings; service converts to Date at midnight
 * UTC for the DATE column (no time component stored).
 *
 * `roomTypeId` — optional CUID. When set, the offer targets that specific room
 * type. The booking flow preselects + locks the type selector.
 */
export const CreateOfferSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(1000).nullable().optional(),
  imageKey: z
    .string()
    .min(1)
    .max(300)
    .regex(
      /^[a-zA-Z0-9_.-]+\.jpg$/,
      'imageKey must be a sanitised storage filename ending in .jpg',
    ),
  badge: z.string().max(40).nullable().optional(),
  validFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validFrom must be YYYY-MM-DD')
    .nullable()
    .optional(),
  validTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validTo must be YYYY-MM-DD')
    .nullable()
    .optional(),
  ctaText: z.string().max(60).nullable().optional(),
  ctaLink: z.string().max(300).nullable().optional(),
  isActive: z
    .union([z.boolean(), z.string().transform((s) => s === 'true' || s === '1')])
    .optional()
    .default(true),
  roomTypeId: z
    .string()
    .regex(CUID_REGEX, 'roomTypeId must be a valid CUID')
    .nullable()
    .optional(),
});

export type CreateOfferDto = z.infer<typeof CreateOfferSchema>;
