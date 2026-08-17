/**
 * CheckInDrawer.spec.tsx
 *
 * Covers:
 *   - Regression: guestless reservation crash (2026-05-29)
 *   - Dirty-room shortcut: ADMIN/MANAGER/HOUSEKEEPING see "Marcar habitación como lista"
 *     button when check-in fails with a DIRTY error; clicking it calls transitionRoom(INSPECTION)
 *     and then retries checkInReservation.
 *   - RECEPTION sees a text hint instead of the action button (no 403 confusion).
 *   - The shortcut does NOT appear for non-DIRTY check-in errors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CheckInDrawer } from './CheckInDrawer';
import type { ReservationResponseDto } from '@/features/reservations/reservations.api';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/features/operations/operations.api', () => ({
  checkInReservation: vi.fn(),
}));

vi.mock('@/features/housekeeping/housekeeping.api', () => ({
  housekeepingApi: {
    transitionRoom: vi.fn(),
    getBoard: vi.fn(),
    listTasks: vi.fn(),
    createTask: vi.fn(),
    updateTaskStatus: vi.fn(),
  },
}));

vi.mock('@/features/auth/auth.store', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: vi.fn((selector: (s: any) => unknown) =>
    selector({
      user: { id: 'u1', email: 'admin@test.com', role: 'ADMIN' },
      accessToken: 'tok',
      isRestoring: false,
      setAccessToken: vi.fn(),
      setUser: vi.fn(),
      setIsRestoring: vi.fn(),
      clearAuth: vi.fn(),
    }),
  ),
}));

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { checkInReservation } from '@/features/operations/operations.api';
import { housekeepingApi } from '@/features/housekeeping/housekeeping.api';
import { useAuthStore } from '@/features/auth/auth.store';

// ─── Error factory ────────────────────────────────────────────────────────────

function makeApiError(status: number, message: string) {
  return Object.assign(new Error(message), {
    response: { status, data: { message } },
  });
}

const DIRTY_ERROR = makeApiError(
  412,
  'Room 201 cleaningStatus is DIRTY. Must be CLEAN or INSPECTION before check-in.',
);

const OTHER_412_ERROR = makeApiError(
  412,
  'Reservation is not in CONFIRMED status.',
);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_RESERVATION: ReservationResponseDto = {
  id: 'res-checkin-001',
  checkInDate: '2026-07-01',
  checkOutDate: '2026-07-03',
  status: 'CONFIRMED',
  source: 'DIRECT',
  adults: 2,
  totalNights: 2,
  guestId: 'guest-001',
  guest: {
    id: 'guest-001',
    fullName: 'María López',
    email: 'maria@example.com',
    phone: '+573001234567',
    documentType: 'CC',
    nationality: 'CO',
    dateOfBirth: '1985-03-10',
  },
  roomId: 'room-001',
  room: {
    id: 'room-001',
    number: '201',
    floor: 2,
    roomTypeId: 'rt-001',
    roomType: { id: 'rt-001', name: 'Standard', basePrice: 200000 },
  },
  roomTypeId: 'rt-001',
  createdAt: '2026-01-01T00:00:00Z',
};

// ─── Render helper ────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

// ─── Auth store helpers ───────────────────────────────────────────────────────

function setRole(role: 'ADMIN' | 'MANAGER' | 'HOUSEKEEPING' | 'RECEPTION') {
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    selector({
      user: { id: 'u1', email: 'staff@test.com', role },
      accessToken: 'tok',
      isRestoring: false,
      setAccessToken: vi.fn(),
      setUser: vi.fn(),
      setIsRestoring: vi.fn(),
      clearAuth: vi.fn(),
    }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CheckInDrawer — guestless reservation regression (2026-05-29)', () => {
  // ── CI-1: normal render ───────────────────────────────────────────────────

  it('CI-1 — renders guest name in aria-label and subtitle when guest is present', () => {
    render(
      <CheckInDrawer reservation={BASE_RESERVATION} open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Check-in: María López');
    expect(screen.getByText(/María López — Hab\. 201/)).toBeDefined();
  });

  // ── CI-2: guestless reservation — does NOT throw ──────────────────────────

  it('CI-2 — renders fallback "—" without throwing when guest is undefined (regression guard)', () => {
    const guestlessReservation = {
      ...BASE_RESERVATION,
      guest: undefined,
    } as unknown as ReservationResponseDto;

    expect(() => {
      render(
        <CheckInDrawer reservation={guestlessReservation} open={true} onClose={vi.fn()} />,
        { wrapper: makeWrapper() },
      );
    }).not.toThrow();

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Check-in: —');
  });

  // ── CI-3: closed drawer renders nothing ───────────────────────────────────

  it('CI-3 — renders nothing when open=false', () => {
    const { container } = render(
      <CheckInDrawer reservation={BASE_RESERVATION} open={false} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    expect(container.firstChild).toBeNull();
  });

  // ── CI-4: null reservation renders nothing ────────────────────────────────

  it('CI-4 — renders nothing when reservation=null', () => {
    const { container } = render(
      <CheckInDrawer reservation={null} open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    expect(container.firstChild).toBeNull();
  });
});

// ─── Dirty-room shortcut ──────────────────────────────────────────────────────

describe('CheckInDrawer — dirty-room shortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRole('ADMIN');
  });

  // ── CID-1: ADMIN sees the shortcut button on DIRTY error ──────────────────

  it('CID-1 — ADMIN sees "Marcar habitación como lista" button when check-in fails with DIRTY error', async () => {
    vi.mocked(checkInReservation).mockRejectedValue(DIRTY_ERROR);

    render(
      <CheckInDrawer reservation={BASE_RESERVATION} open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );

    // Check all checkboxes so the Confirmar button becomes enabled
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Check-In' }));

    await waitFor(() => {
      expect(screen.getByTestId('mark-room-ready-btn')).toBeDefined();
    });

    // The error message from the backend should also be visible
    expect(screen.getByText(/DIRTY/)).toBeDefined();
  });

  // ── CID-2: MANAGER sees the shortcut button ───────────────────────────────

  it('CID-2 — MANAGER sees "Marcar habitación como lista" button on DIRTY error', async () => {
    setRole('MANAGER');
    vi.mocked(checkInReservation).mockRejectedValue(DIRTY_ERROR);

    render(
      <CheckInDrawer reservation={BASE_RESERVATION} open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Check-In' }));

    await waitFor(() => {
      expect(screen.getByTestId('mark-room-ready-btn')).toBeDefined();
    });
  });

  // ── CID-3: HOUSEKEEPING sees the shortcut button ──────────────────────────

  it('CID-3 — HOUSEKEEPING sees "Marcar habitación como lista" button on DIRTY error', async () => {
    setRole('HOUSEKEEPING');
    vi.mocked(checkInReservation).mockRejectedValue(DIRTY_ERROR);

    render(
      <CheckInDrawer reservation={BASE_RESERVATION} open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Check-In' }));

    await waitFor(() => {
      expect(screen.getByTestId('mark-room-ready-btn')).toBeDefined();
    });
  });

  // ── CID-4: clicking shortcut calls transitionRoom(INSPECTION) and retries check-in ──

  it('CID-4 — clicking the shortcut button calls transitionRoom(INSPECTION) and retries check-in', async () => {
    // First call: reject with DIRTY error. Second call (retry): resolve.
    vi.mocked(checkInReservation)
      .mockRejectedValueOnce(DIRTY_ERROR)
      .mockResolvedValueOnce(undefined as never);
    vi.mocked(housekeepingApi.transitionRoom).mockResolvedValue(undefined as never);

    const onClose = vi.fn();

    render(
      <CheckInDrawer reservation={BASE_RESERVATION} open={true} onClose={onClose} />,
      { wrapper: makeWrapper() },
    );

    // Enable confirm button
    screen.getAllByRole('checkbox').forEach((cb) => fireEvent.click(cb));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Check-In' }));

    // Wait for the shortcut button to appear
    await waitFor(() => {
      expect(screen.getByTestId('mark-room-ready-btn')).toBeDefined();
    });

    // Click the shortcut
    fireEvent.click(screen.getByTestId('mark-room-ready-btn'));

    // transitionRoom must be called with INSPECTION
    await waitFor(() => {
      expect(vi.mocked(housekeepingApi.transitionRoom)).toHaveBeenCalledWith(
        BASE_RESERVATION.roomId,
        'INSPECTION',
      );
    });

    // After transition succeeds, check-in is retried automatically
    await waitFor(() => {
      expect(vi.mocked(checkInReservation)).toHaveBeenCalledTimes(2);
    });
  });

  // ── CID-5: RECEPTION does NOT see the button — sees the text hint ─────────

  it('CID-5 — RECEPTION sees text hint instead of the shortcut button on DIRTY error', async () => {
    setRole('RECEPTION');
    vi.mocked(checkInReservation).mockRejectedValue(DIRTY_ERROR);

    render(
      <CheckInDrawer reservation={BASE_RESERVATION} open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );

    screen.getAllByRole('checkbox').forEach((cb) => fireEvent.click(cb));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Check-In' }));

    await waitFor(() => {
      expect(screen.getByTestId('dirty-reception-hint')).toBeDefined();
    });

    // The action button must NOT be present
    expect(screen.queryByTestId('mark-room-ready-btn')).toBeNull();
  });

  // ── CID-6: shortcut does NOT appear for non-DIRTY errors ─────────────────

  it('CID-6 — shortcut button does NOT appear for non-DIRTY check-in errors', async () => {
    vi.mocked(checkInReservation).mockRejectedValue(OTHER_412_ERROR);

    render(
      <CheckInDrawer reservation={BASE_RESERVATION} open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );

    screen.getAllByRole('checkbox').forEach((cb) => fireEvent.click(cb));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Check-In' }));

    // Wait for the error message to appear
    await waitFor(() => {
      expect(screen.getByText(/Reservation is not in CONFIRMED status/)).toBeDefined();
    });

    // Neither shortcut button nor RECEPTION hint should be visible
    expect(screen.queryByTestId('mark-room-ready-btn')).toBeNull();
    expect(screen.queryByTestId('dirty-reception-hint')).toBeNull();
  });
});
