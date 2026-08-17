import { z } from 'zod';

/**
 * DateRangeSchema — Zod v4 schema for GET /api/reports/daily-snapshots query params.
 *
 * Both dates must be YYYY-MM-DD strings.
 * startDate must be <= endDate (chronological order).
 *
 * Uses Zod v4 .issues convention (NOT .errors).
 */
export const DateRangeSchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: 'startDate must be <= endDate',
  });

export type DateRangeDto = z.infer<typeof DateRangeSchema>;
