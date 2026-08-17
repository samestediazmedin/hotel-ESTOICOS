import { z } from 'zod';
import { CUID_REGEX } from './create-offer.dto';

/**
 * UpdateOfferSchema — partial update for PATCH /api/admin/offers/:id.
 * All fields optional. Date strings accepted as YYYY-MM-DD or explicit null
 * to clear. `imageKey` must match the storage filename pattern.
 *
 * `roomTypeId` accepts:
 *   - a valid CUID string → links the offer to that room type
 *   - null or "" (empty string) → clears the association (hotel-wide offer)
 *   - undefined → field not sent, no change
 */
export const UpdateOfferSchema = z
  .object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    imageKey: z
      .string()
      .min(1)
      .max(300)
      .regex(
        /^[a-zA-Z0-9_.-]+\.jpg$/,
        'imageKey must be a sanitised storage filename ending in .jpg',
      )
      .optional(),
    badge: z.string().max(40).nullable().optional(),
    validFrom: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
      .optional(),
    validTo: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
      .optional(),
    ctaText: z.string().max(60).nullable().optional(),
    ctaLink: z.string().max(300).nullable().optional(),
    isActive: z
      .union([z.boolean(), z.string().transform((s) => s === 'true' || s === '1')])
      .optional(),
    // Empty string "" is treated as null (clears the association) — multipart forms
    // serialize empty selects as "". CUID_REGEX check is only applied when non-empty.
    roomTypeId: z
      .union([
        z.string().regex(CUID_REGEX, 'roomTypeId must be a valid CUID'),
        z.string().length(0).transform(() => null),
        z.null(),
      ])
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateOfferDto = z.infer<typeof UpdateOfferSchema>;
