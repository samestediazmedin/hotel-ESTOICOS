import { describe, it, expect, beforeEach } from 'vitest';
import { useReservationUiStore } from './reservationUiStore';

describe('useReservationUiStore', () => {
  beforeEach(() => {
    useReservationUiStore.setState({ datePickerRequestedAt: null });
  });

  it('initialises with datePickerRequestedAt as null', () => {
    expect(useReservationUiStore.getState().datePickerRequestedAt).toBeNull();
  });

  it('requestDatePicker() sets datePickerRequestedAt to a non-null timestamp', () => {
    const before = Date.now();
    useReservationUiStore.getState().requestDatePicker();
    const { datePickerRequestedAt } = useReservationUiStore.getState();
    expect(datePickerRequestedAt).not.toBeNull();
    expect(datePickerRequestedAt!).toBeGreaterThanOrEqual(before);
  });

  it('calling requestDatePicker() twice produces a newer or equal timestamp', () => {
    useReservationUiStore.getState().requestDatePicker();
    const first = useReservationUiStore.getState().datePickerRequestedAt!;
    useReservationUiStore.getState().requestDatePicker();
    const second = useReservationUiStore.getState().datePickerRequestedAt!;
    // Timestamp must advance or stay same (same-tick), but must differ from null
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it('clear() resets datePickerRequestedAt to null', () => {
    useReservationUiStore.getState().requestDatePicker();
    expect(useReservationUiStore.getState().datePickerRequestedAt).not.toBeNull();
    useReservationUiStore.getState().clear();
    expect(useReservationUiStore.getState().datePickerRequestedAt).toBeNull();
  });
});
