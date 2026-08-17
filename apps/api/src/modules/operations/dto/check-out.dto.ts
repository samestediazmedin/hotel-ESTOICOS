import { z } from 'zod';

/**
 * CheckOutDto — parameters for the check-out operation.
 * reservationId comes from URL param, userId from JWT token.
 * Body is intentionally empty — check-out is a command, not a data payload.
 */
export const CheckOutSchema = z.object({});

export type CheckOutDto = z.infer<typeof CheckOutSchema>;
