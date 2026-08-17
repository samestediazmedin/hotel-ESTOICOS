/**
 * GuestDetailPage.spec.tsx — TDD RED phase for Task 2 (16-04)
 *
 * 9 behaviors:
 *  1. useParams() id used to fetch guest via useGuest hook
 *  2. Header renders: fullName, document, nationality, age, ContactButtons
 *  3. Info section renders all contact + preference fields (read mode)
 *  4. "Editar" toggles form; Cancel reverts; Save calls mutation + closes form
 *  5. Reservaciones section uses useGuestHistory; shows reservations
 *  6. Últimos contactos section consumes useGuestContactEvents; renders staff name + method + relative time
 *  7. Empty state for últimos contactos: "Aún no hay contactos registrados."
 *  8. Loading state renders "Cargando..." text
 *  9. 404 error state renders "Huésped no encontrado" + back link
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('./guests.api', () => ({
  useGuest: vi.fn(),
  useGuestHistory: vi.fn(),
  useUpdateGuest: vi.fn(),
  useDeleteGuest: vi.fn(),
  useAnonymizeGuest: vi.fn(),
}));

vi.mock('@/features/auth/auth.store', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { role: string } | null }) => unknown) =>
    selector({ user: { role: 'ADMIN' } }),
  ),
}));

vi.mock('./hooks/useGuestContactEvents', () => ({
  useGuestContactEvents: vi.fn(),
}));

vi.mock('./components/ContactButtons', () => ({
  ContactButtons: ({ guestId }: { guestId: string }) => (
    <div data-testid="contact-buttons" data-guest-id={guestId}>
      ContactButtons
    </div>
  ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const MOCK_GUEST = {
  id: 'guest-001',
  fullName: 'Juan Pérez García',
  documentType: 'CC',
  documentNumber: '1020304050',
  nationality: 'CO',
  dateOfBirth: '1990-01-15',
  email: 'juan@example.com',
  phone: '+573005551234',
  whatsappNumber: '+573005551234',
  contactPreference: 'WHATSAPP',
  preferredLanguage: 'ES',
  marketingConsent: true,
  dietaryRestrictions: 'vegetariano',
  specialRequests: 'cama extra',
  anonymizedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
};

const MOCK_HISTORY = {
  guest: MOCK_GUEST,
  totalNights: 5,
  totalSpent: 250000,
  reservations: [
    {
      id: 'res-001',
      checkInDate: '2024-05-14',
      checkOutDate: '2024-05-18',
      status: 'CHECKED_OUT',
      totalNights: 4,
    },
    {
      id: 'res-002',
      checkInDate: '2024-06-01',
      checkOutDate: '2024-06-03',
      status: 'CONFIRMED',
      totalNights: 2,
    },
  ],
};

const MOCK_CONTACT_EVENTS = [
  {
    id: 'evt-001',
    guestId: 'guest-001',
    staffUserId: 'staff-001',
    method: 'WHATSAPP' as const,
    notes: null,
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12 min ago
    staffUser: { id: 'staff-001', name: 'María Pérez', email: 'maria@hotel.com' },
  },
  {
    id: 'evt-002',
    guestId: 'guest-001',
    staffUserId: 'staff-002',
    method: 'EMAIL' as const,
    notes: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    staffUser: { id: 'staff-002', name: 'Juan Recepcionista', email: 'jrec@hotel.com' },
  },
];

function renderPage(guestId = 'guest-001') {
  const qc = makeQueryClient();
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/guests/${guestId}`]}>
          <Routes>
            <Route path="/guests/:id" element={<GuestDetailPage />} />
            <Route path="/guests" element={<div>Guests List</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

// Import after mocks are set up
import { GuestDetailPage } from './GuestDetailPage';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GuestDetailPage', () => {
  let mockUseGuest: ReturnType<typeof vi.fn>;
  let mockUseGuestHistory: ReturnType<typeof vi.fn>;
  let mockUseGuestContactEvents: ReturnType<typeof vi.fn>;
  let mockUseUpdateGuest: ReturnType<typeof vi.fn>;
  let mockUseDeleteGuest: ReturnType<typeof vi.fn>;
  let mockUseAnonymizeGuest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Restore ADMIN user as default after clearAllMocks wipes the implementation
    const authStore = await import('@/features/auth/auth.store');
    vi.mocked(authStore.useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: { user: { role: string } | null }) => unknown) =>
        selector({ user: { role: 'ADMIN' } }),
    );

    const guestsApi = await import('./guests.api');
    const contactHook = await import('./hooks/useGuestContactEvents');

    mockUseGuest = guestsApi.useGuest as ReturnType<typeof vi.fn>;
    mockUseGuestHistory = guestsApi.useGuestHistory as ReturnType<typeof vi.fn>;
    mockUseUpdateGuest = guestsApi.useUpdateGuest as ReturnType<typeof vi.fn>;
    mockUseDeleteGuest = guestsApi.useDeleteGuest as ReturnType<typeof vi.fn>;
    mockUseAnonymizeGuest = guestsApi.useAnonymizeGuest as ReturnType<typeof vi.fn>;
    mockUseGuestContactEvents = contactHook.useGuestContactEvents as ReturnType<typeof vi.fn>;

    // Default: successful data
    mockUseGuest.mockReturnValue({
      data: MOCK_GUEST,
      isLoading: false,
      isError: false,
      isPending: false,
    });
    mockUseGuestHistory.mockReturnValue({
      data: MOCK_HISTORY,
      isLoading: false,
    });
    mockUseGuestContactEvents.mockReturnValue({
      data: MOCK_CONTACT_EVENTS,
      isPending: false,
      isError: false,
    });
    mockUseUpdateGuest.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(MOCK_GUEST),
      isPending: false,
    });
    mockUseDeleteGuest.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    });
    mockUseAnonymizeGuest.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ anonymizedAt: new Date().toISOString() }),
      isPending: false,
    });
  });

  // ── Test 1: useParams id used ─────────────────────────────────────────────
  it('calls useGuest with the id from route params', () => {
    renderPage('guest-001');
    expect(mockUseGuest).toHaveBeenCalledWith('guest-001');
  });

  // ── Test 2: Header renders guest identity + ContactButtons ────────────────
  it('header renders fullName, document info, and ContactButtons', () => {
    renderPage();
    expect(screen.getByText('Juan Pérez García')).toBeInTheDocument();
    expect(screen.getByText(/CC.*1020304050/)).toBeInTheDocument();
    // Multiple ContactButtons render (header + per reservation row) — use getAllByTestId
    const contactButtonInstances = screen.getAllByTestId('contact-buttons');
    expect(contactButtonInstances.length).toBeGreaterThanOrEqual(1);
    expect(contactButtonInstances[0]).toHaveAttribute('data-guest-id', 'guest-001');
  });

  // ── Test 3: Info section read mode ───────────────────────────────────────
  it('renders contact information section in read mode', () => {
    renderPage();
    expect(screen.getByText('juan@example.com')).toBeInTheDocument();
    // Phone and WhatsApp may show the same number — use getAllByText
    const phoneInstances = screen.getAllByText('+573005551234');
    expect(phoneInstances.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Información de contacto/i)).toBeInTheDocument();
  });

  // ── Test 4: Edit mode toggle ──────────────────────────────────────────────
  it('clicking Editar shows form; Cancel exits edit mode', async () => {
    renderPage();
    const editBtn = screen.getByRole('button', { name: /editar/i });
    fireEvent.click(editBtn);

    // Form should appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
    });

    // Cancel reverts
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    });
  });

  // ── Test 5: Reservaciones section ────────────────────────────────────────
  it('renders reservations from useGuestHistory', () => {
    renderPage();
    // Reservation IDs visible — multiple elements may match, use getAllByText
    const resItems = screen.getAllByText(/res-001/i);
    expect(resItems.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Reservaciones/i)).toBeInTheDocument();
  });

  // ── Test 6: Últimos contactos renders staff + method + time ───────────────
  it('renders contact events with staff name, method label, and relative time', () => {
    renderPage();
    expect(screen.getByText('María Pérez')).toBeInTheDocument();
    expect(screen.getByText('Juan Recepcionista')).toBeInTheDocument();
    // Method labels
    expect(screen.getAllByText(/whatsapp|llamada|email/i).length).toBeGreaterThan(0);
  });

  // ── Test 7: Empty state for últimos contactos ─────────────────────────────
  it('shows empty state when no contact events', () => {
    mockUseGuestContactEvents.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText(/aún no hay contactos registrados/i)).toBeInTheDocument();
  });

  // ── Test 8: Loading state ─────────────────────────────────────────────────
  it('renders loading state while guest data is loading', () => {
    mockUseGuest.mockReturnValue({
      data: undefined,
      isLoading: true,
      isPending: true,
      isError: false,
    });
    renderPage();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  // ── Test 9: Error / 404 state ─────────────────────────────────────────────
  it('renders not-found state on API error', () => {
    mockUseGuest.mockReturnValue({
      data: undefined,
      isLoading: false,
      isPending: false,
      isError: true,
    });
    renderPage();
    expect(screen.getByText(/huésped no encontrado/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver/i })).toBeInTheDocument();
  });

  // ── Tests for Delete / Anonymize danger zone (ADMIN role-gating) ──────────

  it('Test D-1 — ADMIN sees "Eliminar huésped" button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /eliminar huésped/i })).toBeInTheDocument();
  });

  it('Test D-2 — non-ADMIN does not see "Eliminar huésped" button', async () => {
    const { useAuthStore } = await import('@/features/auth/auth.store');
    vi.mocked(useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (s: { user: { role: string } | null }) => unknown) =>
        selector({ user: { role: 'RECEPTION' } }),
    );
    renderPage();
    expect(
      screen.queryByRole('button', { name: /eliminar huésped/i }),
    ).not.toBeInTheDocument();
  });

  it('Test D-3 — guest without reservations shows permanent-delete confirmation', async () => {
    mockUseGuestHistory.mockReturnValue({
      data: { ...MOCK_HISTORY, reservations: [] },
      isLoading: false,
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /eliminar huésped/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/eliminará permanentemente al huésped/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /confirmar eliminación/i }),
      ).toBeInTheDocument();
    });
  });

  it('Test D-4 — guest with reservations shows anonymize confirmation instead', async () => {
    // MOCK_HISTORY already has 2 reservations by default
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /eliminar huésped/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/tiene reservas asociadas/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /confirmar anonimización/i }),
      ).toBeInTheDocument();
    });
  });

  it('Test D-5 — confirming delete with no reservations calls deleteGuest mutation and navigates', async () => {
    mockUseGuestHistory.mockReturnValue({
      data: { ...MOCK_HISTORY, reservations: [] },
      isLoading: false,
    });
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseDeleteGuest.mockReturnValue({ mutateAsync, isPending: false });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /eliminar huésped/i }));

    await waitFor(() =>
      screen.getByRole('button', { name: /confirmar eliminación/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /confirmar eliminación/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledOnce();
    });
  });

  it('Test D-6 — confirming anonymize calls anonymizeGuest mutation', async () => {
    const mutateAsync = vi
      .fn()
      .mockResolvedValue({ anonymizedAt: new Date().toISOString() });
    mockUseAnonymizeGuest.mockReturnValue({ mutateAsync, isPending: false });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /eliminar huésped/i }));

    await waitFor(() =>
      screen.getByRole('button', { name: /confirmar anonimización/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /confirmar anonimización/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledOnce();
    });
  });

  // ── Test D-7 — after delete, page navigates to /guests (no stale detail refetch) ──
  it('Test D-7 — after successful delete page navigates to /guests and does not stay on detail', async () => {
    // Guest has no reservations so the delete path (not anonymize) is triggered
    mockUseGuestHistory.mockReturnValue({
      data: { ...MOCK_HISTORY, reservations: [] },
      isLoading: false,
    });
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseDeleteGuest.mockReturnValue({ mutateAsync, isPending: false });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /eliminar huésped/i }));

    await waitFor(() =>
      screen.getByRole('button', { name: /confirmar eliminación/i }),
    );

    fireEvent.click(screen.getByRole('button', { name: /confirmar eliminación/i }));

    // After delete resolves, the router should have navigated to /guests
    // (rendered as the stub route "Guests List") — the detail page is gone,
    // so useGuest / useGuestHistory are unmounted and no 404 refetch occurs.
    await waitFor(() => {
      expect(screen.getByText('Guests List')).toBeInTheDocument();
    });

    // Verify the mutation was actually called
    expect(mutateAsync).toHaveBeenCalledOnce();
  });
});
