import { z } from 'zod';
import type { GetCheckoutsTodayOutputDto } from '../dto/tool-output.dto';
import type { ToolDeps, UserContext } from '../tool-registry';

export const NoInputSchema = z.object({});
export type NoInput = z.infer<typeof NoInputSchema>;

const MAX_CHECKOUTS = 50;

export async function getCheckoutsTodayHandler(
  _input: NoInput,
  _userCtx: UserContext,
  deps: ToolDeps,
): Promise<GetCheckoutsTodayOutputDto> {
  const allCheckouts = await deps.reservations.findCheckoutsTodayForAI();

  const truncated = allCheckouts.length > MAX_CHECKOUTS;
  const checkouts = allCheckouts.slice(0, MAX_CHECKOUTS);

  return { checkouts, truncated, total: allCheckouts.length };
}
