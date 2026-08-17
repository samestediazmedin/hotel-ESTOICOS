import { z } from 'zod';

export const UpdateTaskStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']),
});

export type UpdateTaskStatusDto = z.infer<typeof UpdateTaskStatusSchema>;
