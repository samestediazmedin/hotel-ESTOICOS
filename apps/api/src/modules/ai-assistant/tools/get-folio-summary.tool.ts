import { z } from 'zod';
import type { GetFolioSummaryOutputDto } from '../dto/tool-output.dto';
import type { ToolDeps, UserContext } from '../tool-registry';

export const GetFolioSummarySchema = z.object({
  reservationId: z.string().cuid(),
});

export type GetFolioSummaryInput = z.infer<typeof GetFolioSummarySchema>;

export async function getFolioSummaryHandler(
  input: GetFolioSummaryInput,
  _userCtx: UserContext,
  deps: ToolDeps,
): Promise<GetFolioSummaryOutputDto> {
  return deps.folio.getFolioSummaryForAI(input.reservationId);
}
