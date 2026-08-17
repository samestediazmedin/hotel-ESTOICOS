import { z } from 'zod';

/**
 * BackfillDto — validates date string for night audit backfill endpoint.
 *
 * Zod v4: uses .issues (not .errors) for error access.
 * No invalid_type_error (removed in Zod v4).
 */
export const BackfillSchema = z.object({
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'businessDate must be YYYY-MM-DD'),
});

export type BackfillDto = z.infer<typeof BackfillSchema>;
