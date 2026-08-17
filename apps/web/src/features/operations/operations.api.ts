import { api } from '@/lib/api';

/**
 * operations.api.ts — check-in / check-out API calls.
 *
 * Uses the shared axios instance from lib/api.ts (same auth + interceptors).
 */

/**
 * checkInReservation — POST /api/operations/reservations/:id/check-in
 *
 * Returns the created Stay and opened Folio.
 * Throws on 412 (cleaningStatus not CLEAN/INSPECTION) — caller must handle.
 */
export async function checkInReservation(id: string) {
  const { data } = await api.post<{ reservationId: string; stay: object; folio: object }>(
    `/operations/reservations/${id}/check-in`,
  );
  return data;
}

/**
 * checkOutReservation — POST /api/operations/reservations/:id/check-out
 *
 * Returns the closed Folio (with snapshotHash).
 */
export async function checkOutReservation(id: string) {
  const { data } = await api.post<{ reservationId: string; folio: object }>(
    `/operations/reservations/${id}/check-out`,
  );
  return data;
}
