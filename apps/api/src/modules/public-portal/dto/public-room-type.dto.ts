import { z } from 'zod';

/**
 * PublicRoomTypePhotoSchema — embedded photo shape within a public room type.
 *
 * For RoomPhoto: URL is derived at service layer as `${R2_PUBLIC_URL}/${photo.key}`.
 * `alt` is derived from the RoomType name (no alt column on RoomPhoto).
 */
export const PublicRoomTypePhotoSchema = z.object({
  url: z.string(),
  alt: z.string(),
});

export type PublicRoomTypePhotoDto = z.infer<typeof PublicRoomTypePhotoSchema>;

/**
 * PublicRoomTypeSchema — response shape for each item in GET /api/public/room-types.
 *
 * Pure response DTO (no request body validation — GET endpoint).
 *
 * Phase 12 notes:
 * - `capacity` is mapped from `RoomType.maxOccupancy` (integer)
 * - `basePrice` is Number(RoomType.basePrice) to convert from Prisma Decimal
 * - `badge` is computed in service: index 0 → "Más económica", index 1 → "Mejor valor", rest → null
 * - `photos` are sourced from the first active room of the type (rooms[0].photos), max 3
 */
export const PublicRoomTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  capacity: z.number().int(),
  description: z.string(),
  basePrice: z.number(),
  photos: z.array(PublicRoomTypePhotoSchema),
  badge: z.union([z.literal('Más económica'), z.literal('Mejor valor'), z.null()]),
});

export type PublicRoomTypeDto = z.infer<typeof PublicRoomTypeSchema>;
