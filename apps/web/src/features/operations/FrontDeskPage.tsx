import { useState, useMemo } from 'react';
import {
  ConciergeBell,
  LogIn,
  LogOut as LogOutIcon,
  Users,
  AlertTriangle,
  CalendarDays,
  Moon,
  BedDouble,
  Clock,
  CalendarCheck,
  Phone,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toLocalISODate, formatDisplayDate } from '@/lib/date';
import {
  useReservations,
  useConfirmReservationRequest,
  useRejectReservationRequest,
} from '@/features/reservations/reservations.api';
import type { ReservationResponseDto } from '@/features/reservations/reservations.api';
import { ContactButtons } from '@/features/guests/components/ContactButtons';
import { CheckInDrawer } from './CheckInDrawer';
import { CheckOutConfirmDialog } from './CheckOutConfirmDialog';

// ─── Date helpers ────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Extract YYYY-MM-DD from a possibly-full ISO datetime string. */
function ymd(dateStr: string): string {
  return dateStr.slice(0, 10);
}

/** Compute night count between two YYYY-MM-DD date strings. */
function nightsBetween(checkIn: string, checkOut: string): number {
  const msPerDay = 86_400_000;
  const a = new Date(checkIn + 'T00:00:00.000Z').getTime();
  const b = new Date(checkOut + 'T00:00:00.000Z').getTime();
  return Math.round((b - a) / msPerDay);
}

// ─── Reservation status label map (Spanish) ─────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'Hospedado',
  CHECKED_OUT: 'Check-out',
  CANCELLED: 'Cancelada',
  PENDING: 'Pendiente',
  NO_SHOW: 'No show',
};

// ─── Section wrapper ─────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  icon: React.ElementType;
  count: number;
  variant: 'action' | 'info';
  children: React.ReactNode;
  emptyMessage: string;
  isEmpty: boolean;
}

function Section({
  title,
  icon: Icon,
  count,
  variant,
  children,
  emptyMessage,
  isEmpty,
}: SectionProps) {
  const isAction = variant === 'action';
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`flex items-center justify-center w-9 h-9 rounded-lg ${
            isAction
              ? 'bg-terracotta-tint text-terracotta'
              : 'bg-warm-cream text-ink-3'
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="text-ink-1 text-lg font-semibold">{title}</h2>
        <span
          className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold ${
            isAction && count > 0
              ? 'bg-terracotta text-white'
              : 'bg-warm-cream text-ink-3 border border-warm-line'
          }`}
        >
          {count}
        </span>
      </div>
      {isEmpty ? (
        <div className="bg-warm-white border border-warm-line rounded-xl px-6 py-10 text-center">
          <p className="text-ink-3 text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

// ─── Guest card (shared between Llegadas and Salidas) ────────────────────────

interface GuestCardProps {
  reservation: ReservationResponseDto;
  today: string;
  action: React.ReactNode;
  overdueBadge?: React.ReactNode;
}

function GuestCard({ reservation, today, action, overdueBadge }: GuestCardProps) {
  const nights = nightsBetween(
    ymd(reservation.checkInDate),
    ymd(reservation.checkOutDate),
  );
  const hasRoom = reservation.roomId !== null && reservation.room !== null;

  return (
    <div className="bg-warm-white border border-warm-line rounded-xl p-5 flex items-center gap-5 hover:shadow-sm transition-shadow">
      {/* Guest info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-ink-1 font-semibold text-sm truncate">
            {reservation.guest?.fullName ?? '---'}
          </span>
          {overdueBadge}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
          {/* Room */}
          <span className="inline-flex items-center gap-1">
            <BedDouble className="w-3.5 h-3.5" />
            {hasRoom ? (
              <span>
                Hab. {reservation.room?.number}
                <span className="ml-1 text-ink-4">
                  ({reservation.room?.roomType?.name})
                </span>
              </span>
            ) : (
              <span className="text-red-600 font-medium">
                Sin habitacion --- asignar
              </span>
            )}
          </span>

          {/* Dates */}
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {formatDisplayDate(ymd(reservation.checkInDate))} ---{' '}
            {formatDisplayDate(ymd(reservation.checkOutDate))}
          </span>

          {/* Nights */}
          <span className="inline-flex items-center gap-1">
            <Moon className="w-3.5 h-3.5" />
            {nights} {nights === 1 ? 'noche' : 'noches'}
          </span>

          {/* Adults */}
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {reservation.adults} {reservation.adults === 1 ? 'adulto' : 'adultos'}
            {reservation.children ? `, ${reservation.children} ninos` : ''}
          </span>
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0">{action}</div>
    </div>
  );
}

// ─── Pending card (Solicitudes PENDING — confirmar/rechazar) ─────────────────

interface PendingCardProps {
  reservation: ReservationResponseDto;
}

/**
 * PendingCard — card para solicitudes PENDING por contactar y procesar.
 *
 * Acciones:
 *  - ContactButtons (Llamar / WhatsApp / Email)
 *  - Confirmar (useConfirmReservationRequest) — simple: sin asignación de
 *    habitación en este paso; la asignación ocurre desde el drawer completo
 *    o en el check-in. El caso de uso de recepción es: "confirmar que existe
 *    el huésped y proceder", no gestionar inventario de habitaciones aquí.
 *  - Rechazar (useRejectReservationRequest) — pide motivo con window.prompt
 *    igual que ReservationDrawer.
 *
 * Errores backend:
 *  - 409: habitación con conflicto (puede ocurrir si ya se asignó y hay overlap)
 *  - 400: validación
 */
function PendingCard({ reservation }: PendingCardProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const nights = nightsBetween(
    ymd(reservation.checkInDate),
    ymd(reservation.checkOutDate),
  );
  const hasRoom = reservation.roomId !== null && reservation.room !== null;

  const confirmMutation = useConfirmReservationRequest(reservation.id);
  const rejectMutation = useRejectReservationRequest(reservation.id);

  const isPending = confirmMutation.isPending || rejectMutation.isPending;

  async function handleConfirm() {
    setActionError(null);
    try {
      await confirmMutation.mutateAsync();
    } catch (err: unknown) {
      const apiErr = err as {
        response?: { status?: number; data?: { message?: string | string[] } };
      };
      const status = apiErr?.response?.status;
      const message = apiErr?.response?.data?.message;
      if (status === 409) {
        setActionError(
          'Conflicto de habitacion: esa habitacion ya tiene otra reserva en esas fechas.',
        );
      } else {
        setActionError(
          typeof message === 'string'
            ? message
            : 'Error al confirmar la solicitud.',
        );
      }
    }
  }

  function handleReject() {
    setActionError(null);
    const reason = window.prompt('Motivo del rechazo (opcional):');
    // null = el admin canceló el diálogo — no hacer nada
    if (reason === null) return;
    rejectMutation.mutate(
      { reason: reason || undefined },
      {
        onError: (err: unknown) => {
          const message = (
            err as { response?: { data?: { message?: string } } }
          )?.response?.data?.message;
          setActionError(
            typeof message === 'string'
              ? message
              : 'Error al rechazar la solicitud.',
          );
        },
      },
    );
  }

  return (
    <div className="bg-warm-white border border-warm-line rounded-xl p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow">
      {/* Fila superior: info del huésped + badge */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-ink-1 font-semibold text-sm">
              {reservation.guest?.fullName ?? '---'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
              <Clock className="w-3 h-3" />
              Pendiente
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
            {/* Habitacion */}
            <span className="inline-flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5" />
              {hasRoom ? (
                <span>
                  Hab. {reservation.room?.number}
                  <span className="ml-1 text-ink-4">
                    ({reservation.room?.roomType?.name})
                  </span>
                </span>
              ) : (
                <span className="text-ink-3 italic">Sin habitacion asignada</span>
              )}
            </span>

            {/* Fechas */}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              {formatDisplayDate(ymd(reservation.checkInDate))} ---{' '}
              {formatDisplayDate(ymd(reservation.checkOutDate))}
            </span>

            {/* Noches */}
            <span className="inline-flex items-center gap-1">
              <Moon className="w-3.5 h-3.5" />
              {nights} {nights === 1 ? 'noche' : 'noches'}
            </span>

            {/* Adultos */}
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {reservation.adults} {reservation.adults === 1 ? 'adulto' : 'adultos'}
              {reservation.children ? `, ${reservation.children} ninos` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Error de acción */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
          <p className="text-xs text-red-700">{actionError}</p>
        </div>
      )}

      {/* Info de contacto — texto visible y copiable */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-ink-3 shrink-0" />
          {reservation.guest?.phone ? (
            <span className="text-ink-1 font-medium select-all">
              {reservation.guest.phone}
            </span>
          ) : (
            <span className="text-ink-4 italic">Sin teléfono</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-ink-3 shrink-0" />
          {reservation.guest?.email ? (
            <span className="text-ink-1 select-all">
              {reservation.guest.email}
            </span>
          ) : (
            <span className="text-ink-4 italic">Sin email</span>
          )}
        </span>
      </div>

      {/* Fila de acciones: contacto + confirmar/rechazar */}
      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-warm-line">
        <ContactButtons
          guestId={reservation.guestId}
          fullName={reservation.guest?.fullName ?? ''}
          email={reservation.guest?.email}
          phone={reservation.guest?.phone}
          size="sm"
        />
        <div className="flex items-center gap-2 ml-auto">
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => void handleConfirm()}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {confirmMutation.isPending ? 'Confirmando...' : 'Confirmar'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={handleReject}
            className="text-red-700 border-red-200 hover:bg-red-50"
          >
            {rejectMutation.isPending ? 'Rechazando...' : 'Rechazar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Upcoming card (Proximas llegadas — CONFIRMED, próximos 14d) ──────────────

interface UpcomingCardProps {
  reservation: ReservationResponseDto;
}

/**
 * UpcomingCard — card informacional para llegadas CONFIRMED de los próximos 14 días.
 *
 * Sin acción de check-in (esa sección existe para el día de hoy).
 * Incluye ContactButtons para coordinar la llegada con el huésped.
 */
function UpcomingCard({ reservation }: UpcomingCardProps) {
  const nights = nightsBetween(
    ymd(reservation.checkInDate),
    ymd(reservation.checkOutDate),
  );
  const hasRoom = reservation.roomId !== null && reservation.room !== null;

  return (
    <div className="bg-warm-white border border-warm-line rounded-xl p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      {/* Info principal */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="mb-1">
            <span className="text-ink-1 font-semibold text-sm">
              {reservation.guest?.fullName ?? '---'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
            {/* Fecha de llegada resaltada */}
            <span className="inline-flex items-center gap-1 text-terracotta font-medium">
              <CalendarCheck className="w-3.5 h-3.5" />
              Llega {formatDisplayDate(ymd(reservation.checkInDate))}
            </span>

            {/* Salida */}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              Sale {formatDisplayDate(ymd(reservation.checkOutDate))}
            </span>

            {/* Noches */}
            <span className="inline-flex items-center gap-1">
              <Moon className="w-3.5 h-3.5" />
              {nights} {nights === 1 ? 'noche' : 'noches'}
            </span>

            {/* Habitacion */}
            <span className="inline-flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5" />
              {hasRoom ? (
                <span>
                  Hab. {reservation.room?.number}
                  <span className="ml-1 text-ink-4">
                    ({reservation.room?.roomType?.name})
                  </span>
                </span>
              ) : (
                <span className="text-ink-3 italic">Sin habitacion asignada</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Info de contacto — texto visible y copiable */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs mb-2">
        <span className="inline-flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-ink-3 shrink-0" />
          {reservation.guest?.phone ? (
            <span className="text-ink-1 font-medium select-all">
              {reservation.guest.phone}
            </span>
          ) : (
            <span className="text-ink-4 italic">Sin teléfono</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-ink-3 shrink-0" />
          {reservation.guest?.email ? (
            <span className="text-ink-1 select-all">
              {reservation.guest.email}
            </span>
          ) : (
            <span className="text-ink-4 italic">Sin email</span>
          )}
        </span>
      </div>

      {/* Contacto para coordinar llegada */}
      <div className="pt-1 border-t border-warm-line">
        <ContactButtons
          guestId={reservation.guestId}
          fullName={reservation.guest?.fullName ?? ''}
          email={reservation.guest?.email}
          phone={reservation.guest?.phone}
          size="sm"
        />
      </div>
    </div>
  );
}

// ─── In-house row (lighter, informational) ───────────────────────────────────

interface InHouseRowProps {
  reservation: ReservationResponseDto;
}

function InHouseRow({ reservation }: InHouseRowProps) {
  const hasRoom = reservation.roomId !== null && reservation.room !== null;

  return (
    <div className="bg-warm-white border border-warm-line rounded-lg px-5 py-3 flex items-center gap-4">
      <span className="text-ink-1 text-sm font-medium truncate min-w-0 flex-1">
        {reservation.guest?.fullName ?? '---'}
      </span>
      <span className="text-ink-3 text-xs shrink-0">
        {hasRoom ? `Hab. ${reservation.room?.number}` : 'Sin hab.'}
      </span>
      <span className="text-ink-3 text-xs shrink-0">
        Sale {formatDisplayDate(ymd(reservation.checkOutDate))}
      </span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * FrontDeskPage --- Recepcion (front desk) for daily check-in / check-out ops.
 *
 * Route: /front-desk
 *
 * Five sections (orden por urgencia/accionabilidad):
 * D. Solicitudes pendientes — PENDING por contactar/confirmar  — ContactButtons + Confirmar/Rechazar
 * A. Llegadas de hoy        — CONFIRMED con checkInDate === hoy — Check-in
 * B. Salidas pendientes     — CHECKED_IN con checkOutDate <= hoy — Check-out (vencidas primero)
 * E. Proximas llegadas      — CONFIRMED con checkInDate > hoy y <= hoy+14d — ContactButtons
 * C. En casa (hospedados)   — CHECKED_IN excluyendo los de B
 *
 * Queries:
 *  - queryMain : hoy-30d → hoy+14d  (captura vencidas, hoy, y próximas 2 semanas)
 *  - queryPending: hoy → hoy+180d   (PENDING puede tener check-in muy lejano; 180d
 *    cubre la agenda de reservas avanzadas sin cargar años enteros de historia)
 *    NOTA: el backend filtra por fecha de check-in, no por fecha de creación,
 *    por lo que una PENDING creada hoy para diciembre SOLO aparece en la ventana
 *    que incluye diciembre. Los 180 días se eligieron como balance pragmático.
 */
export function FrontDeskPage() {
  const today = toLocalISODate(new Date());

  // Check-in / Check-out action state (mirrors ReservationsPage wiring)
  const [checkInReservation, setCheckInReservation] =
    useState<ReservationResponseDto | null>(null);
  const [checkOutReservation, setCheckOutReservation] =
    useState<ReservationResponseDto | null>(null);

  // ── Query principal: hoy-30d → hoy+14d ─────────────────────────────────────
  // Captura: estadías vencidas (hasta 30d atrás), llegadas de hoy, salidas de hoy,
  // y próximas llegadas confirmadas dentro de los próximos 14 días.
  const queryFrom = toLocalISODate(addDays(new Date(), -30));
  const queryTo = toLocalISODate(addDays(new Date(), 14)); // ampliad de +2d a +14d

  const { data: reservations = [], isLoading: loadingMain } = useReservations({
    from: queryFrom,
    to: queryTo,
  });

  // ── Query pendientes: hoy → hoy+180d ───────────────────────────────────────
  // PENDING puede tener check-in para diciembre; el query principal (hoy+14d)
  // no las capturaría. Usamos una ventana de 180 días dedicada solo a este rango
  // para no inflar el query principal con reservas muy futuras que no son accionables
  // operativamente hoy (salvo el contacto/confirmación de PENDING).
  const pendingQueryFrom = today;
  const pendingQueryTo = toLocalISODate(addDays(new Date(), 180));

  const { data: pendingReservations = [], isLoading: loadingPending } =
    useReservations({ from: pendingQueryFrom, to: pendingQueryTo });

  const isLoading = loadingMain || loadingPending;

  // ── Section D: Solicitudes pendientes ─────────────────────────────────────
  // PENDING de la ventana amplia (hoy+180d), ordenadas por checkInDate ascendente
  // (las que llegan antes, primero — mayor urgencia para contactar).
  // Se usa pendingReservations (query amplio) para no perder PENDING lejanas.
  const pendingRequests = useMemo(() => {
    const seen = new Set<string>();
    const all = [...reservations, ...pendingReservations];
    return all
      .filter((r) => {
        if (r.status !== 'PENDING') return false;
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      })
      .sort((a, b) => ymd(a.checkInDate).localeCompare(ymd(b.checkInDate)));
  }, [reservations, pendingReservations]);

  // ── Section A: Llegadas de hoy ─────────────────────────────────────────────
  // CONFIRMED reservations whose check-in date is today.
  const arrivals = useMemo(
    () =>
      reservations.filter(
        (r) => r.status === 'CONFIRMED' && ymd(r.checkInDate) === today,
      ),
    [reservations, today],
  );

  // ── Section B: Salidas pendientes ──────────────────────────────────────────
  // CHECKED_IN reservations whose check-out date is today or in the past.
  // Sort: overdue first (oldest checkout first), then today.
  const departures = useMemo(() => {
    const deps = reservations.filter(
      (r) => r.status === 'CHECKED_IN' && ymd(r.checkOutDate) <= today,
    );
    return deps.sort((a, b) => ymd(a.checkOutDate).localeCompare(ymd(b.checkOutDate)));
  }, [reservations, today]);

  // IDs of departures (for excluding from section C)
  const departureIds = useMemo(
    () => new Set(departures.map((r) => r.id)),
    [departures],
  );

  // ── Section E: Proximas llegadas ───────────────────────────────────────────
  // CONFIRMED con checkInDate > hoy y <= hoy+14d.
  // NO incluye las de hoy (esas ya están en Llegadas de hoy — sección A).
  // Ordenadas por checkInDate ascendente (las más próximas primero).
  const upcomingArrivals = useMemo(() => {
    const horizon = toLocalISODate(addDays(new Date(), 14));
    return reservations
      .filter(
        (r) =>
          r.status === 'CONFIRMED' &&
          ymd(r.checkInDate) > today &&
          ymd(r.checkInDate) <= horizon,
      )
      .sort((a, b) => ymd(a.checkInDate).localeCompare(ymd(b.checkInDate)));
  }, [reservations, today]);

  // ── Section C: En casa ─────────────────────────────────────────────────────
  // All CHECKED_IN, excluding those already surfaced in Salidas pendientes.
  const inHouse = useMemo(
    () =>
      reservations
        .filter((r) => r.status === 'CHECKED_IN' && !departureIds.has(r.id))
        .sort((a, b) => ymd(a.checkOutDate).localeCompare(ymd(b.checkOutDate))),
    [reservations, departureIds],
  );

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <ConciergeBell className="w-7 h-7 text-terracotta" />
          <h1 className="text-ink-1 text-2xl font-semibold">Recepcion</h1>
        </div>
        <p className="text-ink-3 text-sm ml-10">
          Llegadas y salidas del dia ---{' '}
          {formatDisplayDate(today)}
        </p>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-ink-3 text-sm bg-warm-white rounded-lg border border-warm-line">
          Cargando...
        </div>
      ) : (
        <>
          {/* D. Solicitudes pendientes — PENDING por contactar/confirmar (lo más accionable) */}
          <Section
            title="Solicitudes pendientes"
            icon={Clock}
            count={pendingRequests.length}
            variant="action"
            isEmpty={pendingRequests.length === 0}
            emptyMessage="No hay solicitudes pendientes de revision"
          >
            {pendingRequests.map((res) => (
              <PendingCard key={res.id} reservation={res} />
            ))}
          </Section>

          {/* A. Llegadas de hoy */}
          <Section
            title="Llegadas de hoy"
            icon={LogIn}
            count={arrivals.length}
            variant="action"
            isEmpty={arrivals.length === 0}
            emptyMessage="No hay llegadas para hoy"
          >
            {arrivals.map((res) => (
              <GuestCard
                key={res.id}
                reservation={res}
                today={today}
                action={
                  <Button
                    size="sm"
                    onClick={() => setCheckInReservation(res)}
                  >
                    Check-in
                  </Button>
                }
              />
            ))}
          </Section>

          {/* B. Salidas pendientes */}
          <Section
            title="Salidas pendientes"
            icon={LogOutIcon}
            count={departures.length}
            variant="action"
            isEmpty={departures.length === 0}
            emptyMessage="No hay salidas pendientes"
          >
            {departures.map((res) => {
              const isOverdue = ymd(res.checkOutDate) < today;
              return (
                <GuestCard
                  key={res.id}
                  reservation={res}
                  today={today}
                  overdueBadge={
                    isOverdue ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                        <AlertTriangle className="w-3 h-3" />
                        Vencido --- salida{' '}
                        {formatDisplayDate(ymd(res.checkOutDate))}
                      </span>
                    ) : undefined
                  }
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setCheckOutReservation(res)}
                    >
                      Check-out
                    </Button>
                  }
                />
              );
            })}
          </Section>

          {/* E. Proximas llegadas — CONFIRMED > hoy y <= hoy+14d */}
          <Section
            title="Proximas llegadas"
            icon={CalendarCheck}
            count={upcomingArrivals.length}
            variant="info"
            isEmpty={upcomingArrivals.length === 0}
            emptyMessage="No hay llegadas confirmadas en los proximos 14 dias"
          >
            {upcomingArrivals.map((res) => (
              <UpcomingCard key={res.id} reservation={res} />
            ))}
          </Section>

          {/* C. En casa (hospedados) */}
          <Section
            title="En casa"
            icon={Users}
            count={inHouse.length}
            variant="info"
            isEmpty={inHouse.length === 0}
            emptyMessage="No hay huespedes hospedados actualmente"
          >
            {inHouse.map((res) => (
              <InHouseRow key={res.id} reservation={res} />
            ))}
          </Section>
        </>
      )}

      {/* Check-in drawer (reused from operations) */}
      <CheckInDrawer
        reservation={checkInReservation}
        open={checkInReservation !== null}
        onClose={() => setCheckInReservation(null)}
      />

      {/* Check-out confirm dialog (reused from operations) */}
      <CheckOutConfirmDialog
        reservation={checkOutReservation}
        open={checkOutReservation !== null}
        onClose={() => setCheckOutReservation(null)}
      />
    </div>
  );
}
