import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { LastContactEventSummary } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuestResponseDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: string;
  documentNumber: string; // decrypted — only for ADMIN/MANAGER/RECEPTION
  nationality: string;
  dateOfBirth: string; // "YYYY-MM-DD"
  anonymizedAt: string | null;
  createdAt: string;
  /** Last contact event summary — null if guest has never been contacted (16-02) */
  lastContactEvent: LastContactEventSummary | null;
}

export interface GuestPublicDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: string;
  // documentNumber is absent for HOUSEKEEPING role
  nationality: string;
  dateOfBirth: string;
  anonymizedAt: string | null;
  createdAt: string;
  /** Last contact event summary — null if guest has never been contacted (16-02) */
  lastContactEvent: LastContactEventSummary | null;
}

export type AnyGuestDto = GuestResponseDto | GuestPublicDto;

export interface GuestHistoryDto {
  guest: GuestResponseDto;
  reservations: ReservationHistoryItem[];
  totalNights: number;
  totalSpent: number;
}

export interface ReservationHistoryItem {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  totalNights: number;
  totalPrice?: number;
}

export interface CreateGuestPayload {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  documentType: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: string; // "YYYY-MM-DD"
}

// ─── Query Keys ───────────────────────────────────────────────────────────────
// Prefixed with ['staff','guests',...] to avoid collision with public availability
// queries (Pitfall P14 — TanStack Query key collision prevention)

const guestKeys = {
  all: ['staff', 'guests'] as const,
  list: (search?: string) => ['staff', 'guests', { search }] as const,
  detail: (id: string) => ['staff', 'guests', id] as const,
  history: (id: string) => ['staff', 'guests', id, 'history'] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** GET /api/guests?search=... */
export function useGuests(search?: string) {
  return useQuery<AnyGuestDto[]>({
    queryKey: guestKeys.list(search),
    queryFn: () =>
      api
        .get<AnyGuestDto[]>('/guests', { params: { search } })
        .then((r) => r.data),
  });
}

/** GET /api/guests/:id */
export function useGuest(id: string | null) {
  return useQuery<AnyGuestDto>({
    queryKey: guestKeys.detail(id!),
    queryFn: () => api.get<AnyGuestDto>(`/guests/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

/** GET /api/guests/:id/history */
export function useGuestHistory(id: string | null) {
  return useQuery<GuestHistoryDto>({
    queryKey: guestKeys.history(id!),
    queryFn: () =>
      api.get<GuestHistoryDto>(`/guests/${id}/history`).then((r) => r.data),
    enabled: !!id,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** POST /api/guests */
export function useCreateGuest() {
  const queryClient = useQueryClient();
  return useMutation<GuestResponseDto, Error, CreateGuestPayload>({
    mutationFn: (data) =>
      api.post<GuestResponseDto>('/guests', data).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: guestKeys.all });
    },
  });
}

/** PATCH /api/guests/:id */
export function useUpdateGuest(id: string) {
  const queryClient = useQueryClient();
  return useMutation<GuestResponseDto, Error, Partial<CreateGuestPayload>>({
    mutationFn: (data) =>
      api.patch<GuestResponseDto>(`/guests/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: guestKeys.all });
      void queryClient.invalidateQueries({ queryKey: guestKeys.detail(id) });
    },
  });
}

/** POST /api/guests/:id/anonymize */
export function useAnonymizeGuest(id: string) {
  const queryClient = useQueryClient();
  return useMutation<{ anonymizedAt: string | null }, Error, void>({
    mutationFn: () =>
      api
        .post<{ anonymizedAt: string | null }>(`/guests/${id}/anonymize`)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: guestKeys.all });
      void queryClient.invalidateQueries({ queryKey: guestKeys.detail(id) });
    },
  });
}

/** DELETE /api/guests/:id — hard-delete a guest (ADMIN only, no reservations) */
export function useDeleteGuest(id: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => api.delete(`/guests/${id}`).then(() => undefined),
    onSuccess: () => {
      // El huésped ya no existe: invalidar SOLO las queries de lista
      // (3er elemento del key es el objeto { search }). NO invalidar
      // detail/history de este id — provocaría un refetch que devuelve 404.
      // GuestDetailPage navega a /guests en onSuccess, así que esas queries
      // se desmontan solas.
      void queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === 'staff' &&
          q.queryKey[1] === 'guests' &&
          typeof q.queryKey[2] === 'object' &&
          q.queryKey[2] !== null,
      });
    },
  });
}
