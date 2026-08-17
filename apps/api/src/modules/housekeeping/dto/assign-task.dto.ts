import { z } from 'zod';

export const AssignTaskSchema = z.object({
  roomId: z.string().min(1),
  assignedToId: z.string().min(1).nullable().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  notes: z.string().max(500).optional(),
});

export type AssignTaskDto = z.infer<typeof AssignTaskSchema>;
