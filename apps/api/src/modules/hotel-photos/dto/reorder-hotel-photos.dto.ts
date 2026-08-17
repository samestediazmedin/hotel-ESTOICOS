import { z } from 'zod';

export const ReorderHotelPhotosSchema = z.object({
  photoIds: z.array(z.string().min(1)).min(1).max(50),
});

export type ReorderHotelPhotosDto = z.infer<typeof ReorderHotelPhotosSchema>;
