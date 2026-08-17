import { api } from '@/lib/api';
import type { ContactMethod, GuestContactEventDto } from './types';

/**
 * Input shape for creating a contact event.
 * 'notes' is intentionally omitted in v1.3 — the UI exposes only the method button.
 * The field is available here for future "manual log" feature (v1.4).
 */
export interface CreateContactEventInput {
  method: ContactMethod;
  notes?: string;
}

/**
 * POST /api/guests/:id/contact-events
 *
 * Records that the current staff user initiated contact via the given method.
 * Returns the persisted event with staffUser joined.
 * The backend Socket.io gateway also emits 'contact-event.created' to room
 * guest:{guestId} so other open sessions update in real-time.
 */
export async function createContactEvent(
  guestId: string,
  input: CreateContactEventInput,
): Promise<GuestContactEventDto> {
  const res = await api.post<GuestContactEventDto>(
    `/guests/${guestId}/contact-events`,
    input,
  );
  return res.data;
}

/**
 * GET /api/guests/:id/contact-events?limit=N
 *
 * Returns the N most recent contact events for the given guest, ordered DESC.
 * Default limit is 5. Backend clamps to max 50.
 */
export async function listContactEvents(
  guestId: string,
  limit = 5,
): Promise<GuestContactEventDto[]> {
  const res = await api.get<GuestContactEventDto[]>(
    `/guests/${guestId}/contact-events`,
    { params: { limit } },
  );
  return res.data;
}
