/**
 * reservationUiStore — lightweight signal store for cross-component UI coordination.
 *
 * Purpose: when a guest closes the RoomTypeDetailDrawer via "Reservar", we need
 * the ReservationWidget (which lives in a completely different subtree) to open
 * its date picker and scroll into view. A zustand store is the cleanest mechanism
 * — no prop-drilling, no context re-renders, and the timestamp-as-counter trick
 * ensures the same action re-triggers even if called twice in a row.
 *
 * Contract:
 *   datePickerRequestedAt — null = no request pending; number = Date.now() of the
 *     last request. ReservationWidget reads this in a useEffect and opens its picker.
 *   requestDatePicker()   — set datePickerRequestedAt to Date.now().
 *   clear()               — reset to null after the widget has consumed the request,
 *                           so a remount doesn't re-open the picker spuriously.
 */
import { create } from 'zustand';

interface ReservationUiState {
  datePickerRequestedAt: number | null;
  requestDatePicker: () => void;
  clear: () => void;
}

export const useReservationUiStore = create<ReservationUiState>((set) => ({
  datePickerRequestedAt: null,
  requestDatePicker: () => set({ datePickerRequestedAt: Date.now() }),
  clear: () => set({ datePickerRequestedAt: null }),
}));
