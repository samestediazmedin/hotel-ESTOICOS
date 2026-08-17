/**
 * ReservationsPage.spec.tsx — handleMoveReservation payload contract
 *
 * Tests:
 *   handleMoveReservation — cross-room drag (1):
 *     1. passes roomId: targetRoomId in mutate args when target room differs from source
 *   handleMoveReservation — same-room drag (1):
 *     2. does NOT include roomId in mutate args when target room equals source room
 *
 * Strategy: mount <ReservationsPage>, stub all heavy sub-components and hooks,
 * trigger onMoveReservation via the RoomRackCalendar prop, assert the mutation vars.
 *
 * NOTE: windowStart defaults to TODAY (new Date()). All reservation dates in mocks
 * must be within the 30-day window from today or the calendar won't render them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MoveReservationVars } from './reservations.api';

// ─── Date helpers (mirrors ReservationsPage logic) ────────────────────────────

function toLocalISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Compute dates relative to TODAY so they fall within the calendar's 30-day window
const TODAY = new Date();
const CHECK_IN = toLocalISODate(TODAY); // today
const CHECK_OUT = toLocalISODate(addDays(TODAY, 3)); // +3 days
const TARGET_DATE_CROSS = toLocalISODate(addDays(TODAY, 2)); // +2 days (cross-room)
const TARGET_DATE_SAME = toLocalISODate(addDays(TODAY, 3)); // +3 days (same-room)

// ─── Shared mutate spy (reset per test) ──────────────────────────────────────

const mutateSpy = vi.fn();

// ─── Mock: reservations.api ───────────────────────────────────────────────────

vi.mock('./reservations.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./reservations.api')>();
  return {
    ...actual,
    useReservations: vi.fn(() => ({
      data: [
        {
          id: 'res-1',
          checkInDate: CHECK_IN,
          checkOutDate: CHECK_OUT,
          status: 'CONFIRMED',
          source: 'DIRECT',
          adults: 2,
          totalNights: 3,
          guestId: 'guest-1',
          guest: {
            id: 'guest-1',
            fullName: 'Ana Torres',
            email: null,
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
        },
      ],
      isLoading: false,
    })),
    useAllRooms: vi.fn(() => ({
      data: [
        {
          id: 'room-1',
          number: '101',
          floor: 1,
          roomTypeId: 'rt-1',
          roomType: { id: 'rt-1', name: 'Standard', basePrice: 100 },
          isActive: true,
        },
        {
          id: 'room-2',
          number: '102',
          floor: 1,
          roomTypeId: 'rt-1',
          roomType: { id: 'rt-1', name: 'Standard', basePrice: 100 },
          isActive: true,
        },
      ],
      isLoading: false,
    })),
    useMoveReservation: vi.fn(() => ({ mutate: mutateSpy })),
  };
});

// ─── Mock: Zustand store (openWizard) ────────────────────────────────────────

vi.mock('./store/reservation-wizard.store', () => ({
  useReservationWizardStore: vi.fn((selector: (s: { openWizard: () => void }) => unknown) =>
    selector({ openWizard: vi.fn() }),
  ),
}));

// ─── Mock: heavy sub-components ──────────────────────────────────────────────

vi.mock('./wizard/ReservationWizard', () => ({
  ReservationWizard: () => null,
}));

vi.mock('./ReservationDrawer', () => ({
  ReservationDrawer: () => null,
}));

vi.mock('@/features/operations/CheckInDrawer', () => ({
  CheckInDrawer: () => null,
}));

vi.mock('@/features/operations/CheckOutConfirmDialog', () => ({
  CheckOutConfirmDialog: () => null,
}));

// ─── Mock: sonner toast ───────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

import { ReservationsPage } from './ReservationsPage';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReservationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReservationsPage — handleMoveReservation payload contract', () => {
  beforeEach(() => {
    mutateSpy.mockClear();
  });

  it('cross-room drag: mutate receives roomId: targetRoomId when target differs from source', () => {
    const { container } = renderPage();

    // Find the drop cell for room-2 / TARGET_DATE_CROSS in the rack grid
    const targetCell = container.querySelector(
      `[aria-label="Crear reserva en ${TARGET_DATE_CROSS} para habitación 102"]`,
    )?.parentElement;
    expect(targetCell).not.toBeNull();

    // Synthesise a cross-room drop: source is room-1, target is room-2
    const payload = JSON.stringify({
      reservationId: 'res-1',
      originalCheckIn: CHECK_IN,
      originalCheckOut: CHECK_OUT,
      sourceRoomId: 'room-1',
      dragKind: 'move',
    });

    fireEvent.drop(targetCell!, {
      dataTransfer: {
        getData: (type: string) => (type === 'application/json' ? payload : ''),
      },
    });

    expect(mutateSpy).toHaveBeenCalledTimes(1);
    const vars = mutateSpy.mock.calls[0][0] as MoveReservationVars;
    // The reservation must be moved to the new room
    expect(vars.id).toBe('res-1');
    expect(vars.checkInDate).toBe(TARGET_DATE_CROSS);
    expect(vars.checkOutDate).toBe(toLocalISODate(addDays(new Date(TARGET_DATE_CROSS + 'T00:00:00.000Z'), 3))); // 3-night duration preserved
    expect(vars.roomId).toBe('room-2');
  });

  it('same-room drag: mutate does NOT include roomId when target room equals source room', () => {
    const { container } = renderPage();

    // Drop on room-1 / TARGET_DATE_SAME — different date, same room
    const targetCell = container.querySelector(
      `[aria-label="Crear reserva en ${TARGET_DATE_SAME} para habitación 101"]`,
    )?.parentElement;
    expect(targetCell).not.toBeNull();

    const payload = JSON.stringify({
      reservationId: 'res-1',
      originalCheckIn: CHECK_IN,
      originalCheckOut: CHECK_OUT,
      sourceRoomId: 'room-1',
      dragKind: 'move',
    });

    fireEvent.drop(targetCell!, {
      dataTransfer: {
        getData: (type: string) => (type === 'application/json' ? payload : ''),
      },
    });

    expect(mutateSpy).toHaveBeenCalledTimes(1);
    const vars = mutateSpy.mock.calls[0][0] as MoveReservationVars;
    expect(vars.id).toBe('res-1');
    expect(vars.checkInDate).toBe(TARGET_DATE_SAME);
    expect(vars.checkOutDate).toBe(toLocalISODate(addDays(new Date(TARGET_DATE_SAME + 'T00:00:00.000Z'), 3))); // 3 nights
    // roomId must be absent — same-room drag should not trigger a room reassignment
    expect('roomId' in vars).toBe(false);
  });
});
