/**
 * RatePlanDrawer.spec.tsx — Phase 3 admin UI tests
 *
 * Tests:
 *   - description field renders and submits
 *   - create mode: "guarda el plan primero" hint shown instead of extras
 *   - edit mode: extras list renders from API response
 *   - edit mode: adding an extra calls POST /pricing/rate-plans/:id/extras
 *   - edit mode: deleting an extra calls DELETE /pricing/extras/:extraId
 *   - non-PACKAGE type: "Los extras suelen usarse en paquetes" hint shown
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RatePlanDrawer, type RatePlan } from './RatePlanDrawer';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: mocks.get,
    post: mocks.post,
    patch: mocks.patch,
    delete: mocks.delete,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ROOM_TYPES = [
  { id: 'rt-1', name: 'Suite Ejecutiva', isActive: true },
  { id: 'rt-2', name: 'Doble Estándar', isActive: true },
];

const PLAN_PACKAGE: RatePlan = {
  id: 'rp-1',
  name: 'Paquete Desayuno',
  type: 'PACKAGE',
  roomTypeId: 'rt-1',
  isActive: true,
  description: 'Incluye desayuno continental',
  priceModifier: 1.0,
};

const PLAN_BAR: RatePlan = {
  id: 'rp-2',
  name: 'Tarifa BAR',
  type: 'BAR',
  roomTypeId: 'rt-1',
  isActive: true,
  description: null,
  priceModifier: 1.0,
};

const EXTRAS = [
  { id: 'ex-1', ratePlanId: 'rp-1', name: 'Desayuno', amount: 30000, pricingMode: 'PER_NIGHT' as const },
  { id: 'ex-2', ratePlanId: 'rp-1', name: 'Transfer', amount: 50000, pricingMode: 'PER_STAY' as const },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function mkQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={mkQc()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RatePlanDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: room-types resolves, extras resolves
    mocks.get.mockImplementation((url: string) => {
      if (url === '/inventory/room-types') {
        return Promise.resolve({ data: ROOM_TYPES });
      }
      if (url.includes('/extras')) {
        return Promise.resolve({ data: EXTRAS });
      }
      return Promise.resolve({ data: [] });
    });
    mocks.post.mockResolvedValue({ data: {} });
    mocks.patch.mockResolvedValue({ data: {} });
    mocks.delete.mockResolvedValue({ data: null });
  });

  // ── DRAW-1: drawer renders when isOpen=true ──────────────────────────────

  it('DRAW-1 — renders the drawer when isOpen', () => {
    render(
      <RatePlanDrawer
        isOpen
        ratePlan={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // ── DRAW-2: drawer hidden when isOpen=false ──────────────────────────────

  it('DRAW-2 — renders nothing when isOpen=false', () => {
    render(
      <RatePlanDrawer
        isOpen={false}
        ratePlan={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // ── DRAW-3: description field renders ────────────────────────────────────

  it('DRAW-3 — description textarea is present', () => {
    render(
      <RatePlanDrawer
        isOpen
        ratePlan={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
  });

  // ── DRAW-4: description populated in edit mode ───────────────────────────

  it('DRAW-4 — description populated from ratePlan in edit mode', async () => {
    render(
      <RatePlanDrawer
        isOpen
        ratePlan={PLAN_PACKAGE}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    const textarea = screen.getByLabelText(/descripción/i) as HTMLTextAreaElement;
    await waitFor(() => {
      expect(textarea.value).toBe('Incluye desayuno continental');
    });
  });

  // ── DRAW-5: create mode shows "guarda primero" hint ──────────────────────

  it('DRAW-5 — create mode shows guarda-el-plan hint instead of extras form', () => {
    render(
      <RatePlanDrawer
        isOpen
        ratePlan={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByTestId('extras-create-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('add-extra-form')).not.toBeInTheDocument();
  });

  // ── DRAW-6: edit mode renders extras list ────────────────────────────────

  it('DRAW-6 — edit mode renders extras list from API', async () => {
    render(
      <RatePlanDrawer
        isOpen
        ratePlan={PLAN_PACKAGE}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByTestId('extras-list')).toBeInTheDocument();
    });

    expect(screen.getByText('Desayuno')).toBeInTheDocument();
    expect(screen.getByText('Transfer')).toBeInTheDocument();
  });

  // ── DRAW-7: edit mode shows add-extra form ───────────────────────────────

  it('DRAW-7 — edit mode renders the add-extra form', async () => {
    render(
      <RatePlanDrawer
        isOpen
        ratePlan={PLAN_PACKAGE}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-extra-form')).toBeInTheDocument();
    });
  });

  // ── DRAW-8: adding an extra calls POST /pricing/rate-plans/:id/extras ────

  it('DRAW-8 — adding an extra calls POST to the extras endpoint', async () => {
    render(
      <RatePlanDrawer
        isOpen
        ratePlan={PLAN_PACKAGE}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-extra-form')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/nombre del extra/i);
    const amountInput = screen.getByLabelText(/monto cop/i);

    fireEvent.change(nameInput, { target: { value: 'Spa premium' } });
    fireEvent.change(amountInput, { target: { value: '80000' } });

    const addBtn = screen.getByRole('button', { name: /agregar/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        `/pricing/rate-plans/${PLAN_PACKAGE.id}/extras`,
        expect.objectContaining({ name: 'Spa premium', amount: 80000 }),
      );
    });
  });

  // ── DRAW-9: deleting an extra calls DELETE /pricing/extras/:extraId ───────

  it('DRAW-9 — deleting an extra calls DELETE on the extra endpoint', async () => {
    render(
      <RatePlanDrawer
        isOpen
        ratePlan={PLAN_PACKAGE}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(screen.getByTestId('extras-list')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText('Eliminar extra Desayuno');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mocks.delete).toHaveBeenCalledWith(`/pricing/extras/ex-1`);
    });
  });

  // ── DRAW-10: BAR plan shows "extras suelen usarse en paquetes" hint ───────

  it('DRAW-10 — BAR type shows hint that extras are for packages', async () => {
    render(
      <RatePlanDrawer
        isOpen
        ratePlan={PLAN_BAR}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(
        screen.getByText(/los extras suelen usarse en paquetes/i),
      ).toBeInTheDocument();
    });
  });

  // ── DRAW-11: description submitted on PATCH in edit mode ─────────────────

  it('DRAW-11 — description is included in PATCH payload on save', async () => {
    const onSuccess = vi.fn();

    render(
      <RatePlanDrawer
        isOpen
        ratePlan={PLAN_PACKAGE}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
      { wrapper: Wrapper },
    );

    // Wait for form to populate from effect
    await waitFor(() => {
      const textarea = screen.getByLabelText(/descripción/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('Incluye desayuno continental');
    });

    // Change description
    const textarea = screen.getByLabelText(/descripción/i);
    fireEvent.change(textarea, { target: { value: 'Nueva descripción del paquete' } });

    // Submit the form element directly — RHF requires form submission, not just button click
    const form = screen.getByRole('dialog').querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mocks.patch).toHaveBeenCalledWith(
        `/pricing/rate-plans/${PLAN_PACKAGE.id}`,
        expect.objectContaining({ description: 'Nueva descripción del paquete' }),
      );
    });
  });
});
