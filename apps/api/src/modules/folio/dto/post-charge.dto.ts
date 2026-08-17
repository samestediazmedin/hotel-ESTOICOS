import { z } from 'zod';

/**
 * PostChargeSchema — Zod v4 schema for manual folio charges.
 *
 * Zod v4 breaking changes applied:
 * - NO invalid_type_error on z.number() (removed in v4)
 * - Use .issues not .errors for Zod v4 error access
 */
export const PostChargeSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().min(0).max(1).default(0.19),
});

export type PostChargeDto = z.infer<typeof PostChargeSchema>;
