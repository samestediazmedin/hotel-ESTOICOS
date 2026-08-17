/**
 * BookingResultsPage tests — Phase 2 rate selection UX
 *
 * The page uses two hooks:
 * - usePublicRoomTypes → GET /api/public/room-types
 * - useRateOptions (per room type, lazy) → GET /api/public/rate-options
 *
 * Both are intercepted via MSW. Tests verify:
 * - "Ver tarifas" button is present; rates are NOT fetched before expand.
 * - Expanding shows rate rows with name, badge, and formatted total.
 * - PACKAGE rates display the extras list.
 * - minNightsViolation disables the rate row (no "Reservar" button, shows minimum message).
 * - Selecting a rate navigates to /booking/checkout with the correct query params
 *   (roomTypeId, checkIn, checkOut, adults, total, ratePlanId, ratePlanName).
 * - Null ratePlanId (BASE rate) is omitted from the URL (not appended as "null").
 * - The offer param is forwarded when present.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw-server';
import { BookingResultsPage } from '../BookingResultsPage';
import type { PublicRoomType, RatePlanOption } from '../public-booking.api';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ROOM_TYPE: PublicRoomType = {
  id: 'rt-doble',
  name: 'Doble Deluxe',
  capacity: 2,
  description: 'Vista a los cerros orientales.',
  basePrice: 200000,
  amenities: ['WiFi', 'TV'],
  photos: [{ url: '/images/room1.jpg', alt: 'Doble Deluxe' }],
  badge: null,
};

const BASE_RATE: RatePlanOption = {
  ratePlanId: null,
  ratePlanName: 'Tarifa Base',
  ratePlanType: 'BASE',
  description: null,
  breakdown: {
    roomTypeId: 'rt-doble',
    ratePlanId: null,
    nights: 2,
    items: [],
    subtotal: 400000,
    totalIva: 76000,
    roomTotal: 476000,
    extras: [],
    extrasSubtotal: 0,
    extrasIva: 0,
    extrasTotal: 0,
    total: 476000,
    currency: 'COP',
    appliedRatePlan: 'BASE',
  },
};

const PACKAGE_RATE: RatePlanOption = {
  ratePlanId: 'rp-luna-001',
  ratePlanName: 'Luna de Miel',
  ratePlanType: 'PACKAGE',
  description: 'Incluye desayuno buffet y botella de vino',
  breakdown: {
    ...BASE_RATE.breakdown,
    ratePlanId: 'rp-luna-001',
    extras: [
      {
        name: 'Desayuno buffet',
        pricingMode: 'PER_PERSON_PER_NIGHT',
        unitAmount: 35000,
        quantity: 4,
        subtotal: 140000,
        ivaAmount: 0,
        total: 140000,
      },
    ],
    extrasSubtotal: 140000,
    extrasIva: 0,
    extrasTotal: 140000,
    total: 616000,
    appliedRatePlan: 'Luna de Miel',
  },
};

const MIN_NIGHTS_RATE: RatePlanOption = {
  ratePlanId: 'rp-min3',
  ratePlanName: 'Semana Especial',
  ratePlanType: 'BAR',
  description: null,
  breakdown: {
    ...BASE_RATE.breakdown,
    ratePlanId: 'rp-min3',
    minNightsViolation: { required: 5, actual: 2, seasonName: 'Temporada Alta' },
    appliedRatePlan: 'Semana Especial',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEARCH = '?checkIn=2026-06-10&checkOut=2026-06-12&adults=2';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...mod,
    useNavigate: () => mockNavigate,
  };
});

function renderPage(search = SEARCH) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/booking/rooms${search}`]}>
        <Routes>
          <Route path="/booking/rooms" element={<BookingResultsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setupHandlers(
  roomTypes: PublicRoomType[] = [ROOM_TYPE],
  rateOptions: RatePlanOption[] = [BASE_RATE, PACKAGE_RATE],
) {
  server.use(
    http.get('/api/public/room-types', () => HttpResponse.json(roomTypes)),
    http.get('/api/public/rate-options', () => HttpResponse.json(rateOptions)),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BookingResultsPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    setupHandlers();
  });

  it('renders the room type name after catalogue loads', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Doble Deluxe')).toBeInTheDocument());
  });

  it('shows "Ver tarifas" button before expanding', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Doble Deluxe'));
    expect(screen.getByRole('button', { name: /ver tarifas/i })).toBeInTheDocument();
  });

  it('does NOT show rate rows before the panel is expanded', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Doble Deluxe'));
    expect(screen.queryByText('Tarifa Base')).toBeNull();
  });

  it('shows rate rows after expanding the panel', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Doble Deluxe'));

    fireEvent.click(screen.getByRole('button', { name: /ver tarifas/i }));

    await waitFor(() => {
      expect(screen.getByText('Tarifa Base')).toBeInTheDocument();
      expect(screen.getByText('Luna de Miel')).toBeInTheDocument();
    });
  });

  it('renders the PACKAGE badge for a PACKAGE rate', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Doble Deluxe'));
    fireEvent.click(screen.getByRole('button', { name: /ver tarifas/i }));
    await waitFor(() => screen.getByText('Luna de Miel'));

    expect(screen.getByText('Paquete')).toBeInTheDocument();
  });

  it('renders extras for PACKAGE rate as included benefits (name + "incluido", no price/mode)', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Doble Deluxe'));
    fireEvent.click(screen.getByRole('button', { name: /ver tarifas/i }));
    await waitFor(() => screen.getByText('Luna de Miel'));

    // Extra name must be present (description also mentions it, so at least one occurrence)
    expect(screen.getAllByText(/desayuno buffet/i).length).toBeGreaterThanOrEqual(1);
    // "incluido" must appear as the inclusion label (the extras span + "IVA incluido" text both
    // match the pattern, so use getAllByText and verify at least one is the extras label)
    const incluidoNodes = screen.getAllByText(/incluido/i);
    expect(incluidoNodes.length).toBeGreaterThanOrEqual(1);
    // The exact extras label is the standalone text "incluido" (the IVA one is "· 2 noches · IVA incluido")
    expect(incluidoNodes.some((n) => n.textContent?.trim() === 'incluido')).toBe(true);
    // The per-unit price must NOT appear as a standalone charge in the extras list
    expect(screen.queryByText(/\$[\s\xa0]*35\.000/)).toBeNull();
    // The pricing mode label must NOT appear
    expect(screen.queryByText(/por persona\/noche/i)).toBeNull();
  });

  it('renders the grand total formatted in COP for each rate', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Doble Deluxe'));
    fireEvent.click(screen.getByRole('button', { name: /ver tarifas/i }));
    await waitFor(() => screen.getByText('Tarifa Base'));

    // BASE rate total = 476000 → "$\xa0476.000"
    expect(screen.getAllByText(/\$[\s\xa0]*476\.000/).length).toBeGreaterThanOrEqual(1);
  });

  it('selecting a non-null ratePlanId navigates to checkout with ratePlanId param', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Doble Deluxe'));
    fireEvent.click(screen.getByRole('button', { name: /ver tarifas/i }));
    await waitFor(() => screen.getByText('Luna de Miel'));

    fireEvent.click(screen.getByRole('button', { name: /reservar luna de miel/i }));

    expect(mockNavigate).toHaveBeenCalledOnce();
    const url: string = mockNavigate.mock.calls[0][0];
    expect(url).toContain('roomTypeId=rt-doble');
    expect(url).toContain('checkIn=2026-06-10');
    expect(url).toContain('checkOut=2026-06-12');
    expect(url).toContain('adults=2');
    expect(url).toContain('total=616000');
    expect(url).toContain('ratePlanId=rp-luna-001');
    expect(url).toContain('ratePlanName=Luna+de+Miel');
  });

  it('selecting BASE rate (ratePlanId null) omits ratePlanId from URL', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Doble Deluxe'));
    fireEvent.click(screen.getByRole('button', { name: /ver tarifas/i }));
    await waitFor(() => screen.getByText('Tarifa Base'));

    fireEvent.click(screen.getByRole('button', { name: /reservar tarifa base/i }));

    const url: string = mockNavigate.mock.calls[0][0];
    expect(url).not.toContain('ratePlanId');
    expect(url).toContain('total=476000');
  });

  it('forwards the offer param to the checkout URL when present', async () => {
    renderPage(`${SEARCH}&offer=offer_42`);
    await waitFor(() => screen.getByText('Doble Deluxe'));
    fireEvent.click(screen.getByRole('button', { name: /ver tarifas/i }));
    await waitFor(() => screen.getByText('Luna de Miel'));
    fireEvent.click(screen.getByRole('button', { name: /reservar luna de miel/i }));

    const url: string = mockNavigate.mock.calls[0][0];
    expect(url).toContain('offer=offer_42');
  });

  it('disables a rate with minNightsViolation (no Reservar button, shows minimum)', async () => {
    setupHandlers([ROOM_TYPE], [MIN_NIGHTS_RATE]);
    renderPage();
    await waitFor(() => screen.getByText('Doble Deluxe'));
    fireEvent.click(screen.getByRole('button', { name: /ver tarifas/i }));
    await waitFor(() => screen.getByText('Semana Especial'));

    // No "Reservar" button for the blocked rate
    expect(screen.queryByRole('button', { name: /reservar semana especial/i })).toBeNull();
    // Minimum nights message
    expect(screen.getByText(/mínimo 5 noches/i)).toBeInTheDocument();
  });

  it('shows an error message when rate-options endpoint fails', async () => {
    server.use(
      http.get('/api/public/room-types', () => HttpResponse.json([ROOM_TYPE])),
      http.get('/api/public/rate-options', () =>
        HttpResponse.json({ message: 'Internal error' }, { status: 500 }),
      ),
    );
    renderPage();
    await waitFor(() => screen.getByText('Doble Deluxe'));
    fireEvent.click(screen.getByRole('button', { name: /ver tarifas/i }));

    await waitFor(() =>
      expect(screen.getByText(/error al cargar tarifas/i)).toBeInTheDocument(),
    );
  });

  it('shows "no hay tarifas" when rate-options returns empty array', async () => {
    setupHandlers([ROOM_TYPE], []);
    renderPage();
    await waitFor(() => screen.getByText('Doble Deluxe'));
    fireEvent.click(screen.getByRole('button', { name: /ver tarifas/i }));

    await waitFor(() =>
      expect(screen.getByText(/no hay tarifas disponibles/i)).toBeInTheDocument(),
    );
  });

  it('renders the "missing params" guard when checkIn is absent', () => {
    renderPage('?checkOut=2026-06-12&adults=2');
    expect(screen.getByText(/parámetros de búsqueda incompletos/i)).toBeInTheDocument();
  });

  it('shows the "at least 1 night" guard when checkIn === checkOut (0 nights)', () => {
    // MSW rate-options handler is set up in beforeEach — it must NOT be called.
    const rateSpy = vi.fn();
    server.use(
      http.get('/api/public/rate-options', () => {
        rateSpy();
        return HttpResponse.json([BASE_RATE]);
      }),
    );

    renderPage('?checkIn=2026-06-10&checkOut=2026-06-10&adults=2');

    expect(
      screen.getByText(/selecciona al menos 1 noche/i),
    ).toBeInTheDocument();

    // Room cards are NOT rendered — no expand button, no rate-options call.
    expect(screen.queryByRole('button', { name: /ver tarifas/i })).toBeNull();
    expect(rateSpy).not.toHaveBeenCalled();
  });
});
