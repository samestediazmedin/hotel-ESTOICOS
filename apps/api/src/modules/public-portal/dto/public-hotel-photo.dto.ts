import { z } from 'zod';

/**
 * PublicHotelPhotoSchema — response shape for each item in GET /api/public/hotel-photos.
 *
 * Pure response DTO (no request body validation — GET endpoint).
 *
 * Phase 12 notes:
 * - `url` is stored verbatim in the hotel_photos table (full URL — Unsplash seed for v1.2).
 *   Phase 13 may migrate to key-based R2 storage (technical debt documented in RESEARCH.md Q2).
 * - `displayOrder` is used for sorting (ASC) in the service query.
 */
export const PublicHotelPhotoSchema = z.object({
  url: z.string(),
  alt: z.string(),
  displayOrder: z.number().int(),
});

export type PublicHotelPhotoDto = z.infer<typeof PublicHotelPhotoSchema>;
