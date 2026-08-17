import { z } from 'zod';

export const moderateReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

export type ModerateReviewDto = z.infer<typeof moderateReviewSchema>;
