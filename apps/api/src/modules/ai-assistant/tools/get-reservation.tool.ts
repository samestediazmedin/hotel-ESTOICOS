import { z } from 'zod';
import { NotFoundException } from '@nestjs/common';
import type { GetReservationOutputDto } from '../dto/tool-output.dto';
import type { ToolDeps, UserContext } from '../tool-registry';

export const GetReservationSchema = z
  .object({
    id: z.string().cuid().optional(),
    confirmationCode: z.string().max(50).optional(),
  })
  .refine((d) => d.id || d.confirmationCode, {
    message: 'Either id or confirmationCode is required',
  });

export type GetReservationInput = z.infer<typeof GetReservationSchema>;

export async function getReservationHandler(
  input: GetReservationInput,
  _userCtx: UserContext,
  deps: ToolDeps,
): Promise<GetReservationOutputDto> {
  // Use id if provided, otherwise use confirmationCode as a fallback ID lookup
  const idOrCode = input.id ?? input.confirmationCode!;

  const reservation = await deps.reservations.findByIdForAI(idOrCode);
  if (!reservation) {
    throw new NotFoundException(`Reservation not found: ${idOrCode}`);
  }

  return reservation;
}
