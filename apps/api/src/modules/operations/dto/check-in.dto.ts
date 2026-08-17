import { z } from 'zod';

/**
 * CheckInDto — parameters for the check-in operation.
 * reservationId comes from URL param, userId from JWT token.
 * Body is intentionally empty — check-in is a command, not a data payload.
 */
export const CheckInSchema = z.object({});

export type CheckInDto = z.infer<typeof CheckInSchema>;
