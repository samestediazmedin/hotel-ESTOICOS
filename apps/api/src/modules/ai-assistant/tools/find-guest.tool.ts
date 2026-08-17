import { z } from 'zod';
import type { FindGuestOutputDto } from '../dto/tool-output.dto';
import type { ToolDeps, UserContext } from '../tool-registry';

export const FindGuestSchema = z.object({
  query: z.string().min(1).max(256),
});

export type FindGuestInput = z.infer<typeof FindGuestSchema>;

const MAX_GUESTS = 10;

export async function findGuestHandler(
  input: FindGuestInput,
  _userCtx: UserContext,
  deps: ToolDeps,
): Promise<FindGuestOutputDto> {
  // Apply input sanitization before passing to service (AI-07)
  const sanitizedQuery = deps.sanitize(input.query);

  const allGuests = await deps.guests.searchByNameForAI(sanitizedQuery);

  const truncated = allGuests.length > MAX_GUESTS;
  const guests = allGuests.slice(0, MAX_GUESTS).map((g) => ({
    id: g.id,
    fullName: g.fullName,
    nationality: g.nationality,
    totalStays: g.totalStays,
    // documentNumber intentionally ABSENT — AI-06 + AI research §4
  }));

  return { guests, truncated, total: allGuests.length };
}
