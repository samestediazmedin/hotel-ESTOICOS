import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RoomTypesPage } from '../../inventory/RoomTypesPage';

// ─── Mock API ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// ─── Mock RoomTypeDrawer (has complex deps — isolate) ─────────────────────────
vi.mock('../../inventory/RoomTypeDrawer', () => ({
  RoomTypeDrawer: () => null,
}));

// ─── Mock RoomTypePhotosManager ───────────────────────────────────────────────
vi.mock('../../inventory/components/RoomTypePhotosManager', () => ({
  RoomTypePhotosManager: () => null,
}));

import { api } from '@/lib/api';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const MOCK_ROOM_TYPES = [
  {
    id: 'rt1',
    name: 'Suite Deluxe',
    description: 'La mejor suite',
    basePrice: 350000,
    maxOccupancy: 2,
    amenities: ['wifi', 'tv'],
    isActive: true,
  },
  {
    id: 'rt2',
    name: 'Habitación Estándar',
    description: '',
    basePrice: 180000,
    maxOccupancy: 2,
    amenities: [],
    isActive: false,
  },
];

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage(initialUrl = '/room-types') {
  const qc = makeQueryClient();
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[initialUrl]}>
          <Routes>
            <Route path="/room-types" element={<RoomTypesPage />} />
            <Route
              path="/pricing/seasons"
              element={<div data-testid="seasons-page">SeasonsPage</div>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('RoomTypesPage — Temporadas action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: MOCK_ROOM_TYPES });
  });

  it('renders a "Temporadas" button for each room type', async () => {
    renderPage();
    expect(await screen.findByTestId('seasons-btn-rt1')).toBeInTheDocument();
    expect(screen.getByTestId('seasons-btn-rt2')).toBeInTheDocument();
  });

  it('"Temporadas" button has CalendarRange icon (rendered as svg)', async () => {
    renderPage();
    const btn = await screen.findByTestId('seasons-btn-rt1');
    expect(btn.querySelector('svg')).not.toBeNull();
  });

  it('clicking "Temporadas" navigates to /pricing/seasons?roomTypeId=<id>', async () => {
    renderPage();
    const seasonsBtn = await screen.findByTestId('seasons-btn-rt1');
    fireEvent.click(seasonsBtn);
    // After navigation the SeasonsPage stub should render
    expect(await screen.findByTestId('seasons-page')).toBeInTheDocument();
  });

  it('still renders "Fotos" and "Editar" actions alongside "Temporadas"', async () => {
    renderPage();
    await screen.findByTestId('seasons-btn-rt1');
    expect(screen.getAllByText('Fotos').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Editar').length).toBeGreaterThanOrEqual(1);
  });
});
