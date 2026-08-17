import { z } from 'zod';

export const submitReviewSchema = z.object({
  token: z.string().min(20),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(2000),
});

export type SubmitReviewDto = z.infer<typeof submitReviewSchema>;
