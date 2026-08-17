import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RatePlanDrawer, type RatePlan } from '../RatePlanDrawer';

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
const MOCK_ROOM_TYPES = [
  { id: 'rt1', name: 'Suite Deluxe', isActive: true },
  { id: 'rt2', name: 'Habitación Estándar', isActive: true },
];

const MOCK_PLAN: RatePlan = {
  id: 'rp1',
  name: 'Tarifa BAR 2026',
  type: 'BAR',
  roomTypeId: 'rt1',
  isActive: true,
  description: 'Tarifa best available',
  priceModifier: 1.0,
};

const PROMO_PLAN: RatePlan = {
  id: 'rp2',
  name: 'Promo Verano',
  type: 'PROMO',
  roomTypeId: 'rt1',
  isActive: true,
  description: null,
  priceModifier: 0.85,
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

interface RenderOptions {
  ratePlan?: RatePlan | null;
  isOpen?: boolean;
}

function renderDrawer({ ratePlan = null, isOpen = true }: RenderOptions = {}) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const qc = makeQueryClient();

  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RatePlanDrawer
          isOpen={isOpen}
          ratePlan={ratePlan}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...utils, onClose, onSuccess, qc };
}

describe('RatePlanDrawer — closed state', () => {
  it('renders nothing when isOpen=false', () => {
    renderDrawer({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('RatePlanDrawer — create mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: MOCK_ROOM_TYPES });
  });

  it('renders the dialog with "Nuevo plan de tarifa" heading', async () => {
    renderDrawer();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Nuevo plan de tarifa',
    );
  });

  it('renders the priceModifier input', async () => {
    renderDrawer();
    await screen.findByRole('dialog');
    expect(screen.getByTestId('price-modifier-input')).toBeInTheDocument();
  });

  it('priceModifier label is "Modificador de precio"', async () => {
    renderDrawer();
    await screen.findByRole('dialog');
    expect(screen.getByLabelText('Modificador de precio')).toBeInTheDocument();
  });

  it('priceModifier help text is present', async () => {
    renderDrawer();
    await screen.findByRole('dialog');
    expect(screen.getByText(/1\.0 = sin cambio/)).toBeInTheDocument();
  });

  it('shows "extras-create-hint" in create mode', async () => {
    renderDrawer();
    await screen.findByRole('dialog');
    expect(screen.getByTestId('extras-create-hint')).toBeInTheDocument();
  });

  it('calls POST /pricing/rate-plans with priceModifier on submit', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });

    renderDrawer();
    // Wait for room types to load so the select has options
    expect(await screen.findByText('Suite Deluxe')).toBeInTheDocument();

    // Fill required fields
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Nueva Tarifa' },
    });
    // roomTypeId select — now has options
    const roomTypeSelect = screen.getByLabelText('Tipo de habitación');
    fireEvent.change(roomTypeSelect, { target: { value: 'rt1' } });

    // priceModifier — already defaulted to 1.0, change to verify it's sent
    const modifierInput = screen.getByTestId('price-modifier-input');
    fireEvent.change(modifierInput, { target: { value: '0.9' } });

    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/pricing/rate-plans',
        expect.objectContaining({ priceModifier: expect.any(Number) }),
      );
    });
  });
});

describe('RatePlanDrawer — edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/inventory/room-types') return Promise.resolve({ data: MOCK_ROOM_TYPES });
      // extras endpoint
      return Promise.resolve({ data: [] });
    });
  });

  it('renders "Editar plan de tarifa" heading', async () => {
    renderDrawer({ ratePlan: MOCK_PLAN });
    expect(await screen.findByRole('heading', { level: 2 })).toHaveTextContent(
      'Editar plan de tarifa',
    );
  });

  it('populates priceModifier field with existing plan value', async () => {
    renderDrawer({ ratePlan: MOCK_PLAN });
    await screen.findByRole('dialog');
    const input = screen.getByTestId('price-modifier-input') as HTMLInputElement;
    expect(parseFloat(input.value)).toBe(1.0);
  });

  it('populates priceModifier with 0.85 for PROMO plan', async () => {
    renderDrawer({ ratePlan: PROMO_PLAN });
    await screen.findByRole('dialog');
    const input = screen.getByTestId('price-modifier-input') as HTMLInputElement;
    expect(parseFloat(input.value)).toBe(0.85);
  });

  it('sends priceModifier in PATCH payload', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} });

    renderDrawer({ ratePlan: MOCK_PLAN });
    // Wait for room types and form to populate
    expect(await screen.findByText('Suite Deluxe')).toBeInTheDocument();

    // Change modifier
    const modifierInput = screen.getByTestId('price-modifier-input');
    fireEvent.change(modifierInput, { target: { value: '1.15' } });

    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        `/pricing/rate-plans/${MOCK_PLAN.id}`,
        expect.objectContaining({ priceModifier: expect.any(Number) }),
      );
    });
  });

  it('shows the add-extra form in edit mode', async () => {
    renderDrawer({ ratePlan: MOCK_PLAN });
    await screen.findByRole('dialog');
    expect(screen.getByTestId('add-extra-form')).toBeInTheDocument();
  });
});

describe('RatePlanDrawer — Decimal-as-string regression guard', () => {
  // Prisma serializes Decimal to a JSON string over HTTP.  TypeScript types
  // say `number` so tsc is green — the crash only surfaces at runtime when
  // react-hook-form receives a string where it expects a number.

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/inventory/room-types') return Promise.resolve({ data: MOCK_ROOM_TYPES });
      return Promise.resolve({ data: [] });
    });
  });

  it('populates priceModifier input correctly when API returns it as a string', async () => {
    // Simulate Prisma Decimal-as-string from the HTTP boundary.
    const planWithStringModifier: RatePlan = {
      ...PROMO_PLAN,
      priceModifier: '0.8500' as unknown as number,
    };

    renderDrawer({ ratePlan: planWithStringModifier });
    await screen.findByRole('dialog');

    // The input must show a numeric 0.85, not NaN or "0.8500" (uncoerced string).
    const input = screen.getByTestId('price-modifier-input') as HTMLInputElement;
    await waitFor(() => {
      expect(parseFloat(input.value)).toBeCloseTo(0.85);
    });
  });

  it('does NOT crash during render when priceModifier arrives as a string', async () => {
    const planWithStringModifier: RatePlan = {
      ...MOCK_PLAN,
      priceModifier: '1.0000' as unknown as number,
    };

    // renderDrawer should not throw even with a string priceModifier.
    expect(() => renderDrawer({ ratePlan: planWithStringModifier })).not.toThrow();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('RatePlanDrawer — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: MOCK_ROOM_TYPES });
  });

  it('does not POST when priceModifier is 0', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    renderDrawer();
    // Wait for room types
    expect(await screen.findByText('Suite Deluxe')).toBeInTheDocument();

    // Fill name and roomType to avoid other errors
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Test Plan' },
    });
    fireEvent.change(screen.getByLabelText('Tipo de habitación'), {
      target: { value: 'rt1' },
    });

    const modifierInput = screen.getByTestId('price-modifier-input');
    fireEvent.change(modifierInput, { target: { value: '0' } });

    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);

    await waitFor(() => {
      expect(api.post).not.toHaveBeenCalled();
    });
  });
});
