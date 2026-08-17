import { z } from 'zod';

export const ReorderOffersSchema = z.object({
  offerIds: z.array(z.string().min(1)).min(1).max(100),
});

export type ReorderOffersDto = z.infer<typeof ReorderOffersSchema>;
