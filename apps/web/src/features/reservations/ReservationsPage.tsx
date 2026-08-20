import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toLocalISODate } from '@/lib/date';
import { useReservations, useAllRooms, useMoveReservation } from './reservations.api';
import type { ReservationResponseDto } from './reservations.api';
import { RoomRackCalendar } from './RoomRackCalendar';
import type { MoveReservationArgs } from './RoomRackCalendar';
import { toast } from 'sonner';
import { useReservationWizardStore } from './store/reservation-wizard.store';
import { CheckInDrawer } from '@/features/operations/CheckInDrawer';
import { CheckOutConfirmDialog } from '@/features/operations/CheckOutConfirmDialog';

// ReservationWizard and ReservationDrawer are imported below
// (they depend on the store which is defined in a sibling file)
import { ReservationWizard } from './wizard/ReservationWizard';
import { ReservationDrawer } from './ReservationDrawer';

// ─── Date window helpers ──────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 30;
const NAV_STEP = 7; // days to shift per Anterior/Siguiente click

/**
 * ReservationsPage — room-rack calendar + wizard + drawer.
 *
 * Route: /reservations
 * Shows a 30-day window of room × date occupancy.
 * Navigation shifts the window by 7 days.
 */
export function ReservationsPage() {
  const [windowStart, setWindowStart] = useState<Date>(() =>
    startOfDay(new Date()),
  );
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null);

  // Check-in / Check-out drawer state
  const [checkInReservation, setCheckInReservation] = useState<ReservationResponseDto | null>(null);
  const [checkOutReservation, setCheckOutReservation] = useState<ReservationResponseDto | null>(null);
  const [showListView, setShowListView] = useState(false);
  // 2026-05-27 — status filter for the list view (request-to-book workflow).
  // Default ALL; PENDING is the most common admin task (review incoming requests).
  type StatusFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const openWizard = useReservationWizardStore((s) => s.openWizard);
  const moveReservation = useMoveReservation();

  const windowFrom = toLocalISODate(windowStart);
  const windowTo = toLocalISODate(addDays(windowStart, WINDOW_DAYS));

  // 2026-05-27 — Always query a WIDE date range (past 90d to next 2 years).
  // The PENDING banner must surface requests for any future date, including
  // December bookings; the calendar's 30-day window only governs which slice
  // is rendered visually. This costs one slightly bigger response but keeps
  // the admin from missing any pending request.
  const queryFrom = toLocalISODate(addDays(new Date(), -90));
  const queryTo = toLocalISODate(addDays(new Date(), 730));

  const { data: reservations = [], isLoading: reservationsLoading } =
    useReservations({ from: queryFrom, to: queryTo });

  const { data: rooms = [], isLoading: roomsLoading } = useAllRooms();

  const isLoading = reservationsLoading || roomsLoading;

  // Counts per status — drives the chip badges
  const counts = reservations.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1, ALL: acc.ALL + 1 }),
    { ALL: 0 } as Record<string, number>,
  );
  const filteredReservations =
    statusFilter === 'ALL' ? reservations : reservations.filter((r) => r.status === statusFilter);
  const pendingCount = counts.PENDING ?? 0;

  function goBack() {
    setWindowStart((d) => addDays(d, -NAV_STEP));
  }

  function goToday() {
    setWindowStart(startOfDay(new Date()));
  }

  function goForward() {
    setWindowStart((d) => addDays(d, NAV_STEP));
  }

  function handleEmptyCellClick(date: string, roomId: string) {
    openWizard({ checkIn: date, checkOut: toLocalISODate(addDays(new Date(date + 'T00:00:00.000Z'), 1)), roomId });
  }

  function handleMoveReservation({
    reservationId,
    newCheckIn,
    newCheckOut,
    targetRoomId,
  }: MoveReservationArgs) {
    // Find the current reservation in the cached list to determine the source room.
    // If we cannot resolve the source room we still forward targetRoomId — the
    // backend exclusion constraint is the authoritative guard anyway.
    const currentReservation = reservations.find((r) => r.id === reservationId);
    const sourceRoomId = currentReservation?.roomId ?? null;

    // Only include roomId in the mutation when the target room actually changed.
    // Same-room drags (date-only move) leave roomId untouched.
    const roomChanged = targetRoomId !== sourceRoomId;

    moveReservation.mutate(
      {
        id: reservationId,
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        ...(roomChanged ? { roomId: targetRoomId } : {}),
      },
      {
        onError: (err) => {
          // Surface backend rejection (409 conflict, 400 validation, etc.)
          const message =
            (err as { response?: { data?: { message?: string } } })
              ?.response?.data?.message ??
            'La habitación está ocupada en esa fecha';
          toast.error(message);
        },
      },
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-ink-1 text-2xl font-semibold">
            Reservas
          </h1>
          <p className="text-ink-3 text-sm mt-1">
            {windowFrom} — {windowTo}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Window navigation */}
          <div className="flex items-center gap-1 border border-warm-line rounded-md overflow-hidden">
            <button type="button"
              onClick={goBack}
              className="px-3 py-1.5 text-sm text-ink-2 hover:bg-warm-cream transition-colors"
            >
              ← Anterior
            </button>
            <button type="button"
              onClick={goToday}
              className="px-3 py-1.5 text-sm text-ink-2 hover:bg-warm-cream border-x border-warm-line transition-colors"
            >
              Hoy
            </button>
            <button type="button"
              onClick={goForward}
              className="px-3 py-1.5 text-sm text-ink-2 hover:bg-warm-cream transition-colors"
            >
              Siguiente →
            </button>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowListView((v) => !v)}
          >
            {showListView ? 'Vista calendario' : 'Vista lista'}
          </Button>
          <Button onClick={() => openWizard()}>Nueva reserva</Button>
        </div>
      </div>

      {/* Pending requests banner — always visible (regardless of view) */}
      {pendingCount > 0 && !isLoading && (
        <div className="flex items-center justify-between gap-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-200 text-yellow-900 text-sm font-semibold">
              {pendingCount}
            </span>
            <div>
              <p className="text-sm font-medium text-yellow-900">
                {pendingCount === 1
                  ? 'Hay 1 solicitud pendiente de confirmar'
                  : `Hay ${pendingCount} solicitudes pendientes de confirmar`}
              </p>
              <p className="text-xs text-yellow-800">
                Cada solicitud requiere que confirmes o rechaces. Click en una fila abre el detalle.
              </p>
            </div>
          </div>
          <button type="button"
            onClick={() => { setShowListView(true); setStatusFilter('PENDING'); }}
            className="text-xs px-3 py-1.5 rounded-md bg-yellow-200 text-yellow-900 hover:bg-yellow-300 font-medium transition-colors"
          >
            Ver pendientes →
          </button>
        </div>
      )}

      {/* Status filter chips — visible in list view */}
      {showListView && !isLoading && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-ink-3 italic mr-2">
            Mostrando todas las fechas (últimos 3 meses + próximos 2 años)
          </span>
          {(['ALL', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'] as const).map((s) => {
            const labels: Record<string, string> = {
              ALL: 'Todas', PENDING: 'Pendientes', CONFIRMED: 'Confirmadas',
              CHECKED_IN: 'Hospedados', CHECKED_OUT: 'Histórico', CANCELLED: 'Canceladas',
            };
            const count = counts[s] ?? 0;
            const isActive = statusFilter === s;
            const isPending = s === 'PENDING';
            return (
              <button type="button"
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  isActive
                    ? isPending
                      ? 'bg-yellow-200 border-yellow-300 text-yellow-900 font-semibold'
                      : 'bg-terracotta border-brand-primary text-white font-semibold'
                    : 'bg-warm-white border-warm-line text-ink-2 hover:bg-warm-cream'
                }`}
              >
                {labels[s]} {count > 0 && <span className="ml-1 opacity-80">({count})</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Calendar / List view toggle */}
      {isLoading ? (
        <div className="p-12 text-center text-ink-3 text-sm bg-warm-white rounded-lg border border-warm-line">
          Cargando...
        </div>
      ) : showListView ? (
        /* ─── List view with Acciones column ─────────────────────────────── */
        <div className="bg-warm-white border border-warm-line rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-warm-cream">
              <tr className="text-ink-3 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Huésped</th>
                <th className="px-3 py-3 text-left">Habitación</th>
                <th className="px-3 py-3 text-left">Entrada</th>
                <th className="px-3 py-3 text-left">Salida</th>
                <th className="px-3 py-3 text-left">Estado</th>
                <th className="px-3 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-line">
              {filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-3">
                    {statusFilter === 'ALL'
                      ? 'Sin reservas en este período'
                      : `Sin reservas en estado ${statusFilter} en este período`}
                  </td>
                </tr>
              ) : (
                filteredReservations.map((res: ReservationResponseDto) => (
                  <tr
                    key={res.id}
                    onClick={() => setOpenDrawerId(res.id)}
                    className="hover:bg-warm-cream transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3 text-ink-1">{res.guest?.fullName ?? '—'}</td>
                    <td className="px-3 py-3 text-ink-2">{res.room?.number ?? '—'}</td>
                    <td className="px-3 py-3 text-ink-2">{res.checkInDate.slice(0, 10)}</td>
                    <td className="px-3 py-3 text-ink-2">{res.checkOutDate.slice(0, 10)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        res.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                        res.status === 'CHECKED_IN' ? 'bg-green-100 text-green-700' :
                        res.status === 'CHECKED_OUT' ? 'bg-warm-cream text-ink-3 border border-warm-line' :
                        res.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {res.status}
                      </span>
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {/* Check-in button — only for CONFIRMED reservations */}
                        {res.status === 'CONFIRMED' && (
                          <button type="button"
                            onClick={() => setCheckInReservation(res)}
                            className="text-xs px-2.5 py-1 rounded-md bg-terracotta text-white hover:opacity-90 transition-opacity font-medium"
                          >
                            Check-in
                          </button>
                        )}
                        {/* Check-out button — only for CHECKED_IN reservations */}
                        {res.status === 'CHECKED_IN' && (
                          <>
                            <button type="button"
                              onClick={() => setCheckOutReservation(res)}
                              className="text-xs px-2.5 py-1 rounded-md border border-warm-line-strong text-ink-2 hover:bg-warm-cream transition-colors font-medium"
                            >
                              Check-out
                            </button>
                            <Link
                              to={`/folios/${res.id}`}
                              className="text-xs px-2.5 py-1 rounded-md border border-warm-line text-brand-primary hover:bg-warm-cream transition-colors"
                            >
                              Ver folio
                            </Link>
                          </>
                        )}
                        {/* Ver folio for CHECKED_OUT */}
                        {res.status === 'CHECKED_OUT' && (
                          <Link
                            to={`/folios/${res.id}`}
                            className="text-xs px-2.5 py-1 rounded-md border border-warm-line text-ink-3 hover:text-brand-primary transition-colors"
                          >
                            Ver folio
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <RoomRackCalendar
          rooms={rooms}
          reservations={reservations}
          windowStart={windowStart}
          windowDays={WINDOW_DAYS}
          onEmptyCellClick={handleEmptyCellClick}
          onEventClick={(resId) => setOpenDrawerId(resId)}
          onMoveReservation={handleMoveReservation}
        />
      )}

      {/* Wizard — reads isOpen from Zustand store */}
      <ReservationWizard />

      {/* Reservation detail drawer */}
      <ReservationDrawer
        reservationId={openDrawerId}
        onClose={() => setOpenDrawerId(null)}
      />

      {/* Check-in drawer */}
      <CheckInDrawer
        reservation={checkInReservation}
        open={checkInReservation !== null}
        onClose={() => setCheckInReservation(null)}
      />

      {/* Check-out confirm dialog */}
      <CheckOutConfirmDialog
        reservation={checkOutReservation}
        open={checkOutReservation !== null}
        onClose={() => setCheckOutReservation(null)}
      />
    </div>
  );
}
