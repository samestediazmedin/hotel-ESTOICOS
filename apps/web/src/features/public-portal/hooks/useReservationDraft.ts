import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

export interface ReservationDraft {
  checkIn: string | null;
  checkOut: string | null;
  adults: number;
  /**
   * 2026-05-28 — offer id carried over from the homepage offer cards
   * (link `/booking?offer=<id>`). Propagated through every wizard step so
   * the final POST /api/public/bookings can stamp `sourceOfferId` on the
   * PENDING reservation.
   */
  offer: string | null;
}

export function useReservationDraft() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const draft: ReservationDraft = useMemo(
    () => ({
      checkIn: params.get('checkIn'),
      checkOut: params.get('checkOut'),
      adults: parseInt(params.get('adults') ?? '2', 10),
      offer: params.get('offer'),
    }),
    [params],
  );

  const setDates = useCallback(
    (checkIn: string | null, checkOut: string | null) => {
      const next = new URLSearchParams(params);
      if (checkIn) next.set('checkIn', checkIn);
      else next.delete('checkIn');
      if (checkOut) next.set('checkOut', checkOut);
      else next.delete('checkOut');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const setAdults = useCallback(
    (adults: number) => {
      const clamped = Math.max(1, Math.min(10, adults));
      const next = new URLSearchParams(params);
      next.set('adults', String(clamped));
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const canCommit = Boolean(
    draft.checkIn &&
    draft.checkOut &&
    draft.checkOut > draft.checkIn &&
    draft.adults >= 1,
  );

  const commit = useCallback(() => {
    if (!canCommit) return;
    // Always include offer in the navigation when set so the booking flow can
    // attribute the resulting reservation to the originating offer.
    const offerSuffix = draft.offer ? `&offer=${encodeURIComponent(draft.offer)}` : '';
    navigate(
      `/booking/rooms?checkIn=${draft.checkIn}&checkOut=${draft.checkOut}&adults=${draft.adults}${offerSuffix}`,
    );
  }, [canCommit, draft, navigate]);

  return { draft, setDates, setAdults, commit, canCommit };
}
