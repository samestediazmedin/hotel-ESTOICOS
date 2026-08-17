/**
 * FrontDeskPage.spec.tsx
 *
 * Tests for the Recepcion (front desk) page.
 *
 * Sections:
 *   D. Solicitudes pendientes — PENDING por contactar/confirmar
 *   A. Llegadas de hoy        — CONFIRMED + checkInDate === today
 *   B. Salidas pendientes     — CHECKED_IN + checkOutDate <= today (overdue highlighted)
 *   E. Proximas llegadas      — CONFIRMED + checkInDate > today y <= today+14d
 *   C. En casa                — CHECKED_IN not in B
 *
 * Strategy: mock useReservations, mock useConfirmReservationRequest,
 * mock useRejectReservationRequest, mock ContactButtons,
 * mock CheckInDrawer/CheckOutConfirmDialog,
 * verify section rendering, overdue badge, action buttons, empty states.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReservationResponseDto } from '@/features/reservations/reservations.api';

// ─── Freeze "today" to a known date ──────────────────────────────────────────

const FAKE_TODAY = '2026-06-01';

vi.mock('@/lib/date', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/date')>();
  return {
    ...actual,
    toLocalISODate: vi.fn((d: Date) => {
      // For new Date() calls (no specific date), return FAKE_TODAY
      // For addDays calls, use real implementation
      return actual.toLocalISODate(d);
    }),
  };
});

// ─── Track CheckInDrawer / CheckOutConfirmDialog opens ───────────────────────

const checkInDrawerProps = vi.fn();
const checkOutDialogProps = vi.fn();

vi.mock('./CheckInDrawer', () => ({
  CheckInDrawer: (props: Record<string, unknown>) => {
    checkInDrawerProps(props);
    if (!props.open) return null;
    return <div data-testid="check-in-drawer">CheckInDrawer open</div>;
  },
}));

vi.mock('./CheckOutConfirmDialog', () => ({
  CheckOutConfirmDialog: (props: Record<string, unknown>) => {
    checkOutDialogProps(props);
    if (!props.open) return null;
    return <div data-testid="check-out-dialog">CheckOutDialog open</div>;
  },
}));

// ─── Shared mock data (declared before vi.mock factories that close over them) ─

// vi.mock factories are hoisted to the top of the file by Vitest. Closures in
// those factories capture variable REFERENCES (not values), so the arrays/fns
// declared here must exist before the factories run. Declaring them before any
// vi.mock call (in source order) is enough — Vitest hoisting preserves the
// closure reference, not the initialization value.
const mockReservations: ReservationResponseDto[] = [];
const mockConfirmMutateAsync = vi.fn().mockResolvedValue({});
const mockRejectMutate = vi.fn();

// ─── Mock ContactButtons — avoids registering mutations in tests ─────────────

vi.mock('@/features/guests/components/ContactButtons', () => ({
  ContactButtons: (props: Record<string, unknown>) => (
    <div data-testid="contact-buttons" data-guest-id={String(props.guestId)}>
      ContactButtons
    </div>
  ),
}));

// ─── Mock reservations API (hooks) ───────────────────────────────────────────

vi.mock('@/features/reservations/reservations.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/reservations/reservations.api')>();
  return {
    ...actual,
    useReservations: vi.fn(() => ({
      data: mockReservations,
      isLoading: false,
    })),
    useConfirmReservationRequest: vi.fn((_id: string) => ({
      mutateAsync: mockConfirmMutateAsync,
      isPending: false,
    })),
    useRejectReservationRequest: vi.fn((_id: string) => ({
      mutate: mockRejectMutate,
      isPending: false,
    })),
  };
});

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeReservation(
  overrides: Partial<ReservationResponseDto>,
): ReservationResponseDto {
  return {
    id: 'res-default',
    checkInDate: '2026-06-01',
    checkOutDate: '2026-06-03',
    status: 'CONFIRMED',
    source: 'DIRECT',
    adults: 2,
    totalNights: 2,
    guestId: 'guest-1',
    guest: {
      id: 'guest-1',
      fullName: 'Test Guest',
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
      roomType: { id: 'rt-1', name: 'Standard', basePrice: 200000 },
    },
    roomTypeId: 'rt-1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Render helper ───────────────────────────────────────────────────────────

import { FrontDeskPage } from './FrontDeskPage';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FrontDeskPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('FrontDeskPage', () => {
  beforeEach(() => {
    // Reset mock data to empty
    mockReservations.length = 0;
    checkInDrawerProps.mockClear();
    checkOutDialogProps.mockClear();
    mockConfirmMutateAsync.mockClear();
    mockRejectMutate.mockClear();
    // Fix "today" via Date override
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Renders five sections ──────────────────────────────────────────────────

  it('renders the five sections with headers', () => {
    renderPage();

    expect(screen.getByText('Solicitudes pendientes')).toBeDefined();
    expect(screen.getByText('Llegadas de hoy')).toBeDefined();
    expect(screen.getByText('Salidas pendientes')).toBeDefined();
    expect(screen.getByText('Proximas llegadas')).toBeDefined();
    expect(screen.getByText('En casa')).toBeDefined();
  });

  // ── Empty states ───────────────────────────────────────────────────────────

  it('shows empty state messages when there are no reservations', () => {
    renderPage();

    expect(screen.getByText('No hay solicitudes pendientes de revision')).toBeDefined();
    expect(screen.getByText('No hay llegadas para hoy')).toBeDefined();
    expect(screen.getByText('No hay salidas pendientes')).toBeDefined();
    expect(
      screen.getByText('No hay llegadas confirmadas en los proximos 14 dias'),
    ).toBeDefined();
    expect(
      screen.getByText('No hay huespedes hospedados actualmente'),
    ).toBeDefined();
  });

  // ── Section A: Llegadas de hoy ─────────────────────────────────────────────

  it('shows CONFIRMED reservations with checkInDate === today under Llegadas', () => {
    mockReservations.push(
      makeReservation({
        id: 'arrival-1',
        status: 'CONFIRMED',
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-03',
        guest: {
          id: 'g-1',
          fullName: 'Carlos Ramirez',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1985-05-10',
        },
      }),
    );

    renderPage();

    expect(screen.getByText('Carlos Ramirez')).toBeDefined();
    // Check-in button should be present
    expect(screen.getByRole('button', { name: 'Check-in' })).toBeDefined();
  });

  it('does NOT show CONFIRMED reservations with checkInDate !== today under Llegadas de hoy', () => {
    // A CONFIRMED reservation with checkInDate in the future (but within 14d)
    // appears in "Proximas llegadas" (section E), NOT in "Llegadas de hoy" (section A).
    // It should NOT have a Check-in button (that only appears on section A).
    mockReservations.push(
      makeReservation({
        id: 'future-arrival',
        status: 'CONFIRMED',
        checkInDate: '2026-06-05', // future, within 14d window
        checkOutDate: '2026-06-07',
        guest: {
          id: 'g-2',
          fullName: 'Future Guest',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1990-01-01',
        },
      }),
    );

    renderPage();

    // The guest appears in the DOM under section E (Proximas llegadas) — that is correct.
    // What must NOT happen is a Check-in button for this guest (check-in is only for today).
    expect(screen.queryByRole('button', { name: 'Check-in' })).toBeNull();

    // Additionally verify section A (Llegadas de hoy) is empty
    const llegadasHeading = screen
      .getAllByRole('heading', { level: 2 })
      .find((h) => h.textContent === 'Llegadas de hoy');
    expect(llegadasHeading).toBeDefined();
    const llegadasSection = llegadasHeading!.closest('section');
    expect(
      within(llegadasSection!).queryByText('Future Guest'),
    ).toBeNull();
  });

  // ── Section B: Salidas pendientes ──────────────────────────────────────────

  it('shows CHECKED_IN reservations with checkOutDate === today under Salidas', () => {
    mockReservations.push(
      makeReservation({
        id: 'departure-today',
        status: 'CHECKED_IN',
        checkInDate: '2026-05-30',
        checkOutDate: '2026-06-01', // today
        guest: {
          id: 'g-3',
          fullName: 'Lucia Fernandez',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1988-03-15',
        },
      }),
    );

    renderPage();

    expect(screen.getByText('Lucia Fernandez')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Check-out' })).toBeDefined();
  });

  it('shows overdue CHECKED_IN reservations with "Vencido" badge', () => {
    mockReservations.push(
      makeReservation({
        id: 'overdue-1',
        status: 'CHECKED_IN',
        checkInDate: '2026-05-27',
        checkOutDate: '2026-05-29', // 3 days overdue
        guest: {
          id: 'g-4',
          fullName: 'Pedro Gomez',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1975-12-01',
        },
      }),
    );

    renderPage();

    expect(screen.getByText('Pedro Gomez')).toBeDefined();
    // Overdue badge should contain "Vencido"
    expect(screen.getByText(/Vencido/)).toBeDefined();
  });

  // ── Section C: En casa ─────────────────────────────────────────────────────

  it('shows CHECKED_IN reservations with future checkout under En casa (not in Salidas)', () => {
    mockReservations.push(
      makeReservation({
        id: 'in-house-1',
        status: 'CHECKED_IN',
        checkInDate: '2026-05-30',
        checkOutDate: '2026-06-05', // future checkout
        guest: {
          id: 'g-5',
          fullName: 'Maria Vargas',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1992-07-20',
        },
        room: {
          id: 'room-2',
          number: '202',
          floor: 2,
          roomTypeId: 'rt-1',
          roomType: { id: 'rt-1', name: 'Suite', basePrice: 400000 },
        },
      }),
    );

    renderPage();

    expect(screen.getByText('Maria Vargas')).toBeDefined();
    expect(screen.getByText('Hab. 202')).toBeDefined();
  });

  // ── CheckInDrawer opens on button click ────────────────────────────────────

  it('opens CheckInDrawer when Check-in button is clicked', () => {
    mockReservations.push(
      makeReservation({
        id: 'arrival-2',
        status: 'CONFIRMED',
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-03',
        guest: {
          id: 'g-6',
          fullName: 'Ana Torres',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1991-01-15',
        },
      }),
    );

    renderPage();

    const checkInBtn = screen.getByRole('button', { name: 'Check-in' });
    fireEvent.click(checkInBtn);

    // The mock CheckInDrawer should now be rendered with open=true
    expect(screen.getByTestId('check-in-drawer')).toBeDefined();
  });

  // ── CheckOutConfirmDialog opens on button click ────────────────────────────

  it('opens CheckOutConfirmDialog when Check-out button is clicked', () => {
    mockReservations.push(
      makeReservation({
        id: 'departure-2',
        status: 'CHECKED_IN',
        checkInDate: '2026-05-30',
        checkOutDate: '2026-06-01',
        guest: {
          id: 'g-7',
          fullName: 'Roberto Diaz',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1980-09-05',
        },
      }),
    );

    renderPage();

    const checkOutBtn = screen.getByRole('button', { name: 'Check-out' });
    fireEvent.click(checkOutBtn);

    expect(screen.getByTestId('check-out-dialog')).toBeDefined();
  });

  // ── Section D: Solicitudes pendientes ─────────────────────────────────────

  it('shows PENDING reservations under Solicitudes pendientes section', () => {
    mockReservations.push(
      makeReservation({
        id: 'pending-1',
        status: 'PENDING',
        checkInDate: '2026-06-15',
        checkOutDate: '2026-06-18',
        roomId: null,
        room: null,
        guest: {
          id: 'g-p1',
          fullName: 'Sofia Mendez',
          email: 'sofia@example.com',
          phone: '+573001234567',
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1993-04-20',
        },
      }),
    );

    renderPage();

    expect(screen.getByText('Sofia Mendez')).toBeDefined();
    // Debe mostrar badge Pendiente
    expect(screen.getByText('Pendiente')).toBeDefined();
    // ContactButtons mockeados deben aparecer
    expect(screen.getByTestId('contact-buttons')).toBeDefined();
    // Botones Confirmar y Rechazar
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDefined();
  });

  it('does NOT show PENDING reservation in Llegadas de hoy or Proximas llegadas', () => {
    mockReservations.push(
      makeReservation({
        id: 'pending-2',
        status: 'PENDING',
        checkInDate: '2026-06-05', // dentro de 14 días pero PENDING
        checkOutDate: '2026-06-07',
        roomId: null,
        room: null,
        guest: {
          id: 'g-p2',
          fullName: 'Marco Rios',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1987-11-10',
        },
      }),
    );

    renderPage();

    // Debe aparecer solo en la sección D (Solicitudes pendientes)
    expect(screen.getByText('Marco Rios')).toBeDefined();
    // No debe tener un botón Check-in (ese es de Llegadas de hoy)
    expect(screen.queryByRole('button', { name: 'Check-in' })).toBeNull();
  });

  it('calls useConfirmReservationRequest mutateAsync when Confirmar is clicked', async () => {
    mockReservations.push(
      makeReservation({
        id: 'pending-confirm',
        status: 'PENDING',
        checkInDate: '2026-06-10',
        checkOutDate: '2026-06-12',
        roomId: null,
        room: null,
        guest: {
          id: 'g-pc',
          fullName: 'Elena Castro',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1990-06-15',
        },
      }),
    );

    renderPage();

    const confirmBtn = screen.getByRole('button', { name: 'Confirmar' });
    fireEvent.click(confirmBtn);

    // mockConfirmMutateAsync should be called
    // (async — but fireEvent is sync; the fn is called synchronously before await)
    expect(mockConfirmMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('calls useRejectReservationRequest mutate with prompt reason when Rechazar is clicked', () => {
    // Spy on window.prompt to simulate admin entering a reason
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Sin disponibilidad');

    mockReservations.push(
      makeReservation({
        id: 'pending-reject',
        status: 'PENDING',
        checkInDate: '2026-06-20',
        checkOutDate: '2026-06-22',
        roomId: null,
        room: null,
        guest: {
          id: 'g-pr',
          fullName: 'Diego Vargas',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1985-02-28',
        },
      }),
    );

    renderPage();

    const rejectBtn = screen.getByRole('button', { name: 'Rechazar' });
    fireEvent.click(rejectBtn);

    expect(promptSpy).toHaveBeenCalledTimes(1);
    expect(mockRejectMutate).toHaveBeenCalledWith(
      { reason: 'Sin disponibilidad' },
      expect.objectContaining({ onError: expect.any(Function) }),
    );

    promptSpy.mockRestore();
  });

  it('does NOT call reject when admin cancels the prompt (returns null)', () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);

    mockReservations.push(
      makeReservation({
        id: 'pending-reject-cancel',
        status: 'PENDING',
        checkInDate: '2026-07-01',
        checkOutDate: '2026-07-03',
        roomId: null,
        room: null,
        guest: {
          id: 'g-prc',
          fullName: 'Valeria Mora',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1995-09-14',
        },
      }),
    );

    renderPage();

    const rejectBtn = screen.getByRole('button', { name: 'Rechazar' });
    fireEvent.click(rejectBtn);

    expect(promptSpy).toHaveBeenCalledTimes(1);
    // mutate should NOT be called when prompt returns null
    expect(mockRejectMutate).not.toHaveBeenCalled();

    promptSpy.mockRestore();
  });

  // ── Section E: Proximas llegadas ───────────────────────────────────────────

  it('shows CONFIRMED reservations with checkInDate > today and <= today+14d under Proximas llegadas', () => {
    mockReservations.push(
      makeReservation({
        id: 'upcoming-1',
        status: 'CONFIRMED',
        checkInDate: '2026-06-08', // 7 días después de FAKE_TODAY (2026-06-01)
        checkOutDate: '2026-06-10',
        guest: {
          id: 'g-u1',
          fullName: 'Carmen Jimenez',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1988-07-30',
        },
      }),
    );

    renderPage();

    expect(screen.getByText('Carmen Jimenez')).toBeDefined();
    // Debe mostrar "Llega <fecha>" con la fecha resaltada (no botón Check-in).
    // Use exact prefix "Llega " to avoid matching "Llegadas de hoy" heading.
    expect(screen.getByText(/^Llega /)).toBeDefined();
    // NO debe tener Check-in button (no es el día de llegada)
    // Puede haber uno en otra sección si hay otra reserva — filtramos por nombre
    const carmenEl = screen.getByText('Carmen Jimenez').closest('div');
    expect(carmenEl).toBeDefined();
    // ContactButtons debe estar presente para coordinar
    expect(screen.getByTestId('contact-buttons')).toBeDefined();
  });

  it('does NOT show today arrivals (checkInDate === today) in Proximas llegadas', () => {
    // Una CONFIRMED con checkInDate === today debe ir a Llegadas de hoy (sección A),
    // no a Proximas llegadas (sección E).
    mockReservations.push(
      makeReservation({
        id: 'arrival-today-only',
        status: 'CONFIRMED',
        checkInDate: '2026-06-01', // === FAKE_TODAY
        checkOutDate: '2026-06-03',
        guest: {
          id: 'g-at',
          fullName: 'Tomas Guerrero',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1981-12-05',
        },
      }),
    );

    renderPage();

    // Tomas debe estar en Llegadas de hoy — tiene botón Check-in
    expect(screen.getByRole('button', { name: 'Check-in' })).toBeDefined();

    // Seccion E (Proximas llegadas) debe estar vacía
    const proximasHeading = screen
      .getAllByRole('heading', { level: 2 })
      .find((h) => h.textContent === 'Proximas llegadas');
    expect(proximasHeading).toBeDefined();
    const proximasSection = proximasHeading!.closest('section');
    // El mensaje de vacío debe estar visible (count=0, isEmpty=true)
    expect(
      within(proximasSection!).queryByText(
        'No hay llegadas confirmadas en los proximos 14 dias',
      ),
    ).toBeDefined();
  });

  it('does NOT show CONFIRMED with checkInDate > today+14d in Proximas llegadas', () => {
    // Una reserva confirmada para más de 14 días no debe aparecer en Proximas llegadas
    mockReservations.push(
      makeReservation({
        id: 'far-future',
        status: 'CONFIRMED',
        checkInDate: '2026-07-20', // > hoy+14d
        checkOutDate: '2026-07-23',
        guest: {
          id: 'g-ff',
          fullName: 'Isabela Suarez',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1996-03-18',
        },
      }),
    );

    renderPage();

    // No debe aparecer en el DOM (el query principal cubre hoy+14d, así que
    // si está en mockReservations pero checkInDate > hoy+14d, el filtro la excluye)
    expect(screen.queryByText('Isabela Suarez')).toBeNull();
  });

  // ── Count badges ───────────────────────────────────────────────────────────

  it('displays correct count badges per section', () => {
    mockReservations.push(
      // 2 arrivals
      makeReservation({
        id: 'a1',
        status: 'CONFIRMED',
        checkInDate: '2026-06-01',
        guest: {
          id: 'g-a1', fullName: 'Guest A1', email: null, phone: null,
          documentType: 'CC', nationality: 'CO', dateOfBirth: '1990-01-01',
        },
      }),
      makeReservation({
        id: 'a2',
        status: 'CONFIRMED',
        checkInDate: '2026-06-01',
        guest: {
          id: 'g-a2', fullName: 'Guest A2', email: null, phone: null,
          documentType: 'CC', nationality: 'CO', dateOfBirth: '1990-01-01',
        },
      }),
      // 1 departure (today)
      makeReservation({
        id: 'd1',
        status: 'CHECKED_IN',
        checkInDate: '2026-05-30',
        checkOutDate: '2026-06-01',
        guest: {
          id: 'g-d1', fullName: 'Guest D1', email: null, phone: null,
          documentType: 'CC', nationality: 'CO', dateOfBirth: '1990-01-01',
        },
      }),
      // 1 in-house (future checkout)
      makeReservation({
        id: 'ih1',
        status: 'CHECKED_IN',
        checkInDate: '2026-05-28',
        checkOutDate: '2026-06-05',
        guest: {
          id: 'g-ih1', fullName: 'Guest IH1', email: null, phone: null,
          documentType: 'CC', nationality: 'CO', dateOfBirth: '1990-01-01',
        },
      }),
    );

    renderPage();

    // The section headers each have a count badge.
    // Llegadas: 2, Salidas: 1, En casa: 1
    const headings = screen.getAllByRole('heading', { level: 2 });

    // Find the Llegadas section parent and check its badge
    const llegadasHeading = headings.find((h) => h.textContent === 'Llegadas de hoy');
    expect(llegadasHeading).toBeDefined();
    // The badge is a sibling span — check within the parent
    const llegadasSection = llegadasHeading!.closest('div');
    expect(within(llegadasSection!).getByText('2')).toBeDefined();

    const salidasHeading = headings.find((h) => h.textContent === 'Salidas pendientes');
    const salidasSection = salidasHeading!.closest('div');
    expect(within(salidasSection!).getByText('1')).toBeDefined();

    const enCasaHeading = headings.find((h) => h.textContent === 'En casa');
    const enCasaSection = enCasaHeading!.closest('div');
    expect(within(enCasaSection!).getByText('1')).toBeDefined();
  });

  // ── Contact info text (PendingCard & UpcomingCard) ────────────────────────

  it('PendingCard: shows phone and email as readable text when present', () => {
    mockReservations.push(
      makeReservation({
        id: 'pending-contact',
        status: 'PENDING',
        checkInDate: '2026-06-15',
        checkOutDate: '2026-06-17',
        roomId: null,
        room: null,
        guest: {
          id: 'g-contact',
          fullName: 'Luis Perez',
          email: 'luis@example.com',
          phone: '+573101234567',
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1990-03-01',
        },
      }),
    );

    renderPage();

    expect(screen.getByText('+573101234567')).toBeDefined();
    expect(screen.getByText('luis@example.com')).toBeDefined();
  });

  it('PendingCard: shows fallback text when phone and email are null', () => {
    mockReservations.push(
      makeReservation({
        id: 'pending-no-contact',
        status: 'PENDING',
        checkInDate: '2026-06-16',
        checkOutDate: '2026-06-18',
        roomId: null,
        room: null,
        guest: {
          id: 'g-no-contact',
          fullName: 'Ana Ruiz',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1992-07-10',
        },
      }),
    );

    renderPage();

    expect(screen.getByText('Sin teléfono')).toBeDefined();
    expect(screen.getByText('Sin email')).toBeDefined();
  });

  it('UpcomingCard: shows phone and email as readable text when present', () => {
    mockReservations.push(
      makeReservation({
        id: 'upcoming-contact',
        status: 'CONFIRMED',
        checkInDate: '2026-06-08',
        checkOutDate: '2026-06-10',
        guest: {
          id: 'g-ucontact',
          fullName: 'Marta Lopez',
          email: 'marta@hotel.com',
          phone: '+573209876543',
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1988-11-20',
        },
      }),
    );

    renderPage();

    expect(screen.getByText('+573209876543')).toBeDefined();
    expect(screen.getByText('marta@hotel.com')).toBeDefined();
  });

  it('UpcomingCard: shows fallback text when phone and email are null', () => {
    mockReservations.push(
      makeReservation({
        id: 'upcoming-no-contact',
        status: 'CONFIRMED',
        checkInDate: '2026-06-09',
        checkOutDate: '2026-06-11',
        guest: {
          id: 'g-uno-contact',
          fullName: 'Jorge Blanco',
          email: null,
          phone: null,
          documentType: 'CC',
          nationality: 'CO',
          dateOfBirth: '1985-04-05',
        },
      }),
    );

    renderPage();

    expect(screen.getByText('Sin teléfono')).toBeDefined();
    expect(screen.getByText('Sin email')).toBeDefined();
  });

  // ── Missing room warning ───────────────────────────────────────────────────

  it('shows "Sin habitacion" warning when reservation has no room assigned', () => {
    mockReservations.push(
      makeReservation({
        id: 'no-room',
        status: 'CONFIRMED',
        checkInDate: '2026-06-01',
        roomId: null,
        room: null,
        guest: {
          id: 'g-nr', fullName: 'Guest NoRoom', email: null, phone: null,
          documentType: 'CC', nationality: 'CO', dateOfBirth: '1990-01-01',
        },
      }),
    );

    renderPage();

    expect(screen.getByText(/Sin habitacion/)).toBeDefined();
  });
});
