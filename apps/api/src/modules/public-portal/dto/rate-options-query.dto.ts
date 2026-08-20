import { z } from 'zod';

/**
 * Query params for GET /api/public/rate-options
 *
 * All params come in as strings (HTTP query). Zod coerces adults to a number.
 * Dates are validated as YYYY-MM-DD strings and parsed to UTC midnight by the service.
 */
export const RateOptionsQuerySchema = z.object({
  roomTypeId: z.string().cuid({ message: 'roomTypeId must be a valid CUID' }),
  checkIn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be YYYY-MM-DD'),
  checkOut: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be YYYY-MM-DD'),
  adults: z
    .string()
    .optional()
    .default('1')
    .transform((v) => {
      const n = Number.parseInt(v, 10);
      return Number.isNaN(n) ? 1 : n;
    })
    .pipe(z.number().int().min(1).max(20)),
}).refine(
  (data) => data.checkOut > data.checkIn,
  {
    message: 'checkOut must be after checkIn (minimum 1 night)',
    path: ['checkOut'],
  },
);

export type RateOptionsQueryDto = z.infer<typeof RateOptionsQuerySchema>;
