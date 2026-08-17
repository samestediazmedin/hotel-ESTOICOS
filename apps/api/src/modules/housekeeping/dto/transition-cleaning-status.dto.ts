import { z } from 'zod';
import type { CleaningStatus } from '../../../generated/prisma/client';

export const TransitionCleaningStatusSchema = z.object({
  next: z.enum(['DIRTY', 'IN_PROGRESS', 'INSPECTION', 'CLEAN']),
});

export type TransitionCleaningStatusDto = {
  next: CleaningStatus;
};
