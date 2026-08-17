import { z } from 'zod';

export const PublicAvailabilityQuerySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be YYYY-MM-DD'),
  adults: z.coerce.number().int().min(1).max(10),
});

export type PublicAvailabilityQueryDto = z.infer<typeof PublicAvailabilityQuerySchema>;
