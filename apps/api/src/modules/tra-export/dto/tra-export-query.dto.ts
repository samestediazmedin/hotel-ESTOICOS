import { z } from 'zod';

/**
 * TraExportQuerySchema — Zod v4 schema for the TRA export query parameters.
 *
 * from / to: ISO date strings in YYYY-MM-DD format.
 * Uses .issues (Zod v4) — NOT .errors.
 */
export const TraExportQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
});

export type TraExportQueryDto = z.infer<typeof TraExportQuerySchema>;
