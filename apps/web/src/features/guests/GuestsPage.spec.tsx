/**
 * GuestsPage spec — Phase 16 Plan 05
 *
 * Tests:
 *   Existing: search debounce, drawer create flow
 *   New (16-05): "Último contacto" column, row navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('./guests.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./guests.api')>();
  return {
    ...actual,
    useGuests: vi.fn(),
    useCreateGuest: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
    useUpdateGuest: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
    useAnonymizeGuest: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
    useGuest: vi.fn(() => ({ data: null, isLoading: false })),
    useGuestHistory: vi.fn(() => ({ data: null, isLoading: false })),
  };
});

vi.mock('@/features/auth/auth.store', () => ({
  useAuthStore: (selector: (s: { user: { role: string; id: string } }) => unknown) =>
    selector({ user: { role: 'RECEPTION', id: 'user-1' } }),
}));

// GuestDrawer is heavy — stub it so tests stay fast
vi.mock('./GuestDrawer', () => ({
  GuestDrawer: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="guest-drawer" /> : null,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

import type { AnyGuestDto } from './guests.api';

const guestWithEvent: AnyGuestDto = {
  id: 'guest-123',
  fullName: 'Ana Torres',
  email: 'ana@example.com',
  phone: '+57 300 000 0001',
  documentType: 'CC',
  documentNumber: '12345678',
  nationality: 'CO',
  dateOfBirth: '1990-01-01',
  anonymizedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  lastContactEvent: {
    method: 'CALL',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    staffUserName: 'María Pérez',
  },
};

const guestWithoutEvent: AnyGuestDto = {
  id: 'guest-456',
  fullName: 'Carlos Ruiz',
  email: 'carlos@example.com',
  phone: null,
  documentType: 'CC',
  documentNumber: '87654321',
  nationality: 'CO',
  dateOfBirth: '1985-06-15',
  anonymizedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  lastContactEvent: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { useGuests } from './guests.api';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GuestsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

import { GuestsPage } from './GuestsPage';

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GuestsPage — column structure', () => {
  it('renders 6 column headers including "Último contacto"', () => {
    vi.mocked(useGuests).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useGuests>);

    renderPage();

    expect(screen.getByText('Nombre')).toBeDefined();
    expect(screen.getByText('Documento')).toBeDefined();
    expect(screen.getByText('Nacionalidad')).toBeDefined();
    expect(screen.getByText('Email')).toBeDefined();
    expect(screen.getByText('Teléfono')).toBeDefined();
    expect(screen.getByText('Último contacto')).toBeDefined();
  });
});

describe('GuestsPage — "Último contacto" column rendering', () => {
  it('shows "Nunca" for a guest with no contact events', () => {
    vi.mocked(useGuests).mockReturnValue({
      data: [guestWithoutEvent],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useGuests>);

    renderPage();

    expect(screen.getByText('Nunca')).toBeDefined();
  });

  it('shows relative Spanish time for a guest with a contact event', () => {
    vi.mocked(useGuests).mockReturnValue({
      data: [guestWithEvent],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useGuests>);

    renderPage();

    // formatDistanceToNow with locale es + addSuffix should produce "hace alrededor de 2 horas"
    // or similar — we just verify it starts with "hace" and is non-empty
    const cells = screen.getAllByText(/hace/i);
    expect(cells.length).toBeGreaterThan(0);
  });

  it('shows "—" when createdAt is malformed (graceful fallback)', () => {
    const guestMalformed: AnyGuestDto = {
      ...guestWithEvent,
      id: 'guest-789',
      lastContactEvent: {
        method: 'EMAIL',
        createdAt: 'not-a-date',
        staffUserName: null,
      },
    };

    vi.mocked(useGuests).mockReturnValue({
      data: [guestMalformed],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useGuests>);

    renderPage();

    // Should not crash — shows "—" from try/catch
    expect(screen.getByText('—')).toBeDefined();
  });
});

describe('GuestsPage — row navigation', () => {
  it('calls navigate("/guests/:id") when a row is clicked', async () => {
    vi.mocked(useGuests).mockReturnValue({
      data: [guestWithEvent],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useGuests>);

    renderPage();

    const row = screen.getByText('Ana Torres').closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/guests/guest-123');
    });
  });

  it('does NOT open the drawer when a row is clicked', async () => {
    vi.mocked(useGuests).mockReturnValue({
      data: [guestWithEvent],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useGuests>);

    renderPage();

    const row = screen.getByText('Ana Torres').closest('tr');
    fireEvent.click(row!);

    await waitFor(() => {
      expect(screen.queryByTestId('guest-drawer')).toBeNull();
    });
  });
});

describe('GuestsPage — drawer reserved for creation only', () => {
  it('opens drawer when "Nuevo huésped" button is clicked', async () => {
    vi.mocked(useGuests).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useGuests>);

    renderPage();

    const btn = screen.getByText('Nuevo huésped');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByTestId('guest-drawer')).toBeDefined();
    });
  });
});

describe('GuestsPage — colSpan on placeholder rows', () => {
  it('loading row has colSpan=6', () => {
    vi.mocked(useGuests).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useGuests>);

    renderPage();

    const td = screen.getByText('Cargando huéspedes...').closest('td');
    expect(td?.getAttribute('colspan')).toBe('6');
  });

  it('error row has colSpan=6', () => {
    vi.mocked(useGuests).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useGuests>);

    renderPage();

    const td = screen.getByText('Error cargando huéspedes. Intente de nuevo.').closest('td');
    expect(td?.getAttribute('colspan')).toBe('6');
  });

  it('empty row has colSpan=6', () => {
    vi.mocked(useGuests).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useGuests>);

    renderPage();

    const td = screen.getByText('No se encontraron huéspedes.').closest('td');
    expect(td?.getAttribute('colspan')).toBe('6');
  });
});
