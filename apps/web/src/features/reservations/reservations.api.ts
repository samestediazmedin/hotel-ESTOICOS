import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PricingBreakdown } from '@/features/pricing/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

export type ReservationSource = 'DIRECT' | 'WALK_IN' | 'OTA_FUTURE';

export interface ReservationResponseDto {
  id: string;
  checkInDate: string;   // "YYYY-MM-DD"
  checkOutDate: string;  // "YYYY-MM-DD"
  status: ReservationStatus;
  source: ReservationSource;
  adults: number;
  children?: number;
  totalNights: number;
  notes?: string | null;
  guestId: string;
  guest: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    documentType: string;
    documentNumber?: string;
    nationality: string;
    dateOfBirth: string;
  };
  // 2026-05-27 — PENDING reservations (public request-to-book) carry no roomId
  // until the admin assigns one at check-in. The shape is therefore optional.
  roomId: string | null;
  room: {
    id: string;
    number: string;
    floor: number;
    roomTypeId: string;
    roomType: { id: string; name: string; basePrice: number };
  } | null;
  roomTypeId: string;
  createdAt: string;
  // 2026-05-28 — Offer attribution: PUBLIC bookings created via a homepage
  // offer card carry the offer id and a minimal embed (id, title, badge) so the
  // drawer can show "Vino por: <offer.title>". Null for staff / walk-in / generic
  // public bookings.
  sourceOfferId?: string | null;
  sourceOffer?: { id: string; title: string; badge: string | null } | null;
}

export interface AvailableRoomDto {
  id: string;
  number: string;
  floor: number;
  roomTypeId: string;
  roomType: { id: string; name: string; basePrice: number };
  photos: Array<{ id: string; r2Key: string; signedUrl?: string }>;
  pricing: PricingBreakdown;
}

export interface AvailabilityResponseDto {
  rooms: AvailableRoomDto[];
}

export interface CreateReservationPayload {
  guestId: string;
  /** Optional. When null/undefined, the reservation is created as a PENDING request
   *  without a physical room — the admin assigns it later (at check-in or via PATCH). */
  roomId?: string | null;
  roomTypeId: string;
  checkInDate: string;   // "YYYY-MM-DD"
  checkOutDate: string;  // "YYYY-MM-DD"
  source: ReservationSource;
  adults: number;
  children?: number;
  notes?: string | null;
  status?: ReservationStatus;
}

export interface UpdateReservationPayload {
  checkInDate?: string;
  checkOutDate?: string;
  /** Pass null explicitly to unassign the physical room (revert to type-only). */
  roomId?: string | null;
  roomTypeId?: string;
  adults?: number;
  children?: number;
  notes?: string | null;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────
// Prefixed ['staff','reservations',...] per Pitfall P14 namespace requirement.

const reservationKeys = {
  all: ['staff', 'reservations'] as const,
  list: (params: { from: string; to: string }) =>
    ['staff', 'reservations', params] as const,
  detail: (id: string) => ['staff', 'reservations', id] as const,
  availability: (params: { checkIn: string; checkOut: string; adults: number }) =>
    ['staff', 'availability', params] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** GET /api/reservations?from=YYYY-MM-DD&to=YYYY-MM-DD */
export function useReservations({ from, to }: { from: string; to: string }) {
  return useQuery<ReservationResponseDto[]>({
    queryKey: reservationKeys.list({ from, to }),
    queryFn: () =>
      api
        .get<ReservationResponseDto[]>('/reservations', {
          params: { from, to },
        })
        .then((r) => r.data),
  });
}

/** GET /api/reservations/:id */
export function useReservation(id: string | null) {
  return useQuery<ReservationResponseDto>({
    queryKey: reservationKeys.detail(id!),
    queryFn: () =>
      api
        .get<ReservationResponseDto>(`/reservations/${id}`)
        .then((r) => r.data),
    enabled: !!id,
  });
}

/** GET /api/reservations/availability?checkIn=&checkOut=&adults= */
export function useAvailability(
  params: { checkIn: string; checkOut: string; adults: number },
  options?: { enabled?: boolean },
) {
  return useQuery<AvailabilityResponseDto>({
    queryKey: reservationKeys.availability(params),
    queryFn: () =>
      api
        .get<AvailabilityResponseDto>('/reservations/availability', {
          params,
        })
        .then((r) => r.data),
    enabled: options?.enabled ?? (!!params.checkIn && !!params.checkOut),
  });
}

/** GET /api/inventory/rooms — for room rack (all rooms, not filtered by availability) */
export function useAllRooms() {
  return useQuery<
    Array<{
      id: string;
      number: string;
      floor: number;
      roomTypeId: string;
      roomType: { id: string; name: string; basePrice: number };
      isActive: boolean;
    }>
  >({
    queryKey: ['staff', 'rooms', 'all'],
    queryFn: () =>
      api.get('/inventory/rooms').then((r) => r.data),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** POST /api/reservations */
export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation<ReservationResponseDto, Error, CreateReservationPayload>({
    mutationFn: (data) =>
      api.post<ReservationResponseDto>('/reservations', data).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['staff', 'reservations'],
      });
    },
  });
}

/** PATCH /api/reservations/:id */
export function useUpdateReservation(id: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ReservationResponseDto,
    Error,
    UpdateReservationPayload
  >({
    mutationFn: (data) =>
      api
        .patch<ReservationResponseDto>(`/reservations/${id}`, data)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['staff', 'reservations'],
      });
      void queryClient.invalidateQueries({
        queryKey: reservationKeys.detail(id),
      });
    },
  });
}

// ─── Move mutation (OBS-005 drag-to-move) ─────────────────────────────────────

export interface MoveReservationVars {
  id: string;
  checkInDate: string;   // "YYYY-MM-DD"
  checkOutDate: string;  // "YYYY-MM-DD"
  /**
   * New room assignment. Provided when a cross-row drag moves the reservation
   * to a different room. Omit (or leave undefined) for same-room date-only moves.
   * Extension A (OBS-005): backend PATCH /reservations/:id already accepts roomId
   * and the exclusion constraint will reject overlaps in the target room (409).
   */
  roomId?: string | null;
}

/**
 * useMoveReservation — PATCH /api/reservations/:id with new dates.
 *
 * Optimistic update: immediately repositions the chip in the rack calendar.
 * On error: reverts to the snapshot and shows a toast message.
 * On success: invalidates the reservations list query.
 *
 * The mutation is ID-less at the hook level (id comes in via MoveReservationVars)
 * so it can be instantiated once in ReservationsPage and reused for any reservation.
 */
export function useMoveReservation() {
  const queryClient = useQueryClient();

  return useMutation<ReservationResponseDto, Error, MoveReservationVars>({
    mutationFn: ({ id, checkInDate, checkOutDate, roomId }) => {
      // Only include roomId in the PATCH body when it is explicitly provided.
      // Sending undefined would be stripped by JSON serialisation anyway, but
      // being explicit keeps the intent clear and avoids a needless null write.
      const body: Record<string, unknown> = { checkInDate, checkOutDate };
      if (roomId !== undefined) {
        body.roomId = roomId;
      }
      return api
        .patch<ReservationResponseDto>(`/reservations/${id}`, body)
        .then((r) => r.data);
    },

    onMutate: async ({ id, checkInDate, checkOutDate, roomId }) => {
      // Cancel any in-flight refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: ['staff', 'reservations'] });

      // Snapshot all matching list query caches
      const snapshots = queryClient.getQueriesData<ReservationResponseDto[]>({
        queryKey: ['staff', 'reservations'],
      });

      // Optimistically update every cached list that contains this reservation.
      // When roomId is provided (cross-room drag), update it in the cache so the
      // chip immediately appears under the new room row and disappears from the old one.
      queryClient.setQueriesData<ReservationResponseDto[]>(
        { queryKey: ['staff', 'reservations'] },
        (old) => {
          if (!old) return old;
          return old.map((r) => {
            if (r.id !== id) return r;
            const updated: ReservationResponseDto = {
              ...r,
              checkInDate,
              checkOutDate,
              totalNights:
                Math.round(
                  (new Date(checkOutDate + 'T00:00:00.000Z').getTime() -
                    new Date(checkInDate + 'T00:00:00.000Z').getTime()) /
                    86_400_000,
                ),
            };
            // Only overwrite roomId / room when the caller explicitly passes a new roomId.
            // Undefined means "same room — no change".
            if (roomId !== undefined) {
              updated.roomId = roomId;
              // Clear the room relation — it will be repopulated by the invalidation
              // refetch that fires in onSuccess. The chip will briefly show without a
              // room number until the server confirms; that is acceptable.
              updated.room = null;
            }
            return updated;
          });
        },
      );

      return { snapshots };
    },

    onError: (_err, _vars, context) => {
      // Revert to pre-optimistic snapshot
      const ctx = context as
        | { snapshots: [unknown, ReservationResponseDto[] | undefined][] }
        | undefined;
      if (ctx?.snapshots) {
        for (const [queryKey, data] of ctx.snapshots) {
          queryClient.setQueryData(queryKey as Parameters<typeof queryClient.setQueryData>[0], data);
        }
      }
    },

    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'reservations'] });
      void queryClient.invalidateQueries({ queryKey: reservationKeys.detail(id) });
    },
  });
}

/** POST /api/reservations/:id/cancel */
export function useCancelReservation(id: string) {
  const queryClient = useQueryClient();
  return useMutation<ReservationResponseDto, Error, void>({
    mutationFn: () =>
      api
        .post<ReservationResponseDto>(`/reservations/${id}/cancel`)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['staff', 'reservations'],
      });
      void queryClient.invalidateQueries({
        queryKey: reservationKeys.detail(id),
      });
    },
  });
}


// ─── Request-to-book lifecycle (2026-05-27) ───────────────────────────────────

/** POST /api/reservations/:id/confirm — admin approves a PENDING request */
export function useConfirmReservationRequest(id: string) {
  const queryClient = useQueryClient();
  return useMutation<ReservationResponseDto, Error, void>({
    mutationFn: () =>
      api
        .post<ReservationResponseDto>(`/reservations/${id}/confirm`)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'reservations'] });
      void queryClient.invalidateQueries({ queryKey: reservationKeys.detail(id) });
    },
  });
}

/** POST /api/reservations/:id/reject — admin rejects a PENDING request (optional reason) */
export function useRejectReservationRequest(id: string) {
  const queryClient = useQueryClient();
  return useMutation<ReservationResponseDto, Error, { reason?: string } | undefined>({
    mutationFn: (vars) =>
      api
        .post<ReservationResponseDto>(`/reservations/${id}/reject`, vars ?? {})
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'reservations'] });
      void queryClient.invalidateQueries({ queryKey: reservationKeys.detail(id) });
    },
  });
}


/** POST /api/reservations/:id/reactivate — restore CANCELLED back to PENDING */
export function useReactivateReservation(id: string) {
  const queryClient = useQueryClient();
  return useMutation<ReservationResponseDto, Error, void>({
    mutationFn: () =>
      api
        .post<ReservationResponseDto>(`/reservations/${id}/reactivate`)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'reservations'] });
      void queryClient.invalidateQueries({ queryKey: reservationKeys.detail(id) });
    },
  });
}
