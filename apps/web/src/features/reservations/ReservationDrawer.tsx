import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { toLocalISODate } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { EmptyTabPlaceholder } from '@/components/ui/empty-tab-placeholder';
import {
  useReservation,
  useUpdateReservation,
  useCancelReservation,
  useConfirmReservationRequest,
  useRejectReservationRequest,
  useReactivateReservation,
  useAllRooms,
  useAvailability,
  type ReservationResponseDto,
  type ReservationStatus,
} from './reservations.api';
import { usePublicRoomTypes } from '@/features/public-booking/public-booking.api';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'detalles', label: 'Detalles' },
  { id: 'huesped', label: 'Huésped' },
  { id: 'cobros', label: 'Cobros' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Modify form schema ───────────────────────────────────────────────────────
// Zod v4: no invalid_type_error on z.number()

const modifySchema = z.object({
  dateRange: z
    .custom<DateRange | undefined>()
    .refine((v) => v?.from != null && v?.to != null, {
      message: 'Selecciona las fechas de check-in y check-out',
    }),
  /** Required — every reservation has a room type (changing it recalculates rate). */
  roomTypeId: z.string().min(1, 'Selecciona el tipo de habitación'),
  /**
   * roomId — empty string means 'Sin asignar' (request-to-book). Allows the
   * admin to either leave the room unassigned until check-in OR move the
   * guest to a different physical room when something happens with the
   * originally assigned one (maintenance, upgrade, etc.).
   */
  roomId: z.string().optional(),
  notes: z.string().optional(),
});

type ModifyFormData = z.infer<typeof modifySchema>;

// ─── Status labels ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'Check-in realizado',
  CHECKED_OUT: 'Check-out realizado',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No show',
};

const STATUS_COLORS: Record<ReservationStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  CHECKED_IN: 'bg-green-100 text-green-800',
  CHECKED_OUT: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  NO_SHOW: 'bg-red-100 text-red-700',
};

/** Statuses that allow modification or cancellation */
const MODIFIABLE_STATUSES: ReservationStatus[] = ['PENDING', 'CONFIRMED'];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReservationDrawerProps {
  reservationId: string | null;
  onClose: () => void;
}

// ─── Inner drawer (loaded when reservationId is set) ─────────────────────────

function ReservationDrawerContent({
  reservationId,
  onClose,
}: {
  reservationId: string;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('detalles');
  const [editMode, setEditMode] = useState(false);
  // 2026-05-27 — sub-form fed into the PENDING confirm action so the admin
  // can assign a physical room AT THE MOMENT of approving the request. This
  // is what makes the reservation visible in the room-rack calendar right
  // after confirming (calendar can only render reservations with a roomId).
  const [confirmRoomTypeId, setConfirmRoomTypeId] = useState<string>('');
  const [confirmRoomId, setConfirmRoomId] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);

  const { data: reservation, isLoading } = useReservation(reservationId);
  // Prime the assignment sub-form with the reservation's current room/type
  // whenever the loaded reservation changes — defaults to its existing values
  // instead of empty dropdowns.
  useEffect(() => {
    if (reservation) {
      setConfirmRoomTypeId(reservation.roomTypeId ?? '');
      setConfirmRoomId(reservation.roomId ?? '');
    }
  }, [reservation?.id, reservation?.roomTypeId, reservation?.roomId]);
  // 2026-05-27 — populate room-type + room dropdowns for in-place modification.
  const { data: roomTypes = [] } = usePublicRoomTypes();
  const { data: allRooms = [] } = useAllRooms();
  const updateReservation = useUpdateReservation(reservationId);
  const cancelReservation = useCancelReservation(reservationId);
  // 2026-05-27 — confirm/reject mutations for PENDING (request-to-book) reservations
  const confirmRequest = useConfirmReservationRequest(reservationId);
  const rejectRequest = useRejectReservationRequest(reservationId);
  const reactivateReservation = useReactivateReservation(reservationId);

  const {
    control,
    register,
    handleSubmit,
    reset: resetModify,
    watch: watchModify,
    formState: { errors: modifyErrors, isSubmitting: modifySubmitting },
  } = useForm<ModifyFormData>({
    resolver: zodResolver(modifySchema),
  });

  // Watch the dateRange field so the room-availability dropdown always reflects
  // the PROPOSED (newly selected) dates when in edit mode, not the reservation's
  // current dates. Without this watch, the dropdown queries availability for the
  // OLD dates even after the admin changes the DayPicker selection — making a
  // room appear 'libre' when the new range actually conflicts with another active
  // reservation. That gives the admin a false green light, and the backend then
  // correctly rejects with 409. This watch closes the gap between what the
  // dropdown shows and what the constraint will enforce.
  const watchedDateRange = watchModify('dateRange');
  const proposedCheckIn =
    editMode && watchedDateRange?.from
      ? toLocalISODate(watchedDateRange.from)
      : reservation?.checkInDate?.slice(0, 10) ?? '';
  const proposedCheckOut =
    editMode && watchedDateRange?.to
      ? toLocalISODate(watchedDateRange.to)
      : reservation?.checkOutDate?.slice(0, 10) ?? '';

  // Drive the room-assignment dropdown with real-time availability for the
  // proposed date window (proposedCheckIn/Out above). In edit mode these track
  // the DayPicker selection live; in read mode they fall back to the existing
  // reservation dates so the confirm-flow dropdown still works correctly.
  const { data: availabilityData } = useAvailability(
    { checkIn: proposedCheckIn, checkOut: proposedCheckOut, adults: reservation?.adults ?? 1 },
    { enabled: !!proposedCheckIn && !!proposedCheckOut },
  );
  const availableRoomIds = new Set(
    (availabilityData?.rooms ?? []).map((r) => r.id),
  );

  function enterEditMode(res: ReservationResponseDto) {
    resetModify({
      dateRange: {
        from: new Date(res.checkInDate.slice(0, 10) + 'T12:00:00.000Z'),
        to: new Date(res.checkOutDate.slice(0, 10) + 'T12:00:00.000Z'),
      },
      roomTypeId: res.roomTypeId,
      roomId: res.roomId ?? '',
      notes: res.notes ?? '',
    });
    setConflictError(null);
    setGenericError(null);
    setEditMode(true);
  }

  async function onSubmitModify(data: ModifyFormData) {
    setConflictError(null);
    setGenericError(null);
    const { from, to } = data.dateRange as DateRange;

    try {
      // `roomId: null` explicitly clears the physical-room assignment when the
      // admin picked 'Sin asignar' in the dropdown. Sending undefined would
      // leave the existing value untouched, which is the wrong semantic here.
      const roomIdPayload =
        data.roomId === undefined || data.roomId === ''
          ? null
          : data.roomId;
      await updateReservation.mutateAsync({
        // Use toLocalISODate — prevents UTC-5 off-by-one (Pitfall P6)
        checkInDate: toLocalISODate(from!),
        checkOutDate: toLocalISODate(to!),
        roomTypeId: data.roomTypeId,
        roomId: roomIdPayload,
        notes: data.notes || undefined,
      });
      setEditMode(false);
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { message?: string | string[] } } };
      const statusCode = apiErr?.response?.status;
      const message = apiErr?.response?.data?.message;
      if (statusCode === 409) {
        setConflictError(
          'Esa habitación tiene un conflicto en las nuevas fechas. ' +
            (typeof message === 'string' ? message : ''),
        );
      } else {
        setGenericError(
          typeof message === 'string' ? message : 'Error al modificar la reserva.',
        );
      }
    }
  }

  async function handleCancelReservation() {
    setGenericError(null);
    try {
      await cancelReservation.mutateAsync();
      setShowCancelConfirm(false);
      onClose();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setGenericError(
        typeof message === 'string' ? message : 'Error al cancelar la reserva.',
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <span className="text-ink-3 text-sm">Cargando reserva...</span>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <span className="text-ink-3 text-sm">Reserva no encontrada.</span>
      </div>
    );
  }

  const canModify = MODIFIABLE_STATUSES.includes(reservation.status);
  const statusLabel = STATUS_LABELS[reservation.status] ?? reservation.status;
  const statusColor = STATUS_COLORS[reservation.status] ?? 'bg-gray-100 text-gray-700';
  const disabledTooltip = canModify
    ? undefined
    : `No se puede modificar una reserva en estado ${statusLabel}`;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-warm-line">
        <div>
          <h2 className="text-ink-1 text-lg font-semibold">
            Reserva
          </h2>
          <span
            className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>
        <button type="button"
          onClick={onClose}
          className="text-ink-3 hover:text-ink-1 transition-colors"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      {/* Tab navigation (button-group, NOT shadcn Tabs) */}
      <div className="flex border-b border-warm-line px-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-ink-3 hover:text-ink-1'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Detalles ── */}
        {activeTab === 'detalles' && (
          <div className="flex flex-col gap-6">
            {/* 2026-05-28 — Offer attribution badge: shows the homepage offer the
                guest came from, when applicable. Helps the admin tailor the
                call/WhatsApp follow-up. */}
            {reservation.sourceOffer && !editMode && (
              <div className="flex items-start gap-3 rounded-lg border border-terracotta/30 bg-terracotta/5 px-4 py-3">
                <span className="inline-flex items-center rounded-full bg-terracotta text-warm-white text-xs font-medium px-2 py-0.5 shrink-0">
                  Oferta
                </span>
                <div className="flex-1 text-sm">
                  <div className="text-ink-1 font-medium">
                    Vino por: {reservation.sourceOffer.title}
                  </div>
                  {reservation.sourceOffer.badge && (
                    <div className="text-xs text-ink-3 mt-0.5">
                      Promoción: {reservation.sourceOffer.badge}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Read-only summary */}
            {!editMode && (
              <div className="border border-warm-line rounded-lg divide-y divide-warm-line">
                {[
                  { label: 'Check-in', value: reservation.checkInDate.slice(0, 10) },
                  { label: 'Check-out', value: reservation.checkOutDate.slice(0, 10) },
                  { label: 'Noches', value: String(reservation.totalNights) },
                  {
                    label: 'Habitación',
                    value: reservation.room
                      ? `${reservation.room.number} — ${reservation.room.roomType?.name ?? ''}`
                      : 'Sin asignar · tipo pendiente',
                  },
                  { label: 'Adultos', value: String(reservation.adults) },
                  { label: 'Origen', value: reservation.source },
                  { label: 'Notas', value: reservation.notes || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="px-4 py-3 flex justify-between text-sm">
                    <span className="text-ink-2">{label}</span>
                    <span className="text-ink-1 font-medium text-right truncate max-w-[55%]">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Edit mode — modify dates + notes */}
            {editMode && (
              <form
                onSubmit={handleSubmit(onSubmitModify)}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-ink-2">
                    Nuevas fechas
                  </span>
                  {/* Tipo de habitación dropdown */}
                  <div className="flex flex-col gap-1 mb-3">
                    <label htmlFor="modify-roomType" className="text-sm font-medium text-ink-2">
                      Tipo de habitación
                    </label>
                    <Controller
                      name="roomTypeId"
                      control={control}
                      render={({ field }) => (
                        <select
                          id="modify-roomType"
                          value={field.value ?? ''}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            // Clear roomId when the type changes — the previously
                            // selected room belongs to the old type and must not
                            // carry over.
                            if (typeof window !== 'undefined') {
                              const ev = new Event('roomtype-changed');
                              window.dispatchEvent(ev);
                            }
                          }}
                          className="flex w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-2 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
                        >
                          {roomTypes.length === 0 && <option value="">Cargando tipos...</option>}
                          {roomTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} · hasta {t.capacity} {t.capacity === 1 ? 'persona' : 'personas'}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                    {modifyErrors.roomTypeId && (
                      <p className="text-xs text-status-in-progress">{modifyErrors.roomTypeId.message}</p>
                    )}
                  </div>

                  {/* Habitación física dropdown — depends on selected type */}
                  <Controller
                    name="roomId"
                    control={control}
                    render={({ field: roomField }) => {
                      const selectedType = (control._formValues as ModifyFormData).roomTypeId;
                      const candidateRooms = allRooms.filter((r) => r.roomTypeId === selectedType && r.isActive);
                      return (
                        <div className="flex flex-col gap-1 mb-3">
                          <label htmlFor="modify-room" className="text-sm font-medium text-ink-2">
                            Habitación física <span className="text-ink-3 font-normal">(opcional)</span>
                          </label>
                          <select
                            id="modify-room"
                            value={roomField.value ?? ''}
                            onChange={(e) => roomField.onChange(e.target.value)}
                            className="flex w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-2 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
                          >
                            <option value="">Sin asignar (asignar en check-in)</option>
                            {candidateRooms.map((r) => {
                              const isCurrentRoom = r.id === reservation.roomId;
                              const isFree = isCurrentRoom || availableRoomIds.has(r.id);
                              return (
                                <option key={r.id} value={r.id} disabled={!isFree}>
                                  Habitación {r.number} · piso {r.floor}{' '}
                                  {isFree ? '· libre' : '· ocupada'}
                                </option>
                              );
                            })}
                          </select>
                          {candidateRooms.length === 0 && selectedType && (
                            <p className="text-xs text-ink-3">
                              No hay habitaciones activas de este tipo. La reserva quedará sin asignar.
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />

                  <Controller
                    name="dateRange"
                    control={control}
                    rules={{
                      validate: (v) => {
                        if (!v?.from || !v?.to) return 'Selecciona las fechas';
                        return true;
                      },
                    }}
                    render={({ field }) => (
                      <div className="border border-warm-line rounded-md p-2 bg-warm-cream overflow-x-auto">
                        <DayPicker
                          mode="range"
                          selected={field.value as DateRange | undefined}
                          onSelect={field.onChange}
                          disabled={{ before: new Date() }}
                          numberOfMonths={2}
                        />
                      </div>
                    )}
                  />
                  {modifyErrors.dateRange && (
                    <p className="text-xs text-status-in-progress">
                      {modifyErrors.dateRange.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="modify-notes"
                    className="text-sm font-medium text-ink-2"
                  >
                    Notas{' '}
                    <span className="text-ink-3 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    id="modify-notes"
                    rows={2}
                    {...register('notes')}
                    className="flex w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-2 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary resize-none"
                  />
                </div>

                {/* 409 conflict error */}
                {conflictError && (
                  <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    <p className="text-sm text-red-700">{conflictError}</p>
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="text-xs text-brand-primary underline hover:no-underline mt-1"
                    >
                      Cancelar cambios
                    </button>
                  </div>
                )}

                {/* Generic error */}
                {genericError && !conflictError && (
                  <p className="text-xs text-status-in-progress bg-red-50 border border-red-200 rounded px-3 py-2">
                    {genericError}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditMode(false);
                      setConflictError(null);
                      setGenericError(null);
                    }}
                    className="flex-1"
                  >
                    Cancelar cambios
                  </Button>
                  <Button
                    type="submit"
                    disabled={modifySubmitting || updateReservation.isPending}
                    className="flex-1"
                  >
                    {modifySubmitting || updateReservation.isPending
                      ? 'Guardando...'
                      : 'Guardar cambios'}
                  </Button>
                </div>
              </form>
            )}

            {/* Action buttons (only shown in read mode) */}
            {!editMode && (
              <div className="flex flex-col gap-2">
                <hr className="border-warm-line" />

                {/* Modify button */}
                <div title={disabledTooltip}>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canModify}
                    onClick={() => enterEditMode(reservation)}
                    className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Modificar reserva
                  </Button>
                </div>

                {/* Room-assignment notice — when the reservation has no physical room yet */}
                {!reservation.roomId && reservation.status !== 'CANCELLED' && (
                  <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-yellow-900 mb-1">
                      Sin habitación asignada · Tipo: {reservation.room?.roomType?.name ?? reservation.roomTypeId}
                    </p>
                    <p className="text-xs text-yellow-800 mb-2">
                      Esta reserva no tiene una habitación física asignada todavía. Asígnala desde
                      el botón <strong>Modificar reserva</strong> abajo seleccionando una nueva habitación,
                      o espera al check-in para que recepción decida.
                    </p>
                  </div>
                )}

                {/* PENDING — confirm flow with optional room assignment so the
                    reservation can land on the calendar immediately after approval. */}
                {reservation.status === 'PENDING' && (() => {
                  const candidateRoomsForConfirm = allRooms.filter(
                    (r) => r.roomTypeId === confirmRoomTypeId && r.isActive,
                  );
                  const canConfirm = !!confirmRoomTypeId;
                  const handleConfirmAndAssign = async () => {
                    setConfirmError(null);
                    try {
                      const needsPatch =
                        confirmRoomTypeId !== reservation.roomTypeId ||
                        (confirmRoomId || null) !== reservation.roomId;
                      if (needsPatch) {
                        await updateReservation.mutateAsync({
                          roomTypeId: confirmRoomTypeId,
                          roomId: confirmRoomId === '' ? null : confirmRoomId,
                        });
                      }
                      await confirmRequest.mutateAsync();
                    } catch (err: unknown) {
                      const apiErr = err as {
                        response?: { status?: number; data?: { message?: string | string[] } };
                      };
                      const status = apiErr?.response?.status;
                      const message = apiErr?.response?.data?.message;
                      if (status === 409) {
                        setConfirmError(
                          'Esa habitacion tiene conflicto con otra reserva en esas fechas. Elige otra antes de confirmar.',
                        );
                      } else {
                        setConfirmError(
                          typeof message === 'string'
                            ? message
                            : 'Error al confirmar y asignar habitacion.',
                        );
                      }
                    }
                  };
                  return (
                    <div className="border border-warm-line rounded-lg p-3 flex flex-col gap-3 bg-warm-cream">
                      <p className="text-xs font-medium text-ink-1">Asignación al confirmar</p>
                      <p className="text-xs text-ink-3 -mt-2">
                        Elige el tipo y la habitacion fisica antes de confirmar — esa asignacion
                        hace que aparezca como ocupada en el calendario inmediatamente.
                      </p>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-ink-2">Tipo de habitacion</label>
                        <select
                          value={confirmRoomTypeId}
                          onChange={(e) => {
                            setConfirmRoomTypeId(e.target.value);
                            setConfirmRoomId('');
                          }}
                          className="flex w-full rounded-md border border-warm-line-strong bg-warm-white px-3 py-2 text-sm text-ink-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
                        >
                          {roomTypes.length === 0 && <option value="">Cargando...</option>}
                          {roomTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} · hasta {t.capacity} {t.capacity === 1 ? 'persona' : 'personas'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-ink-2">Habitacion fisica</label>
                        <select
                          value={confirmRoomId}
                          onChange={(e) => setConfirmRoomId(e.target.value)}
                          className="flex w-full rounded-md border border-warm-line-strong bg-warm-white px-3 py-2 text-sm text-ink-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
                        >
                          <option value="">Sin asignar (decidir en check-in)</option>
                          {candidateRoomsForConfirm.map((r) => {
                            // 'libre' = not held by any other active reservation in those dates.
                            // The current reservation's own roomId always renders as available.
                            const isCurrentRoom = r.id === reservation.roomId;
                            const isFree = isCurrentRoom || availableRoomIds.has(r.id);
                            return (
                              <option key={r.id} value={r.id} disabled={!isFree}>
                                Habitacion {r.number} · piso {r.floor}{' '}
                                {isFree ? '· libre' : '· ocupada'}
                              </option>
                            );
                          })}
                        </select>
                        {candidateRoomsForConfirm.length === 0 && confirmRoomTypeId && (
                          <p className="text-xs text-ink-3">
                            No hay habitaciones activas de este tipo.
                          </p>
                        )}
                      </div>

                      {confirmError && (
                        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                          {confirmError}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={handleConfirmAndAssign}
                          disabled={
                            !canConfirm ||
                            updateReservation.isPending ||
                            confirmRequest.isPending
                          }
                          className="flex-1 bg-green-600 text-white hover:bg-green-700"
                        >
                          {updateReservation.isPending || confirmRequest.isPending
                            ? 'Confirmando...'
                            : confirmRoomId
                              ? '✓ Confirmar y asignar habitacion'
                              : '✓ Confirmar (sin asignar)'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            const reason = window.prompt('Motivo del rechazo (opcional):');
                            if (reason !== null) {
                              rejectRequest.mutate({ reason: reason || undefined });
                            }
                          }}
                          disabled={rejectRequest.isPending}
                          className="flex-1 text-red-700 border-red-200 hover:bg-red-50"
                        >
                          {rejectRequest.isPending ? 'Rechazando...' : '✕ Rechazar'}
                        </Button>
                      </div>
                    </div>
                  );
                })()}

                {/* Cancel button — hidden for PENDING because 'Rechazar' in the
                    confirm-flow block already moves the reservation to CANCELLED.
                    Showing both would be redundant and confusing (and led to
                    accidental cancellations during user testing). */}
                {reservation.status !== 'CANCELLED' && reservation.status !== 'PENDING' && (
                  <div title={disabledTooltip}>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!canModify}
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancelar reserva
                    </Button>
                  </div>
                )}

                {/* Reactivate button — only for CANCELLED reservations so an admin
                    can recover from an accidental cancellation or re-open a
                    request the guest reconfirmed by phone. Sends the reservation
                    back to PENDING; admin then confirms + assigns room as usual. */}
                {reservation.status === 'CANCELLED' && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-ink-3">
                      Esta reserva fue cancelada. Puedes reactivarla como solicitud
                      pendiente si el huésped reconfirmó o fue un error.
                    </p>
                    <Button
                      type="button"
                      onClick={() => reactivateReservation.mutate()}
                      disabled={reactivateReservation.isPending}
                      className="w-full bg-mustard text-ink-1 hover:bg-mustard-soft"
                    >
                      {reactivateReservation.isPending
                        ? 'Reactivando...'
                        : '↻ Reactivar como pendiente'}
                    </Button>
                  </div>
                )}

                {genericError && (
                  <p className="text-xs text-status-in-progress bg-red-50 border border-red-200 rounded px-3 py-2">
                    {genericError}
                  </p>
                )}
              </div>
            )}

            {/* Cancel confirmation dialog */}
            {showCancelConfirm && (
              <div className="border border-red-200 bg-red-50 rounded-lg p-4 flex flex-col gap-3">
                <p className="text-sm text-red-700 font-medium">
                  ¿Confirmar cancelación?
                </p>
                <p className="text-xs text-red-600">
                  La reserva quedará con estado CANCELADA. No se eliminará el registro.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1"
                  >
                    Mantener
                  </Button>
                  <Button
                    type="button"
                    disabled={cancelReservation.isPending}
                    onClick={handleCancelReservation}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-600"
                  >
                    {cancelReservation.isPending ? 'Cancelando...' : 'Sí, cancelar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Huésped tab ── */}
        {activeTab === 'huesped' && reservation.guest && (
          <div className="border border-warm-line rounded-lg divide-y divide-warm-line">
            {[
              { label: 'Nombre', value: reservation.guest.fullName },
              { label: 'Email', value: reservation.guest.email ?? '—' },
              { label: 'Teléfono', value: reservation.guest.phone ?? '—' },
              { label: 'Tipo documento', value: reservation.guest.documentType },
              {
                label: 'Nacionalidad',
                value: reservation.guest.nationality,
              },
              { label: 'Fecha nacimiento', value: reservation.guest.dateOfBirth },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-3 flex justify-between text-sm">
                <span className="text-ink-2">{label}</span>
                <span className="text-ink-1 font-medium text-right truncate max-w-[55%]">
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Cobros tab (Phase 04 placeholder) ── */}
        {activeTab === 'cobros' && (
          <EmptyTabPlaceholder message="Próximamente" />
        )}
      </div>
    </>
  );
}

// ─── Main drawer export ───────────────────────────────────────────────────────

/**
 * ReservationDrawer — inline fixed-panel drawer for viewing + modifying + cancelling reservations.
 *
 * Follows the RoomDrawer.tsx pattern exactly.
 * Tabs: Detalles | Huésped | Cobros (Phase 04 placeholder)
 *
 * CRITICAL:
 * - Never deletes reservations — cancel sets status to CANCELLED only (RES-03)
 * - Modify and Cancel disabled for CHECKED_IN/CHECKED_OUT/CANCELLED/NO_SHOW
 * - Date safety: toLocalISODate() prevents UTC-5 off-by-one (Pitfall P6)
 * - Inline fixed-panel pattern — not imported from shadcn
 */
export function ReservationDrawer({ reservationId, onClose }: ReservationDrawerProps) {
  if (!reservationId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-1/40 z-[90]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de reserva"
        className="fixed right-0 top-0 h-full w-full max-w-[600px] bg-warm-white border-l border-warm-line shadow-2xl z-[100] flex flex-col overflow-y-auto"
      >
        <ReservationDrawerContent
          reservationId={reservationId}
          onClose={onClose}
        />
      </div>
    </>
  );
}
