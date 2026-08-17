import { z } from 'zod';
import type { GetCheckinsTodayOutputDto } from '../dto/tool-output.dto';
import type { ToolDeps, UserContext } from '../tool-registry';

export const NoInputSchema = z.object({});

export type NoInput = z.infer<typeof NoInputSchema>;

const MAX_CHECKINS = 50;

export async function getCheckinsTodayHandler(
  _input: NoInput,
  _userCtx: UserContext,
  deps: ToolDeps,
): Promise<GetCheckinsTodayOutputDto> {
  const allCheckins = await deps.reservations.findCheckinsTodayForAI();

  const truncated = allCheckins.length > MAX_CHECKINS;
  const checkins = allCheckins.slice(0, MAX_CHECKINS);

  return { checkins, truncated, total: allCheckins.length };
}
