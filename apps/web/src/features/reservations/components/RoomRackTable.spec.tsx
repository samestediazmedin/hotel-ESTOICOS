/**
 * RoomRackTable.spec.tsx — drag-to-move MVP (OBS-005) + Extension A/B
 *
 * Tests:
 *   computeNewDates (4):
 *     1. preserves stay duration when moved
 *     2. preserves 1-night stay (minimum)
 *     3. preserves 7-night stay moved backwards
 *     4. handles month boundary
 *   computeResizedDates (2):
 *     5. extends stay by 2 days
 *     6. refuses shrink below 1 night
 *   RoomRackTable — drag-to-move (2):
 *     7. calls onMoveReservation with preserved 3-night duration on drop
 *     8. does NOT call on drop at original cell
 *   RoomRackTable — Extension A cross-row (1):
 *     9. cross-row drag passes different targetRoomId
 *   RoomRackTable — Extension B resize (1):
 *     10. drag from resize handle triggers resize, not move
 *   RoomRackTable — status legend (2):
 *     11. legend renders with all 6 status labels
 *     12. legend swatches have background-color set
 *   RoomRackTable — improved tooltip (2):
 *     13. chip has accessible aria-label with guest + dates + nights + status
 *     14. tooltip includes night count and Spanish status label
 *   RoomRackTable — click-to-open (2):
 *     15. clicking a chip calls onEventClick with the reservation id
 *     16. click does NOT trigger onMoveReservation (click != drag)
 *   RoomRackTable — short block initials (1):
 *     17. 1-night block shows guest initials instead of full name
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import {
  computeNewDates,
  computeResizedDates,
  RoomRackTable,
  RESERVATION_STATUS_LABELS,
} from './RoomRackTable';
import type { RoomRackRoom, MoveReservationArgs } from './RoomRackTable';
import type { ReservationResponseDto } from '../reservations.api';

// ─── Unit tests: computeNewDates ──────────────────────────────────────────────

describe('computeNewDates', () => {
  it('preserves a 4-night stay when moved to a new start date', () => {
    const result = computeNewDates(
      { originalCheckIn: '2026-06-01', originalCheckOut: '2026-06-05' },
      '2026-06-10',
    );
    expect(result.newCheckIn).toBe('2026-06-10');
    expect(result.newCheckOut).toBe('2026-06-14');
  });

  it('preserves a 1-night stay (minimum)', () => {
    const result = computeNewDates(
      { originalCheckIn: '2026-06-01', originalCheckOut: '2026-06-02' },
      '2026-06-20',
    );
    expect(result.newCheckIn).toBe('2026-06-20');
    expect(result.newCheckOut).toBe('2026-06-21');
  });

  it('preserves a 7-night stay when moved backwards', () => {
    const result = computeNewDates(
      { originalCheckIn: '2026-06-10', originalCheckOut: '2026-06-17' },
      '2026-06-03',
    );
    expect(result.newCheckIn).toBe('2026-06-03');
    expect(result.newCheckOut).toBe('2026-06-10');
  });

  it('handles month boundary correctly (June → July)', () => {
    const result = computeNewDates(
      { originalCheckIn: '2026-06-28', originalCheckOut: '2026-07-02' },
      '2026-06-30',
    );
    expect(result.newCheckIn).toBe('2026-06-30');
    expect(result.newCheckOut).toBe('2026-07-04');
  });
});

// ─── Unit tests: computeResizedDates ─────────────────────────────────────────

describe('computeResizedDates', () => {
  it('extends a 3-night stay by 2 days when handle is dropped on a later date', () => {
    const result = computeResizedDates(
      { originalCheckIn: '2026-06-01', originalCheckOut: '2026-06-04' },
      '2026-06-06', // new check-out
    );
    expect(result.newCheckIn).toBe('2026-06-01');
    expect(result.newCheckOut).toBe('2026-06-06');
  });

  it('refuses to shrink below 1 night — clamps check-out to checkIn + 1 day', () => {
    // Dropping handle on same day as check-in (0 nights) → clamps to 1 night
    const result = computeResizedDates(
      { originalCheckIn: '2026-06-05', originalCheckOut: '2026-06-08' },
      '2026-06-05', // would be 0 nights — must clamp
    );
    expect(result.newCheckIn).toBe('2026-06-05');
    expect(result.newCheckOut).toBe('2026-06-06'); // minimum: +1 day
  });
});

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const ROOM: RoomRackRoom = {
  id: 'room-1',
  number: '101',
  floor: 1,
  roomTypeId: 'rt-1',
  roomType: { id: 'rt-1', name: 'Standard', basePrice: 100 },
  isActive: true,
};

const ROOM_2: RoomRackRoom = {
  id: 'room-2',
  number: '102',
  floor: 1,
  roomTypeId: 'rt-1',
  roomType: { id: 'rt-1', name: 'Standard', basePrice: 100 },
  isActive: true,
};

const RESERVATION: ReservationResponseDto = {
  id: 'res-1',
  checkInDate: '2026-06-01',
  checkOutDate: '2026-06-04', // 3 nights
  status: 'CONFIRMED',
  source: 'DIRECT',
  adults: 2,
  totalNights: 3,
  guestId: 'guest-1',
  guest: {
    id: 'guest-1',
    fullName: 'Ana Torres',
    email: 'ana@example.com',
    phone: null,
    documentType: 'CC',
    nationality: 'CO',
    dateOfBirth: '1990-01-01',
  },
  roomId: 'room-1',
  room: {
    id: 'room-1',
    number: '101',
    floor: 1,
    roomTypeId: 'rt-1',
    roomType: { id: 'rt-1', name: 'Standard', basePrice: 100 },
  },
  roomTypeId: 'rt-1',
  createdAt: '2026-01-01T00:00:00Z',
};

/**
 * Build a 7-day window starting 2026-06-01.
 */
function renderTable(
  onMoveReservation: (args: MoveReservationArgs) => void,
  extraRooms: RoomRackRoom[] = [],
) {
  return render(
    <RoomRackTable
      rooms={[ROOM, ...extraRooms]}
      reservations={[RESERVATION]}
      windowStart={new Date('2026-06-01T00:00:00.000Z')}
      windowDays={7}
      onEmptyCellClick={vi.fn()}
      onEventClick={vi.fn()}
      onMoveReservation={onMoveReservation}
    />,
  );
}

// ─── Integration tests: drag-to-move (same row) ───────────────────────────────

describe('RoomRackTable — drag-to-move', () => {
  it('calls onMoveReservation with preserved 3-night duration when dropped on a different cell', () => {
    const onMove = vi.fn();
    const { container } = renderTable(onMove);

    // Find the event chip (the draggable button for the reservation)
    const chip = container.querySelector('[data-status="CONFIRMED"]') as HTMLButtonElement;
    expect(chip).not.toBeNull();

    // Simulate dragstart on the chip
    fireEvent.dragStart(chip, {
      dataTransfer: {
        setData: (type: string, value: string) => {
          (chip as HTMLButtonElement & { _dt?: Record<string, string> })._dt =
            (chip as HTMLButtonElement & { _dt?: Record<string, string> })._dt ?? {};
          ((chip as HTMLButtonElement & { _dt?: Record<string, string> })._dt as Record<string, string>)[type] = value;
        },
        effectAllowed: 'move',
      },
    });

    // Find all day cells for room-1. The window has 7 days: indices 0-6.
    // Day cell for 2026-06-04 is at index 3 (0-based from check-in).
    // We use data attributes from aria-label to locate the target cell's button.
    const targetCellButton = container.querySelector(
      '[aria-label="Crear reserva en 2026-06-04 para habitación 101"]',
    )?.parentElement;
    expect(targetCellButton).not.toBeNull();

    // Build a synthetic dataTransfer with the payload from handleDragStart
    const payload = JSON.stringify({
      reservationId: 'res-1',
      originalCheckIn: '2026-06-01',
      originalCheckOut: '2026-06-04',
      sourceRoomId: 'room-1',
      dragKind: 'move',
    });

    fireEvent.dragOver(targetCellButton!, {
      dataTransfer: { dropEffect: 'move' },
    });

    fireEvent.drop(targetCellButton!, {
      dataTransfer: {
        getData: (type: string) => (type === 'application/json' ? payload : ''),
      },
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith({
      reservationId: 'res-1',
      newCheckIn: '2026-06-04',
      newCheckOut: '2026-06-07', // 3 nights preserved
      targetRoomId: 'room-1',
    });
  });

  it('does NOT call onMoveReservation when dropped on the original check-in cell', () => {
    const onMove = vi.fn();
    const { container } = renderTable(onMove);

    // Drop on the original check-in cell (2026-06-01 / room-1)
    const originalCellButton = container.querySelector(
      '[aria-label="Crear reserva en 2026-06-01 para habitación 101"]',
    )?.parentElement;
    expect(originalCellButton).not.toBeNull();

    const payload = JSON.stringify({
      reservationId: 'res-1',
      originalCheckIn: '2026-06-01',
      originalCheckOut: '2026-06-04',
      sourceRoomId: 'room-1',
      dragKind: 'move',
    });

    fireEvent.drop(originalCellButton!, {
      dataTransfer: {
        getData: (type: string) => (type === 'application/json' ? payload : ''),
      },
    });

    expect(onMove).not.toHaveBeenCalled();
  });
});

// ─── Integration tests: Extension A — cross-row drag ─────────────────────────

describe('RoomRackTable — Extension A: cross-row drag', () => {
  it('calls onMoveReservation with targetRoomId different from sourceRoomId on cross-row drop', () => {
    const onMove = vi.fn();
    // Render with two rooms so room-2 row exists
    const { container } = renderTable(onMove, [ROOM_2]);

    // Payload pretends we are dragging from room-1
    const payload = JSON.stringify({
      reservationId: 'res-1',
      originalCheckIn: '2026-06-01',
      originalCheckOut: '2026-06-04',
      sourceRoomId: 'room-1',
      dragKind: 'move',
    });

    // Drop on 2026-06-03 in room-2 (cross-row)
    const targetCell = container.querySelector(
      '[aria-label="Crear reserva en 2026-06-03 para habitación 102"]',
    )?.parentElement;
    expect(targetCell).not.toBeNull();

    fireEvent.drop(targetCell!, {
      dataTransfer: {
        getData: (type: string) => (type === 'application/json' ? payload : ''),
      },
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    const args = onMove.mock.calls[0][0] as MoveReservationArgs;
    expect(args.targetRoomId).toBe('room-2');
    expect(args.targetRoomId).not.toBe('room-1'); // confirmed cross-room
    expect(args.newCheckIn).toBe('2026-06-03');
    expect(args.newCheckOut).toBe('2026-06-06'); // 3 nights preserved
  });
});

// ─── Regression: guestless reservation renders fallback "—" without crashing ──
//
// Root cause (2026-05-29): RESERVATION_SELECT in reservations.repository.ts was
// missing `guest` and `room` relations. The API returned `guest: undefined`.
// RoomRackTable read `resStartingHere.guest.fullName` without `?.`, crashing the
// admin UI. Fix: added `?.` guard + "—" fallback; also fixed the repository SELECT.

describe('RoomRackTable — guestless reservation regression', () => {
  it('renders "—" fallback without throwing when reservation.guest is undefined', () => {
    // Simulate the pre-fix API response: guest relation absent at runtime.
    // We cast to bypass TypeScript so we can test the actual runtime guard.
    const guestlessReservation = {
      ...RESERVATION,
      guest: undefined,
    } as unknown as ReservationResponseDto;

    expect(() => {
      render(
        <RoomRackTable
          rooms={[ROOM]}
          reservations={[guestlessReservation]}
          windowStart={new Date('2026-06-01T00:00:00.000Z')}
          windowDays={7}
          onEmptyCellClick={vi.fn()}
          onEventClick={vi.fn()}
          onMoveReservation={vi.fn()}
        />,
      );
    }).not.toThrow();
  });

  it('chip for guestless reservation shows "—" as the guest name', () => {
    const guestlessReservation = {
      ...RESERVATION,
      guest: undefined,
    } as unknown as ReservationResponseDto;

    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[guestlessReservation]}
        windowStart={new Date('2026-06-01T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
        onMoveReservation={vi.fn()}
      />,
    );

    const chip = container.querySelector('[data-status="CONFIRMED"]');
    expect(chip).not.toBeNull();
    // The chip text and the title attribute both fall back to "—"
    expect(chip?.textContent).toContain('—');
    expect(chip?.getAttribute('title')).toContain('—');
  });
});

// ─── Integration tests: Extension B — drag-to-resize ─────────────────────────

describe('RoomRackTable — Extension B: drag-to-resize', () => {
  it('drag from resize handle triggers resize (dragKind=resize), not move', () => {
    const onMove = vi.fn();
    const { container } = renderTable(onMove);

    // A resize drag payload (sourceRoomId stays room-1, dragKind='resize')
    const resizePayload = JSON.stringify({
      reservationId: 'res-1',
      originalCheckIn: '2026-06-01',
      originalCheckOut: '2026-06-04',
      sourceRoomId: 'room-1',
      dragKind: 'resize',
    });

    // Drop the resize payload on 2026-06-06 (extending by 2 nights)
    const targetCell = container.querySelector(
      '[aria-label="Crear reserva en 2026-06-06 para habitación 101"]',
    )?.parentElement;
    expect(targetCell).not.toBeNull();

    fireEvent.drop(targetCell!, {
      dataTransfer: {
        getData: (type: string) => (type === 'application/json' ? resizePayload : ''),
      },
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    const args = onMove.mock.calls[0][0] as MoveReservationArgs;
    // Resize: checkIn unchanged, checkOut extended
    expect(args.newCheckIn).toBe('2026-06-01');  // original — NOT moved
    expect(args.newCheckOut).toBe('2026-06-06'); // extended by 2 nights
    expect(args.targetRoomId).toBe('room-1');    // room never changes on resize
  });
});

// ─── Regression: date normalisation — full ISO datetime checkInDate ───────────
//
// Root cause (2026-05-29): Prisma @db.Date fields serialize as full ISO datetime
// strings over HTTP ("2026-05-27T00:00:00.000Z").  The cell-match comparison used
// strict equality against the YYYY-MM-DD date column string, so it was always
// false and no reservation block was ever rendered.
// Fix: ymd() helper normalises both sides to "YYYY-MM-DD" before comparing.

describe('RoomRackTable — date normalisation (ISO datetime regression)', () => {
  it('renders the reservation chip when checkInDate is a full ISO datetime string', () => {
    // Simulate the API response format: Prisma @db.Date → "2026-06-01T00:00:00.000Z"
    const isoDatetimeReservation: ReservationResponseDto = {
      ...RESERVATION,
      checkInDate: '2026-06-01T00:00:00.000Z',  // full ISO — the bug trigger
      checkOutDate: '2026-06-04T00:00:00.000Z',
    };

    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[isoDatetimeReservation]}
        windowStart={new Date('2026-06-01T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
        onMoveReservation={vi.fn()}
      />,
    );

    // The chip must be present — before the fix it was always absent
    const chip = container.querySelector('[data-testid="rack-event-chip"]');
    expect(chip).not.toBeNull();
    // And it must show the guest name
    expect(chip?.textContent).toContain('Ana Torres');
  });

  it('chip title normalises dates — no raw ISO datetime fragments in tooltip', () => {
    const isoDatetimeReservation: ReservationResponseDto = {
      ...RESERVATION,
      checkInDate: '2026-06-01T00:00:00.000Z',
      checkOutDate: '2026-06-04T00:00:00.000Z',
    };

    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[isoDatetimeReservation]}
        windowStart={new Date('2026-06-01T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
        onMoveReservation={vi.fn()}
      />,
    );

    const chip = container.querySelector('[data-testid="rack-event-chip"]');
    expect(chip).not.toBeNull();
    const title = chip?.getAttribute('title') ?? '';
    // Title should use human-readable dates, not the raw datetime string
    expect(title).toContain('Ana Torres');
    expect(title).not.toContain('T00:00:00.000Z');
    // Should contain night count and status
    expect(title).toContain('3 noches');
    expect(title).toContain('Confirmada');
  });
});

// ─── Regression: left-edge clipping — reservation started before window ───────
//
// A reservation with checkIn before windowStart but checkOut within or after
// the window must render a clipped block at the first visible column (dateIndex 0).
// Before Fix 2 it was invisible because no cell ever matched its checkIn date.

describe('RoomRackTable — left-edge clipping', () => {
  it('renders a clipped block at column 0 for a reservation that started before the window', () => {
    // Window: 2026-06-05 → 2026-06-11 (7 days)
    // Reservation: 2026-05-30 → 2026-06-08 (active in window, started before it)
    const earlyReservation: ReservationResponseDto = {
      ...RESERVATION,
      id: 'res-early',
      checkInDate: '2026-05-30',
      checkOutDate: '2026-06-08',
    };

    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[earlyReservation]}
        windowStart={new Date('2026-06-05T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
        onMoveReservation={vi.fn()}
      />,
    );

    // Must render exactly one chip
    const chips = container.querySelectorAll('[data-testid="rack-event-chip"]');
    expect(chips).toHaveLength(1);

    // The chip must be marked as clipped
    expect(chips[0].getAttribute('data-clipped')).toBe('true');

    // And show the guest name
    expect(chips[0].textContent).toContain('Ana Torres');
  });

  it('does NOT render a clipped block when the reservation ended before the window', () => {
    // Reservation ends before window starts — should be invisible
    const expiredReservation: ReservationResponseDto = {
      ...RESERVATION,
      id: 'res-expired',
      checkInDate: '2026-05-20',
      checkOutDate: '2026-06-04', // checkOut <= windowStart (2026-06-05)
    };

    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[expiredReservation]}
        windowStart={new Date('2026-06-05T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
        onMoveReservation={vi.fn()}
      />,
    );

    const chips = container.querySelectorAll('[data-testid="rack-event-chip"]');
    expect(chips).toHaveLength(0);
  });

  it('a reservation fully inside the window is NOT clipped and renders once only', () => {
    // Window: 2026-06-01 → 2026-06-07. Reservation: 2026-06-02 → 2026-06-05 (inside)
    const insideReservation: ReservationResponseDto = {
      ...RESERVATION,
      id: 'res-inside',
      checkInDate: '2026-06-02',
      checkOutDate: '2026-06-05',
    };

    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[insideReservation]}
        windowStart={new Date('2026-06-01T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
        onMoveReservation={vi.fn()}
      />,
    );

    // Exactly one chip — no double render
    const chips = container.querySelectorAll('[data-testid="rack-event-chip"]');
    expect(chips).toHaveLength(1);

    // Not clipped
    expect(chips[0].getAttribute('data-clipped')).toBeNull();
  });

  it('left-edge clipping works with full ISO datetime checkInDate strings too', () => {
    // Combines both fixes: early start AND full datetime format
    const earlyISOReservation: ReservationResponseDto = {
      ...RESERVATION,
      id: 'res-early-iso',
      checkInDate: '2026-05-30T00:00:00.000Z',
      checkOutDate: '2026-06-08T00:00:00.000Z',
    };

    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[earlyISOReservation]}
        windowStart={new Date('2026-06-05T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
        onMoveReservation={vi.fn()}
      />,
    );

    const chips = container.querySelectorAll('[data-testid="rack-event-chip"]');
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute('data-clipped')).toBe('true');
  });
});

// ─── Status legend ──────────────────────────────────────────────────────────

describe('RoomRackTable — status legend', () => {
  it('renders the legend with all 6 reservation status labels in Spanish', () => {
    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[RESERVATION]}
        windowStart={new Date('2026-06-01T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    const legend = container.querySelector('[data-testid="rack-legend"]');
    expect(legend).not.toBeNull();

    // All 6 status labels must be present
    const expectedLabels = Object.values(RESERVATION_STATUS_LABELS);
    for (const label of expectedLabels) {
      expect(legend?.textContent).toContain(label);
    }
  });

  it('legend swatches have a background-color applied via inline style', () => {
    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[]}
        windowStart={new Date('2026-06-01T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    const swatches = container.querySelectorAll('[data-testid="rack-legend-swatch"]');
    expect(swatches).toHaveLength(6);

    // Every swatch has a background-color set
    for (const swatch of swatches) {
      const style = (swatch as HTMLElement).style.backgroundColor;
      expect(style).toBeTruthy();
    }
  });
});

// ─── Improved tooltip / aria-label ──────────────────────────────────────────

describe('RoomRackTable — improved tooltip', () => {
  it('chip has accessible aria-label with guest name, dates, night count, and status', () => {
    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[RESERVATION]}
        windowStart={new Date('2026-06-01T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    const chip = container.querySelector('[data-testid="rack-event-chip"]');
    expect(chip).not.toBeNull();

    const ariaLabel = chip?.getAttribute('aria-label') ?? '';
    // Must contain guest name, night count, and Spanish status label
    expect(ariaLabel).toContain('Ana Torres');
    expect(ariaLabel).toContain('3 noches');
    expect(ariaLabel).toContain('Confirmada');
  });

  it('tooltip for a 1-night reservation shows singular "noche"', () => {
    const oneNightRes: ReservationResponseDto = {
      ...RESERVATION,
      id: 'res-1n',
      checkInDate: '2026-06-02',
      checkOutDate: '2026-06-03', // 1 night
    };

    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[oneNightRes]}
        windowStart={new Date('2026-06-01T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    const chip = container.querySelector('[data-testid="rack-event-chip"]');
    expect(chip).not.toBeNull();
    const title = chip?.getAttribute('title') ?? '';
    expect(title).toContain('1 noche');
    expect(title).not.toContain('noches');
  });
});

// ─── Click-to-open (click vs drag discrimination) ───────────────────────────

describe('RoomRackTable — click-to-open', () => {
  it('clicking a chip calls onEventClick with the reservation id', () => {
    const onEvent = vi.fn();
    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[RESERVATION]}
        windowStart={new Date('2026-06-01T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={onEvent}
        onMoveReservation={vi.fn()}
      />,
    );

    const chip = container.querySelector('[data-testid="rack-event-chip"]') as HTMLButtonElement;
    expect(chip).not.toBeNull();

    // Simulate a click (no pointer travel → not a drag)
    fireEvent.pointerDown(chip, { clientX: 100, clientY: 50 });
    fireEvent.pointerUp(chip);
    fireEvent.click(chip);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith('res-1');
  });

  it('click does NOT trigger onMoveReservation', () => {
    const onEvent = vi.fn();
    const onMove = vi.fn();
    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[RESERVATION]}
        windowStart={new Date('2026-06-01T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={onEvent}
        onMoveReservation={onMove}
      />,
    );

    const chip = container.querySelector('[data-testid="rack-event-chip"]') as HTMLButtonElement;
    expect(chip).not.toBeNull();

    fireEvent.pointerDown(chip, { clientX: 100, clientY: 50 });
    fireEvent.pointerUp(chip);
    fireEvent.click(chip);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onMove).not.toHaveBeenCalled();
  });
});

// ─── Short block initials ───────────────────────────────────────────────────

describe('RoomRackTable — short block display', () => {
  it('1-night block shows guest initials instead of full name', () => {
    const oneNightRes: ReservationResponseDto = {
      ...RESERVATION,
      id: 'res-1n',
      checkInDate: '2026-06-03',
      checkOutDate: '2026-06-04', // 1 night
      guest: {
        ...RESERVATION.guest!,
        fullName: 'Frank Sebastian',
      },
    };

    const { container } = render(
      <RoomRackTable
        rooms={[ROOM]}
        reservations={[oneNightRes]}
        windowStart={new Date('2026-06-01T00:00:00.000Z')}
        windowDays={7}
        onEmptyCellClick={vi.fn()}
        onEventClick={vi.fn()}
      />,
    );

    const chip = container.querySelector('[data-testid="rack-event-chip"]');
    expect(chip).not.toBeNull();
    // Short block shows initials "FS", not the truncated full name
    expect(chip?.textContent).toContain('FS');
    // Full name is still available in the tooltip
    expect(chip?.getAttribute('title')).toContain('Frank Sebastian');
  });
});
