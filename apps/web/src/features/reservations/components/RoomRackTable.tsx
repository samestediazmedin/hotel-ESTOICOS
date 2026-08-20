// schedule-x decision: fallback — @schedule-x/calendar v4.6.0 does not export
// a resource/timeline view creator (ResourceGrid is internal-only, no OSS createViewResource*).
// Using CSS Grid: rooms-as-rows × dates-as-columns with reservation blocks spanning nights.

import { useRef, useState } from 'react';
import { toLocalISODate } from '@/lib/date';
import { RESERVATION_STATUS_TO_CSS, type ReservationStatus } from '@/lib/status-colors';
import type { ReservationResponseDto } from '../reservations.api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoomRackRoom {
  id: string;
  number: string;
  floor: number;
  roomTypeId: string;
  roomType: { id: string; name: string; basePrice: number };
  isActive: boolean;
}

/** Payload transmitted via dataTransfer during a drag operation. */
export interface DragPayload {
  reservationId: string;
  originalCheckIn: string;  // "YYYY-MM-DD"
  originalCheckOut: string; // "YYYY-MM-DD"
  sourceRoomId: string;
  /** 'move' = drag entire chip; 'resize' = drag right-edge handle */
  dragKind: 'move' | 'resize';
}

/** Argument passed to onMoveReservation when a valid drop occurs. */
export interface MoveReservationArgs {
  reservationId: string;
  newCheckIn: string;   // "YYYY-MM-DD" — preserved duration from drop cell
  newCheckOut: string;  // "YYYY-MM-DD"
  /** Target room. May differ from source when a cross-row drag occurs. */
  targetRoomId: string;
}

interface RoomRackTableProps {
  rooms: RoomRackRoom[];
  reservations: ReservationResponseDto[];
  /** First day of the visible window */
  windowStart: Date;
  /** Number of days to display (default 30) */
  windowDays?: number;
  onEmptyCellClick: (date: string, roomId: string) => void;
  onEventClick: (reservationId: string) => void;
  /** Called when a drag-to-move or drag-to-resize completes with a valid new date. */
  onMoveReservation?: (args: MoveReservationArgs) => void;
}

// ─── Pure date helpers ────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function diffDays(from: string, to: string): number {
  // Normalise to date-only before appending the UTC midnight suffix so that
  // full ISO datetime strings ("2026-05-27T00:00:00.000Z") don't produce an
  // invalid date when we concatenate 'T00:00:00.000Z' a second time.
  return Math.round(
    (new Date(ymd(to) + 'T00:00:00.000Z').getTime() -
      new Date(ymd(from) + 'T00:00:00.000Z').getTime()) /
      86_400_000,
  );
}

/**
 * Normalise any date string to "YYYY-MM-DD" (date-only).
 * Handles both date-only strings ("2026-05-27") and full ISO datetime strings
 * ("2026-05-27T00:00:00.000Z") that Prisma @db.Date fields emit over HTTP.
 * Using slice(0,10) is safe: both formats share the same YYYY-MM-DD prefix.
 */
function ymd(d: string): string {
  return d.slice(0, 10);
}

/** Format a UTC millisecond timestamp as YYYY-MM-DD. */
function msToISODate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format a "YYYY-MM-DD" string as a short Spanish date: "27 may".
 * Uses UTC noon to avoid timezone-induced date shift.
 */
function shortDateEs(iso: string): string {
  const d = new Date(ymd(iso) + 'T12:00:00.000Z');
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Extract initials from a full name. "Frank Sebastian" → "FS", "Ana" → "A".
 */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/**
 * computeNewDates — given a drag payload and a target check-in date,
 * returns new check-in/check-out dates that preserve the original stay duration.
 *
 * Uses UTC-millisecond arithmetic to avoid timezone-induced off-by-one errors.
 * Exported for unit testing.
 */
export function computeNewDates(
  payload: Pick<DragPayload, 'originalCheckIn' | 'originalCheckOut'>,
  targetCheckIn: string,
): { newCheckIn: string; newCheckOut: string } {
  const duration = diffDays(payload.originalCheckIn, payload.originalCheckOut);
  // UTC-ms arithmetic: add duration days to target midnight UTC
  const targetMs = new Date(targetCheckIn + 'T00:00:00.000Z').getTime();
  const checkOutMs = targetMs + duration * 86_400_000;
  return { newCheckIn: targetCheckIn, newCheckOut: msToISODate(checkOutMs) };
}

/**
 * computeResizedDates — given a drag payload and a target cell date (the new
 * check-out day boundary), returns updated dates with a fixed check-in and a
 * new check-out.
 *
 * The target date is the cell on which the handle is dropped, which represents
 * the NEW check-out date. Minimum stay is 1 night: check-out cannot be on or
 * before check-in.
 *
 * Exported for unit testing.
 */
export function computeResizedDates(
  payload: Pick<DragPayload, 'originalCheckIn' | 'originalCheckOut'>,
  targetDate: string,
): { newCheckIn: string; newCheckOut: string } {
  const checkInMs = new Date(payload.originalCheckIn + 'T00:00:00.000Z').getTime();
  const targetMs  = new Date(targetDate + 'T00:00:00.000Z').getTime();

  // The handle is dropped onto the cell that becomes the last night occupied,
  // so check-out = targetDate + 1 day. Alternatively, if the user drops on the
  // cell to the right of the last occupied column, check-out = targetDate.
  // Convention chosen: targetDate IS the new check-out date (the day guests leave).
  // Minimum: newCheckOut must be at least originalCheckIn + 1 day.
  const minCheckOutMs = checkInMs + 86_400_000;
  const clampedMs = Math.max(targetMs, minCheckOutMs);

  return {
    newCheckIn: payload.originalCheckIn,
    newCheckOut: msToISODate(clampedMs),
  };
}

// ─── Status legend labels (Spanish) ──────────────────────────────────────────

/** Maps reservation status to its human-readable Spanish label. Exported for tests. */
export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING:     'Pendiente',
  CONFIRMED:   'Confirmada',
  CHECKED_IN:  'Hospedado',
  CHECKED_OUT: 'Check-out',
  CANCELLED:   'Cancelada',
  NO_SHOW:     'No-show',
};

/**
 * Order in which legend swatches are displayed — mirrors the typical reservation lifecycle.
 */
const LEGEND_ORDER: ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
];

// ─── Drag threshold constant ─────────────────────────────────────────────────

/** Minimum pixel distance the pointer must move to be considered a drag, not a click. */
const DRAG_CLICK_THRESHOLD = 4;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * RoomRackTable — CSS Grid room rack calendar.
 *
 * Layout: rooms as rows × dates as columns.
 * grid-template-columns: 160px repeat(windowDays, minmax(48px, 1fr))
 *
 * Reservation blocks use grid-column: {checkInDayIndex + 2} / span {totalNights}
 * so they visually span the correct date columns.
 *
 * This is NOT a flat list or month grid — it satisfies SC-06 (rooms-as-rows × dates-as-columns).
 *
 * OBS-005: HTML5 drag-to-move. Supports same-row and cross-row drags.
 * Extension A: cross-row drag sends roomId in mutation payload when source !== target.
 * Extension B: resize handle on right edge changes checkOutDate while preserving checkInDate.
 */
export function RoomRackTable({
  rooms,
  reservations,
  windowStart,
  windowDays = 30,
  onEmptyCellClick,
  onEventClick,
  onMoveReservation,
}: RoomRackTableProps) {
  // ─── DnD state ──────────────────────────────────────────────────────────────
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** Tracks whether the active drag is a 'move' or a 'resize'. */
  const [dragKind, setDragKind] = useState<'move' | 'resize' | null>(null);
  // Cell key format: `${roomId}::${dateISO}`
  const [hoverCellKey, setHoverCellKey] = useState<string | null>(null);

  // Track mousedown origin to distinguish click from drag (pointer travel < threshold = click)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);

  // Build the array of dates for the visible window
  const dates: string[] = [];
  for (let i = 0; i < windowDays; i++) {
    dates.push(toLocalISODate(addDays(windowStart, i)));
  }

  // Compute grid-column positions for reservations
  const windowStartStr = toLocalISODate(windowStart);

  // Filter out reservations completely outside the window
  const windowEnd = toLocalISODate(addDays(windowStart, windowDays));

  const visibleReservations = reservations.filter(
    (r) => ymd(r.checkInDate) < windowEnd && ymd(r.checkOutDate) > windowStartStr,
  );

  // Grid column count = room label column (1) + one per day
  const totalColumns = 1 + windowDays;

  // Today string for column highlight
  const todayStr = toLocalISODate(new Date());

  // ─── DnD handlers ───────────────────────────────────────────────────────────

  function handleDragStart(
    e: React.DragEvent<HTMLButtonElement>,
    reservation: ReservationResponseDto,
    kind: 'move' | 'resize',
  ) {
    setDraggingId(reservation.id);
    setDragKind(kind);
    const payload: DragPayload = {
      reservationId: reservation.id,
      originalCheckIn: reservation.checkInDate,
      originalCheckOut: reservation.checkOutDate,
      // PENDING reservations have no roomId yet; guard prevents this handler from
      // even being attached (see button rendering), but we keep a safe fallback.
      sourceRoomId: reservation.roomId ?? '',
      dragKind: kind,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragKind(null);
    setHoverCellKey(null);
  }

  function handleDragOver(
    e: React.DragEvent<HTMLDivElement>,
    cellKey: string,
  ) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (hoverCellKey !== cellKey) {
      setHoverCellKey(cellKey);
    }
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // Only clear if leaving the cell entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setHoverCellKey(null);
    }
  }

  function handleDrop(
    e: React.DragEvent<HTMLDivElement>,
    targetDate: string,
    targetRoomId: string,
  ) {
    e.preventDefault();
    setHoverCellKey(null);
    setDraggingId(null);
    setDragKind(null);

    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;

    let payload: DragPayload;
    try {
      payload = JSON.parse(raw) as DragPayload;
    } catch {
      return;
    }

    if (payload.dragKind === 'resize') {
      // Resize: check-in is fixed, check-out is updated
      const { newCheckIn, newCheckOut } = computeResizedDates(payload, targetDate);

      // No-op: would produce the exact same dates
      if (newCheckOut === payload.originalCheckOut) return;

      onMoveReservation?.({
        reservationId: payload.reservationId,
        newCheckIn,
        newCheckOut,
        targetRoomId: payload.sourceRoomId, // room never changes on resize
      });
      return;
    }

    // ── move drag ────────────────────────────────────────────────────────────

    // No-op: dropped on the original check-in cell in the same room
    if (
      payload.originalCheckIn === targetDate &&
      payload.sourceRoomId === targetRoomId
    ) {
      return;
    }

    const { newCheckIn, newCheckOut } = computeNewDates(payload, targetDate);

    onMoveReservation?.({
      reservationId: payload.reservationId,
      newCheckIn,
      newCheckOut,
      // Extension A: pass the actual target room (may differ from source for cross-row drags)
      targetRoomId,
    });
  }

  // ─── Click vs drag discrimination ──────────────────────────────────────────

  function handleChipPointerDown(e: React.PointerEvent) {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;
  }

  function handleChipPointerMove(e: React.PointerEvent) {
    if (!pointerDownPos.current) return;
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    if (Math.abs(dx) + Math.abs(dy) > DRAG_CLICK_THRESHOLD) {
      didDrag.current = true;
    }
  }

  function handleChipPointerUp() {
    pointerDownPos.current = null;
  }

  function handleChipClick(e: React.MouseEvent, reservationId: string) {
    e.stopPropagation();
    // Only fire the click callback if the pointer didn't travel (i.e. not a drag)
    if (!didDrag.current) {
      onEventClick(reservationId);
    }
    didDrag.current = false;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* ── Status legend ── */}
      <div
        data-testid="rack-legend"
        className="flex items-center gap-4 px-3 py-2 bg-warm-cream/60 border border-warm-line rounded-lg"
      >
        <span className="text-xs font-medium text-ink-2 mr-1 shrink-0">
          Estado:
        </span>
        {LEGEND_ORDER.map((status) => (
          <div key={status} className="flex items-center gap-1.5 shrink-0">
            <span
              data-testid="rack-legend-swatch"
              className="inline-block w-3 h-3 rounded-sm shrink-0"
              style={{
                backgroundColor: RESERVATION_STATUS_TO_CSS[status],
                opacity: status === 'CANCELLED' ? 0.6 : status === 'NO_SHOW' ? 0.75 : 1,
              }}
            />
            <span className="text-[11px] text-ink-2 whitespace-nowrap">
              {RESERVATION_STATUS_LABELS[status]}
            </span>
          </div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className="overflow-x-auto rounded-lg border border-warm-line">
        <div
          data-testid="rack-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `160px repeat(${windowDays}, minmax(48px, 1fr))`,
            minWidth: `${160 + windowDays * 48}px`,
          }}
        >
          {/* ── Header row ── */}
          {/* Empty sticky-left header cell */}
          <div className="bg-warm-cream border-b border-r border-warm-line px-3 py-2 text-xs font-mono font-medium text-ink-2 sticky left-0 z-20">
            Habitación
          </div>

          {/* Date header cells */}
          {dates.map((date) => {
            const d = new Date(date + 'T12:00:00.000Z');
            const dayNum = d.toLocaleDateString('es-CO', {
              day: 'numeric',
              timeZone: 'UTC',
            });
            const monthAbbr = d.toLocaleDateString('es-CO', {
              month: 'short',
              timeZone: 'UTC',
            });
            const isToday = date === todayStr;
            return (
              <div
                key={date}
                data-testid={isToday ? 'rack-today-header' : undefined}
                className={`border-b border-r border-warm-line px-1 py-1 text-center z-10 ${
                  isToday ? 'bg-terracotta-tint' : 'bg-warm-cream'
                }`}
              >
                <span
                  className={`block font-mono text-xs font-semibold leading-none ${
                    isToday ? 'text-terracotta-deep' : 'text-ink-1'
                  }`}
                >
                  {dayNum}
                </span>
                <span className="block font-mono text-[10px] text-ink-3 leading-none mt-0.5">
                  {monthAbbr}
                </span>
              </div>
            );
          })}

          {/* ── Body rows — one per room ── */}
          {rooms.map((room) => {
            // Reservations for this specific room
            const roomReservations = visibleReservations.filter(
              (r) => r.roomId === room.id,
            );

            return (
              <div
                key={room.id}
                style={{
                  display: 'contents',
                }}
              >
                {/* Room label — sticky left */}
                <div className="border-b border-r border-warm-line px-3 py-2 bg-warm-white sticky left-0 z-10 flex flex-col justify-center">
                  <span className="font-mono text-sm text-ink-1 truncate">
                    {room.number}
                  </span>
                  <span className="text-[10px] text-ink-3 truncate">
                    {room.roomType.name}
                  </span>
                </div>

                {/* Day cells — relative container for reservation blocks */}
                {dates.map((date, dateIndex) => {
                  const cellKey = `${room.id}::${date}`;
                  const isHovered = hoverCellKey === cellKey;
                  // Show resize visual feedback when a resize drag is over this cell
                  const isResizeHover = isHovered && dragKind === 'resize';
                  const isTodayCol = date === todayStr;

                  // Fix 1: normalise to date-only before comparing — API sends full ISO
                  // datetime strings ("2026-05-27T00:00:00.000Z") for Prisma @db.Date fields.
                  const resStartingHere = roomReservations.find(
                    (r) => ymd(r.checkInDate) === date,
                  );

                  // Fix 2: left-edge clipping — a reservation that started before the
                  // visible window but is still active must render at the first column
                  // (dateIndex === 0).  It is mutually exclusive with resStartingHere:
                  // if checkIn < windowStart then ymd(checkIn) !== windowStartStr === date,
                  // so resStartingHere is always undefined when clippedRes is defined.
                  const clippedRes =
                    dateIndex === 0
                      ? roomReservations.find(
                          (r) =>
                            ymd(r.checkInDate) < windowStartStr &&
                            ymd(r.checkOutDate) > windowStartStr,
                        )
                      : undefined;

                  // The reservation to render in this cell (at most one of the two is set)
                  const resToRender = resStartingHere ?? clippedRes;
                  // Whether this block is a left-edge clip (started before window)
                  const isClipped = resToRender !== undefined && resToRender === clippedRes;

                  // Determine base cell background: today column gets a subtle tint
                  const baseBg = isTodayCol ? 'bg-terracotta-tint/30' : 'bg-warm-white';

                  return (
                    <div
                      key={cellKey}
                      data-testid="rack-cell"
                      data-today={isTodayCol ? 'true' : undefined}
                      className={`border-b border-r border-warm-line relative transition-colors ${
                        isResizeHover
                          ? 'bg-warm-cream outline outline-2 outline-dashed outline-terracotta z-[5]'
                          : isHovered
                          ? 'bg-warm-cream outline outline-2 outline-terracotta z-[5]'
                          : baseBg
                      }`}
                      style={{ minHeight: '48px' }}
                      onDragOver={
                        onMoveReservation
                          ? (e) => handleDragOver(e, cellKey)
                          : undefined
                      }
                      onDragLeave={
                        onMoveReservation ? handleDragLeave : undefined
                      }
                      onDrop={
                        onMoveReservation
                          ? (e) => handleDrop(e, date, room.id)
                          : undefined
                      }
                    >
                      {/* Empty cell click target */}
                      <button type="button"
                        className="absolute inset-0 w-full h-full hover:bg-warm-cream cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-terracotta"
                        onClick={() => onEmptyCellClick(date, room.id)}
                        aria-label={`Crear reserva en ${date} para habitación ${room.number}`}
                      />

                      {/* Reservation block — rendered inline, spans multiple columns via parent logic */}
                      {resToRender && (() => {
                        const isDragging = draggingId === resToRender.id;

                        // For clipped reservations the visible span starts at windowStart,
                        // not at the actual checkInDate.
                        const effectiveCheckIn = isClipped ? windowStartStr : ymd(resToRender.checkInDate);
                        const totalNights = Math.max(
                          1,
                          diffDays(
                            effectiveCheckIn,
                            resToRender.checkOutDate,
                          ),
                        );
                        // Clamp span to not exceed window
                        const clampedNights = Math.min(
                          totalNights,
                          windowDays - dateIndex,
                        );

                        // Derive opacity for special statuses per CONTEXT decision #8
                        const statusOpacity =
                          resToRender.status === 'CANCELLED'
                            ? 0.6
                            : resToRender.status === 'NO_SHOW'
                              ? 0.75
                              : 1;

                        // Guest display: full name, initials for short blocks, fallback "—"
                        const guestName = resToRender.guest?.fullName ?? '—';
                        const guestInitials = resToRender.guest
                          ? initials(resToRender.guest.fullName)
                          : '—';
                        const isShortBlock = clampedNights === 1;

                        // Human-friendly tooltip
                        const nights = diffDays(resToRender.checkInDate, resToRender.checkOutDate);
                        const statusLabel = RESERVATION_STATUS_LABELS[resToRender.status as ReservationStatus] ?? resToRender.status;
                        const tooltipText =
                          `${guestName} · ${shortDateEs(resToRender.checkInDate)} → ${shortDateEs(resToRender.checkOutDate)} · ${nights} ${nights === 1 ? 'noche' : 'noches'} · ${statusLabel}`;

                        return (
                          <button type="button"
                            key={resToRender.id}
                            data-testid="rack-event-chip"
                            data-status={resToRender.status}
                            data-clipped={isClipped ? 'true' : undefined}
                            draggable={!!onMoveReservation}
                            className={`absolute top-1.5 bottom-1.5 flex items-center text-warm-white text-[11px] font-semibold z-10 transition-all select-none overflow-hidden hover:brightness-110 hover:ring-2 hover:ring-terracotta/60 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-terracotta ${
                              // Clipped blocks have a flat left edge to signal they continue from before
                              isClipped ? 'rounded-r-md rounded-l-none left-0' : 'rounded-md left-0'
                            } ${
                              onMoveReservation
                                ? isDragging
                                  ? 'cursor-grabbing opacity-50'
                                  : 'cursor-grab'
                                : 'cursor-pointer'
                            }`}
                            style={{
                              // Color via CSS variable — dark mode compatible, zero hex
                              backgroundColor:
                                RESERVATION_STATUS_TO_CSS[resToRender.status as ReservationStatus]
                                ?? 'var(--ink-4)',
                              opacity: isDragging ? 0.5 : statusOpacity,
                              // Span across day cells: width = clampedNights cells minus a small gap
                              width: `calc(${clampedNights * 100}% + ${clampedNights - 1}px - 4px)`,
                              maxWidth: `calc(${clampedNights * 100}% + ${clampedNights - 1}px - 4px)`,
                              right: 'auto',
                            }}
                            onPointerDown={handleChipPointerDown}
                            onPointerMove={handleChipPointerMove}
                            onPointerUp={handleChipPointerUp}
                            onClick={(e) => handleChipClick(e, resToRender.id)}
                            onDragStart={
                              onMoveReservation
                                ? (e) => handleDragStart(e, resToRender, 'move')
                                : undefined
                            }
                            onDragEnd={
                              onMoveReservation ? handleDragEnd : undefined
                            }
                            title={tooltipText}
                            aria-label={tooltipText}
                          >
                            <span className={`truncate leading-tight ${isShortBlock ? 'px-0.5 text-[10px]' : 'px-2'}`}>
                              {isShortBlock ? guestInitials : guestName}
                            </span>

                            {/* ── Resize handle (Extension B) ───────────────────
                                Absolutely positioned on the right edge of the chip.
                                4-8px wide vertical strip. cursor: col-resize.
                                Drag from this handle emits dragKind='resize'.
                                stopPropagation prevents the parent chip from also
                                firing its own onDragStart. ─────────────────────*/}
                            {onMoveReservation && (
                              <div
                                data-testid="rack-event-resize-handle"
                                draggable
                                className="absolute top-0 right-0 h-full w-1.5 rounded-r-md cursor-col-resize z-20 hover:bg-white/30 active:bg-white/40"
                                style={{ minWidth: '6px' }}
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  handleDragStart(
                                    e as unknown as React.DragEvent<HTMLButtonElement>,
                                    resToRender,
                                    'resize',
                                  );
                                }}
                                onDragEnd={(e) => {
                                  e.stopPropagation();
                                  handleDragEnd();
                                }}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Ajustar duración de reserva ${resToRender.id}`}
                                role="separator"
                              />
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Empty state — no rooms */}
          {rooms.length === 0 && (
            <div
              style={{ gridColumn: `1 / span ${totalColumns}` }}
              className="p-8 text-center text-ink-3 text-sm border-b border-warm-line"
            >
              No hay habitaciones registradas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
