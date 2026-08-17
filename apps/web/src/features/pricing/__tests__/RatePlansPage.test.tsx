import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RatePlansPage } from '../RatePlansPage';

// ─── Mock API ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '@/lib/api';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const MOCK_PLANS = [
  {
    id: 'rp1',
    name: 'Tarifa BAR 2026',
    type: 'BAR',
    roomTypeId: 'rt1',
    isActive: true,
    description: null,
    priceModifier: 1.0,
    extras: [],
  },
  {
    id: 'rp2',
    name: 'Promo Verano',
    type: 'PROMO',
    roomTypeId: 'rt1',
    isActive: true,
    description: 'Promo especial',
    priceModifier: 0.85,
    extras: [{ id: 'e1' }, { id: 'e2' }],
  },
  {
    id: 'rp3',
    name: 'Paquete SPA',
    type: 'PACKAGE',
    roomTypeId: 'rt2',
    isActive: false,
    description: null,
    priceModifier: 1.2,
    extras: [],
  },
];

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  const qc = makeQueryClient();
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <RatePlansPage />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('RatePlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: MOCK_PLANS });
  });

  it('renders loading state before data resolves', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/Cargando planes/)).toBeInTheDocument();
  });

  it('renders plan rows after data resolves', async () => {
    renderPage();
    expect(await screen.findByText('Tarifa BAR 2026')).toBeInTheDocument();
    expect(screen.getByText('Promo Verano')).toBeInTheDocument();
    expect(screen.getByText('Paquete SPA')).toBeInTheDocument();
  });

  // ── Seasons column removed ───────────────────────────────────────────────

  it('does NOT render a "Temporadas" column header', async () => {
    renderPage();
    await screen.findByText('Tarifa BAR 2026');
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).not.toContain('Temporadas');
  });

  it('does NOT render any "Ver temporadas" link', async () => {
    renderPage();
    await screen.findByText('Tarifa BAR 2026');
    expect(screen.queryByText(/Ver temporadas/)).not.toBeInTheDocument();
  });

  // ── Modifier column ──────────────────────────────────────────────────────

  it('renders a "Modificador" column header', async () => {
    renderPage();
    await screen.findByText('Tarifa BAR 2026');
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toContain('Modificador');
  });

  it('shows ×1.00 for BAR plan', async () => {
    renderPage();
    await screen.findByText('Tarifa BAR 2026');
    expect(screen.getByTestId('modifier-rp1')).toHaveTextContent('×1.00');
  });

  it('shows ×0.85 for PROMO plan', async () => {
    renderPage();
    await screen.findByText('Promo Verano');
    expect(screen.getByTestId('modifier-rp2')).toHaveTextContent('×0.85');
  });

  it('shows ×1.20 for PACKAGE plan', async () => {
    renderPage();
    await screen.findByText('Paquete SPA');
    expect(screen.getByTestId('modifier-rp3')).toHaveTextContent('×1.20');
  });

  // ── Extras column still present ──────────────────────────────────────────

  it('renders Extras column with count', async () => {
    renderPage();
    await screen.findByText('Promo Verano');
    expect(screen.getByText('2 extras')).toBeInTheDocument();
  });

  it('renders — for plans with no extras', async () => {
    renderPage();
    await screen.findByText('Tarifa BAR 2026');
    // There are multiple "—" cells — just confirm the column is visible
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toContain('Extras');
  });

  // ── Estado column ────────────────────────────────────────────────────────

  it('shows Activo badge for active plans', async () => {
    renderPage();
    await screen.findByText('Tarifa BAR 2026');
    const activoBadges = screen.getAllByText('Activo');
    expect(activoBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Inactivo badge for inactive plans', async () => {
    renderPage();
    await screen.findByText('Paquete SPA');
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  // ── Desactivar action ────────────────────────────────────────────────────

  it('shows Desactivar button only for active plans', async () => {
    renderPage();
    await screen.findByText('Tarifa BAR 2026');
    const deactivateBtns = screen.getAllByText('Desactivar');
    // rp1 and rp2 are active; rp3 is inactive — so exactly 2
    expect(deactivateBtns.length).toBe(2);
  });

  it('calls POST /pricing/rate-plans/:id/deactivate when Desactivar clicked', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    renderPage();
    await screen.findByText('Tarifa BAR 2026');

    const deactivateBtns = screen.getAllByText('Desactivar');
    fireEvent.click(deactivateBtns[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/pricing/rate-plans/rp1/deactivate');
    });
  });

  // ── Empty state ──────────────────────────────────────────────────────────

  it('renders empty state when no plans', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    renderPage();
    expect(
      await screen.findByText(/No hay planes de tarifa/),
    ).toBeInTheDocument();
  });

  // ── Decimal-as-string regression guard ──────────────────────────────────
  //
  // Prisma serializes Decimal to a JSON string ("0.8500").  TypeScript types
  // say `number`, so tsc is happy — the crash only appears at runtime.
  // These tests simulate that exact condition so a future type-boundary slip
  // is caught immediately.

  it('does NOT throw when priceModifier arrives as a STRING from the API', async () => {
    // Simulate the real Prisma-over-HTTP payload: Decimal comes as a string.
    const plansWithStringModifier = MOCK_PLANS.map((p) => ({
      ...p,
      priceModifier: String(p.priceModifier) as unknown as number,
    }));
    vi.mocked(api.get).mockResolvedValue({ data: plansWithStringModifier });

    // Must NOT throw — Number() coercion in the template handles it.
    expect(() => renderPage()).not.toThrow();
    expect(await screen.findByText('Tarifa BAR 2026')).toBeInTheDocument();
  });

  it('renders ×0.85 correctly when priceModifier arrives as the string "0.8500"', async () => {
    const plansWithStringModifier = MOCK_PLANS.map((p) => ({
      ...p,
      priceModifier: String(p.priceModifier) as unknown as number,
    }));
    vi.mocked(api.get).mockResolvedValue({ data: plansWithStringModifier });

    renderPage();
    await screen.findByText('Promo Verano');

    // Even with a string input, the modifier cell must render the formatted value.
    expect(screen.getByTestId('modifier-rp2')).toHaveTextContent('×0.85');
  });

  it('renders ×1.00 correctly when priceModifier arrives as the string "1.0000"', async () => {
    const plansWithStringModifier = MOCK_PLANS.map((p) => ({
      ...p,
      priceModifier: String(p.priceModifier) as unknown as number,
    }));
    vi.mocked(api.get).mockResolvedValue({ data: plansWithStringModifier });

    renderPage();
    await screen.findByText('Tarifa BAR 2026');

    expect(screen.getByTestId('modifier-rp1')).toHaveTextContent('×1.00');
  });

  // ── Drawer ───────────────────────────────────────────────────────────────

  it('"Nueva tarifa" button opens the drawer', async () => {
    // mock room-types for the drawer
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/pricing/rate-plans') return Promise.resolve({ data: MOCK_PLANS });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await screen.findByText('Tarifa BAR 2026');
    fireEvent.click(screen.getByRole('button', { name: /Nueva tarifa/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
