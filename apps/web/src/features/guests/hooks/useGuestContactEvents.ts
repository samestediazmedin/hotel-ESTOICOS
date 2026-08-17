import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/auth.store';
import { getOrCreateSocket } from '@/lib/socket';
import { listContactEvents } from '../guest-contact.api';
import type { ContactMethod, ContactEventSocketPayload, GuestContactEventDto } from '../types';

/**
 * Spanish labels for each ContactMethod.
 * Used in the remote-user toast message only.
 *
 * CRITICAL (research trap #6): the toast text uses `event.staffUserName` from
 * the Socket.io payload (DB-joined, authoritative), never `user?.name` from
 * the auth store (which may be undefined).
 */
const METHOD_LABEL: Record<ContactMethod, string> = {
  CALL: 'llamada',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'email',
};

/**
 * useGuestContactEvents(guestId)
 *
 * Combines TanStack Query (REST GET) with a Socket.io subscription to the
 * per-guest room so that all open detail-page sessions stay in sync.
 *
 * Behavior:
 * - Fetches the 5 most recent contact events via GET /api/guests/:id/contact-events
 * - On mount: emits 'join-room' for room `guest:{guestId}`
 * - On 'contact-event.created' socket event:
 *     • Always invalidates the TanStack Query cache (triggers refetch)
 *     • If the event was triggered by ANOTHER staff user → shows info toast
 *       with staffUserName from payload (not from auth store — trap #6)
 *     • If the event was triggered by SELF → silent invalidation only
 *       (the click handler already showed a success toast)
 * - On unmount or guestId change: emits 'leave-room' + removes listener
 *
 * Returns the raw TanStack Query result: { data, isPending, isError, refetch }
 *
 * Requirements: GCC-08 (frontend half), GCC-11
 */
export function useGuestContactEvents(guestId: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  // ── TanStack Query ──────────────────────────────────────────────────────────
  const query = useQuery<GuestContactEventDto[]>({
    queryKey: ['guest', guestId, 'contact-events'],
    queryFn: () => listContactEvents(guestId),
    staleTime: 0, // Always stale — Socket.io invalidation drives freshness
    enabled: !!guestId && !!accessToken,
  });

  // ── Socket.io subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken || !guestId) return;

    const socket = getOrCreateSocket(accessToken);
    const room = `guest:${guestId}`;

    socket.emit('join-room', room);

    const handleEvent = (event: ContactEventSocketPayload) => {
      // Always invalidate to keep the list fresh (for the triggering user too)
      void queryClient.invalidateQueries({ queryKey: ['guest', guestId, 'contact-events'] });

      // Only show remote toast if a DIFFERENT staff member triggered the event.
      // Self-toast is shown by the ContactButtons click handler (not here).
      // CRITICAL: use event.staffUserName from payload, NOT user?.name from store (trap #6)
      if (event.staffUserId !== user?.id) {
        toast.info(
          `${event.staffUserName} inició contacto por ${METHOD_LABEL[event.method] ?? event.method} con este huésped`,
        );
      }
    };

    socket.on('contact-event.created', handleEvent);

    return () => {
      socket.emit('leave-room', room);
      socket.off('contact-event.created', handleEvent);
    };
  }, [guestId, accessToken, queryClient, user?.id]);

  return query;
}
