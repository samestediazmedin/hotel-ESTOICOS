/**
 * ReservationWidget — sticky sidebar (desktop) + fixed bottom bar (mobile).
 *
 * Single React component, two layout variants driven by the `variant` prop.
 * Same URL-backed state (useReservationDraft) is shared between both variants
 * when mounted simultaneously — both read from and write to the same URL params.
 *
 * variant="desktop-sidebar" → rounded card, sticky in parent aside, numberOfMonths=2
 * variant="mobile-bar"      → fixed bottom bar, lg:hidden, iOS safe-area padding, numberOfMonths=1
 */
import { useState, useEffect, useRef } from 'react';
import type { DateRange } from 'react-day-picker';
import { Calendar, Minus, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReservationDraft } from '../hooks/useReservationDraft';
import { useRoomTypes } from '../hooks/useRoomTypes';
import { useHotelInfo } from '../hooks/useHotelInfo';
import { HOTEL_INFO_FALLBACK } from '../data/hotel';
import { ReservationDatePicker } from './ReservationDatePicker';
import { toLocalISODate, fromLocalISODate, formatShortDateEs } from '@/lib/date';
import { formatRoomPrice, formatCOPShort } from '../utils/displayPrice';
import { useReservationUiStore } from '../stores/reservationUiStore';

interface Props {
  variant: 'desktop-sidebar' | 'mobile-bar';
}

export function ReservationWidget({ variant }: Props) {
  const { draft, setDates, setAdults, commit, canCommit } = useReservationDraft();
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── Cross-component date-picker signal ──────────────────────────────────────
  // RoomTypeDetailDrawer calls requestDatePicker() after closing. This widget
  // reacts by opening its picker panel and scrolling itself into view so the
  // guest immediately sees the date selector without any extra taps/clicks.
  const widgetRef = useRef<HTMLDivElement>(null);
  const datePickerRequestedAt = useReservationUiStore((s) => s.datePickerRequestedAt);
  const clearDatePickerRequest = useReservationUiStore((s) => s.clear);

  useEffect(() => {
    if (datePickerRequestedAt === null) return;
    setPickerOpen(true);
    // Scroll the widget root into view so the picker is visible after the drawer
    // closes. Works for both variants: desktop-sidebar scrolls the sticky card
    // into view; mobile-bar is fixed so scrollIntoView is a no-op (still correct).
    widgetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    clearDatePickerRequest();
  }, [datePickerRequestedAt, clearDatePickerRequest]);

  // Phase 12: compute cheapest from TanStack Query data (placeholderData guarantees defined array)
  const roomsQuery = useRoomTypes();
  const rooms = roomsQuery.data ?? [];
  // Sort by basePrice and pick lowest; fallback to 0 so label stays coherent while loading
  const cheapestBasePrice = rooms.length > 0
    ? Math.min(...rooms.map((r) => r.basePrice))
    : 0;

  // 2026-05-29 — IVA display: TanStack deduplicates this query (HotelHomePage also calls it)
  const infoQuery = useHotelInfo();
  const ivaContext = infoQuery.data ?? HOTEL_INFO_FALLBACK;

  // Convert URL string params → DateRange for the picker
  const rangeForPicker: DateRange | undefined =
    draft.checkIn && draft.checkOut
      ? { from: fromLocalISODate(draft.checkIn), to: fromLocalISODate(draft.checkOut) }
      : draft.checkIn
        ? { from: fromLocalISODate(draft.checkIn), to: undefined }
        : undefined;

  const handlePickerChange = (range: DateRange | undefined) => {
    setDates(
      range?.from ? toLocalISODate(range.from) : null,
      range?.to ? toLocalISODate(range.to) : null,
    );
  };

  const checkInLabel = draft.checkIn
    ? formatShortDateEs(fromLocalISODate(draft.checkIn))
    : 'Llegada';
  const checkOutLabel = draft.checkOut
    ? formatShortDateEs(fromLocalISODate(draft.checkOut))
    : 'Salida';

  const { amount: cheapestDisplay, ivaIncluded: cheapestIvaIncluded } =
    cheapestBasePrice > 0
      ? formatRoomPrice(cheapestBasePrice, ivaContext)
      : { amount: 0, ivaIncluded: false };

  const priceLabel = cheapestBasePrice > 0
    ? `Desde ${formatCOPShort(cheapestDisplay)}`
    : 'Desde —';

  // ── Mobile bottom bar ────────────────────────────────────────────────
  if (variant === 'mobile-bar') {
    return (
      <div
        ref={widgetRef}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-warm-white border-t border-warm-line pb-[env(safe-area-inset-bottom)]"
        role="region"
        aria-label="Barra de reserva"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex-1 flex flex-col items-start text-left"
            aria-expanded={pickerOpen}
            aria-controls="mobile-picker-panel"
          >
            <span className="font-mono text-base text-ink-1">{priceLabel}</span>
            <span className="text-xs text-ink-3">
              {checkInLabel} — {checkOutLabel} · {draft.adults} adulto
              {draft.adults !== 1 ? 's' : ''}
            </span>
          </button>

          <Button variant="terracotta" disabled={!canCommit} onClick={commit}>
            Reservar
          </Button>
        </div>

        {pickerOpen && (
          <div
            id="mobile-picker-panel"
            className="border-t border-warm-line bg-warm-white p-4 max-h-[60vh] overflow-y-auto"
          >
            <ReservationDatePicker
              range={rangeForPicker}
              onChange={handlePickerChange}
              numberOfMonths={1}
            />
            <GuestCounter adults={draft.adults} onChange={setAdults} />
          </div>
        )}
      </div>
    );
  }

  // ── Desktop sidebar ──────────────────────────────────────────────────
  return (
    <div
      ref={widgetRef}
      className="rounded-2xl border border-warm-line bg-warm-white shadow-sm p-5 flex flex-col gap-4"
      role="region"
      aria-label="Widget de reserva"
    >
      {/* Price header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-mono text-2xl text-ink-1">{priceLabel}</span>
          {cheapestIvaIncluded && (
            <span className="text-[10px] text-ink-4 mt-0.5">IVA incluido</span>
          )}
        </div>
        <span className="text-xs text-ink-3 mt-1.5">/ noche</span>
      </div>

      {/* Date trigger + inline picker */}
      <div className="rounded-xl border border-warm-line overflow-hidden">
        <button type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="w-full grid grid-cols-2 divide-x divide-warm-line text-left"
          aria-expanded={pickerOpen}
          aria-controls="desktop-picker-panel"
        >
          <div className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-3">
              <Calendar className="w-3 h-3" />
              Llegada
            </div>
            <div className="text-sm text-ink-1 mt-1">{checkInLabel}</div>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-3">
              <Calendar className="w-3 h-3" />
              Salida
            </div>
            <div className="text-sm text-ink-1 mt-1">{checkOutLabel}</div>
          </div>
        </button>

        {pickerOpen && (
          <div id="desktop-picker-panel" className="border-t border-warm-line p-3">
            <ReservationDatePicker
              range={rangeForPicker}
              onChange={handlePickerChange}
              numberOfMonths={2}
            />
          </div>
        )}
      </div>

      {/* Guest counter */}
      <div className="rounded-xl border border-warm-line p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-3">
          <Users className="w-3 h-3" />
          Huéspedes
        </div>
        <GuestCounter adults={draft.adults} onChange={setAdults} />
      </div>

      {/* CTA */}
      <Button
        variant="terracotta"
        disabled={!canCommit}
        onClick={commit}
        className="w-full"
      >
        Reservar
      </Button>

      <p className="text-[11px] text-ink-3 text-center">Aún no se cobra nada</p>
    </div>
  );
}

// ── GuestCounter — shared between both variants ──────────────────────
interface GuestCounterProps {
  adults: number;
  onChange: (n: number) => void;
}

function GuestCounter({ adults, onChange }: GuestCounterProps) {
  return (
    <div className="flex items-center justify-between mt-1">
      <span className="text-sm text-ink-1">Adultos</span>
      <div className="flex items-center gap-3">
        <button type="button"
          onClick={() => onChange(adults - 1)}
          disabled={adults <= 1}
          className="h-8 w-8 rounded-full border border-warm-line-strong flex items-center justify-center text-ink-2 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Quitar adulto"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-sm w-4 text-center" aria-live="polite">
          {adults}
        </span>
        <button type="button"
          onClick={() => onChange(adults + 1)}
          disabled={adults >= 10}
          className="h-8 w-8 rounded-full border border-warm-line-strong flex items-center justify-center text-ink-2 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Agregar adulto"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
