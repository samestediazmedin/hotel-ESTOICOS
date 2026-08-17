import { z } from 'zod';

/**
 * PublicHotelInfoSchema — response shape for GET /api/public/hotel-info.
 *
 * Pure response DTO (no request body validation — GET endpoint).
 * Used for TypeScript type safety in the service return signature.
 *
 * Phase 12 notes:
 * - `address` is hardcoded placeholder ("La Candelaria, Bogotá") — no DB column.
 *   Phase 13 will add the column to system_config.
 * - `rating` and `reviewCount` are hardcoded constants for v1.2.
 *   Real aggregate values come from Phase 14 (reviews table).
 */
export const PublicHotelInfoSchema = z.object({
  name: z.string(),
  address: z.string(),
  tagline: z.string(),
  description: z.string(),
  phone: z.string(),
  rating: z.number(),
  reviewCount: z.number(),
  tags: z.array(z.string()),
  // 2026-05-29 — IVA display fields.
  // displayPricesWithIva: when true the public homepage renders base * (1 + ivaRate).
  // ivaRate: MUST be serialized as Number() — Prisma Decimal serializes as string over HTTP.
  displayPricesWithIva: z.boolean(),
  ivaRate: z.number(),
});

export type PublicHotelInfoDto = z.infer<typeof PublicHotelInfoSchema>;
