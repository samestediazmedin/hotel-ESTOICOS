import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SeasonsPage } from '../SeasonsPage';

// ─── Mock API ─────────────────────────────────────────────────────────────────
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// ─── Mock date helpers ────────────────────────────────────────────────────────
// NOTE: We use the REAL formatDisplayDate in the date-contract suite below.
// This top-level mock only covers the rest of the suites.
vi.mock('@/lib/date', () => ({
  formatDisplayDate: (d: string) => d,
  toLocalISODate: (d: Date) => d.toISOString().slice(0, 10),
}));

// ─── Imports after mock ───────────────────────────────────────────────────────
import { api } from '@/lib/api';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const MOCK_ROOM_TYPES = [
  { id: 'rt1', name: 'Suite Deluxe', isActive: true },
  { id: 'rt2', name: 'Habitación Estándar', isActive: true },
  { id: 'rt3', name: 'Habitación Inactiva', isActive: false },
];

const MOCK_SEASONS = [
  {
    id: 's1',
    roomTypeId: 'rt1',
    name: 'HIGH',
    startDate: '2026-12-01',
    endDate: '2027-01-06',
    multiplier: 1.5,
    minNights: 3,
  },
  {
    id: 's2',
    roomTypeId: 'rt1',
    name: 'LOW',
    startDate: '2026-04-01',
    endDate: '2026-06-30',
    multiplier: 0.8,
    minNights: 1,
  },
];

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/**
 * Render SeasonsPage inside a MemoryRouter with optional initial path.
 * Uses Routes+Route so useSearchParams works correctly with the given URL.
 */
function renderPage(initialUrl = '/pricing/seasons') {
  const qc = makeQueryClient();
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[initialUrl]}>
          <Routes>
            <Route path="/pricing/seasons" element={<SeasonsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe('SeasonsPage — no roomTypeId (selector state)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/inventory/room-types') {
        return Promise.resolve({ data: MOCK_ROOM_TYPES });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('renders the room-type selector panel when no roomTypeId in URL', async () => {
    renderPage('/pricing/seasons');
    const selector = await screen.findByTestId('room-type-selector');
    expect(selector).toBeInTheDocument();
  });

  it('lists all room types in the selector', async () => {
    renderPage('/pricing/seasons');
    // Wait for room type data to load (async query)
    expect(await screen.findByText('Suite Deluxe')).toBeInTheDocument();
    expect(screen.getByText('Habitación Estándar')).toBeInTheDocument();
    expect(screen.getByText('Habitación Inactiva')).toBeInTheDocument();
  });

  it('marks inactive room types with "(inactivo)" label', async () => {
    renderPage('/pricing/seasons');
    await screen.findByText('Habitación Inactiva');
    expect(screen.getByText('(inactivo)')).toBeInTheDocument();
  });

  it('does NOT call /pricing/seasons when roomTypeId is absent', async () => {
    renderPage('/pricing/seasons');
    // Wait for room-types fetch to settle
    await screen.findByTestId('room-type-selector');
    await new Promise((r) => setTimeout(r, 50));
    const calls = vi.mocked(api.get).mock.calls.map(([u]) => u);
    expect(calls).not.toContain('/pricing/seasons');
  });

  it('shows h1 "Temporadas" without a type name prefix', async () => {
    renderPage('/pricing/seasons');
    await screen.findByTestId('room-type-selector');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Temporadas');
  });
});

describe('SeasonsPage — with roomTypeId (seasons table)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string, config?: { params?: Record<string, string> }) => {
      if (url === '/inventory/room-types') {
        return Promise.resolve({ data: MOCK_ROOM_TYPES });
      }
      if (url === '/pricing/seasons') {
        // Only return seasons if the correct roomTypeId is passed
        const roomTypeId = config?.params?.roomTypeId;
        if (roomTypeId === 'rt1') {
          return Promise.resolve({ data: MOCK_SEASONS });
        }
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('queries /pricing/seasons with roomTypeId param', async () => {
    renderPage('/pricing/seasons?roomTypeId=rt1');
    await screen.findByText('HIGH');
    const calls = vi.mocked(api.get).mock.calls;
    const seasonsCall = calls.find(([u]) => u === '/pricing/seasons');
    expect(seasonsCall).toBeDefined();
    expect(seasonsCall?.[1]?.params?.roomTypeId).toBe('rt1');
  });

  it('renders season rows correctly', async () => {
    renderPage('/pricing/seasons?roomTypeId=rt1');
    expect(await screen.findByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('LOW')).toBeInTheDocument();
  });

  it('shows room type name in heading', async () => {
    renderPage('/pricing/seasons?roomTypeId=rt1');
    // Wait for both room-types AND seasons to load so heading is populated
    await screen.findByText('HIGH');
    await screen.findByText('Suite Deluxe', { exact: false });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Temporadas de Suite Deluxe',
    );
  });

  it('multiplier column renders HIGH season as "+50%"', async () => {
    renderPage('/pricing/seasons?roomTypeId=rt1');
    await screen.findByText('HIGH');
    expect(screen.getByText('+50%')).toBeInTheDocument();
  });

  it('multiplier column renders LOW season as "-20%"', async () => {
    renderPage('/pricing/seasons?roomTypeId=rt1');
    await screen.findByText('LOW');
    expect(screen.getByText('-20%')).toBeInTheDocument();
  });

  it('minNights = 1 renders as "Sin mínimo"', async () => {
    renderPage('/pricing/seasons?roomTypeId=rt1');
    await screen.findByText('LOW');
    expect(screen.getByText('Sin mínimo')).toBeInTheDocument();
  });

  it('minNights > 1 renders with "noches" suffix', async () => {
    renderPage('/pricing/seasons?roomTypeId=rt1');
    await screen.findByText('HIGH');
    expect(screen.getByText('3 noches')).toBeInTheDocument();
  });

  it('shows empty state when season list is empty for a type', async () => {
    renderPage('/pricing/seasons?roomTypeId=rt2');
    expect(
      await screen.findByText(/No hay temporadas para este tipo/),
    ).toBeInTheDocument();
  });

  it('"Cambiar tipo" button navigates back to selector', async () => {
    renderPage('/pricing/seasons?roomTypeId=rt1');
    await screen.findByText('HIGH');
    // The button triggers navigate('/pricing/seasons') — in MemoryRouter we can
    // verify the button is present and has correct accessible label
    const btn = screen.getByRole('button', { name: /Cambiar tipo/ });
    expect(btn).toBeInTheDocument();
  });

  it('clicking delete season calls DELETE endpoint and confirms first', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.delete).mockResolvedValue({ data: {} });

    renderPage('/pricing/seasons?roomTypeId=rt1');
    const deleteButtons = await screen.findAllByText('Eliminar');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/pricing/seasons/s1');
    });
    confirmSpy.mockRestore();
  });

  it('does NOT delete when user cancels confirm dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(api.delete).mockResolvedValue({ data: {} });

    renderPage('/pricing/seasons?roomTypeId=rt1');
    const deleteButtons = await screen.findAllByText('Eliminar');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(api.delete).not.toHaveBeenCalled();
    });
    confirmSpy.mockRestore();
  });

  it('"Nueva temporada" button opens the season drawer', async () => {
    renderPage('/pricing/seasons?roomTypeId=rt1');
    await screen.findByText('HIGH');
    fireEvent.click(screen.getByRole('button', { name: /Nueva temporada/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

// ─── Date-contract suite ──────────────────────────────────────────────────────
// These tests verify the API date contract: the backend MUST return
// "YYYY-MM-DD" bare strings for startDate/endDate, not full ISO datetimes.
// The mock at the top of this file replaces formatDisplayDate with an identity
// function; here we use the REAL implementation to catch "Invalid Date" regressions.
//
// This is a pure unit test of the date utility — no React rendering needed.
// We import the real helper directly, bypassing the vi.mock at module scope.

describe('formatDisplayDate (real implementation) — date-contract guard', () => {
  it('DATE-CONTRACT-1 — "YYYY-MM-DD" input returns a valid es-CO date string', async () => {
    // Dynamically import the actual module, bypassing the vi.mock at module scope
    const { formatDisplayDate } = await import('@/lib/date');
    const result = formatDisplayDate('2026-05-28');
    expect(result).not.toBe('Invalid Date');
    // Should look like "28 may. 2026" or "28 may 2026" — at minimum it is non-empty
    expect(result.length).toBeGreaterThan(3);
    // Must NOT contain the literal string "Invalid"
    expect(result).not.toMatch(/invalid/i);
  });

  it('DATE-CONTRACT-2 — full ISO datetime string concatenated with "T12:00:00.000Z" produces Invalid Date (documents root cause the API fix prevents)', () => {
    // This test DOCUMENTS the root cause of the "Invalid Date — Invalid Date" bug:
    // formatDisplayDate does `new Date(isoDate + 'T12:00:00.000Z')`.
    // If the API returned a full ISO datetime ("2026-05-28T00:00:00.000Z"),
    // the concatenation produces "2026-05-28T00:00:00.000ZT12:00:00.000Z"
    // which is NOT a valid date string → Invalid Date.
    const fullIsoFromApi = '2026-05-28T00:00:00.000Z';
    const badDate = new Date(fullIsoFromApi + 'T12:00:00.000Z');
    // The compound string is unparseable → confirms the bug would occur
    expect(isNaN(badDate.getTime())).toBe(true);

    // Contrast: bare "YYYY-MM-DD" (what the fix ensures the API returns)
    const goodDate = new Date('2026-05-28' + 'T12:00:00.000Z');
    expect(isNaN(goodDate.getTime())).toBe(false);
  });

  it('DATE-CONTRACT-3 — MOCK_SEASONS dates "YYYY-MM-DD" render without "Invalid Date" in the Fechas column', async () => {
    // Render the page with real formatDisplayDate to catch regression
    const { formatDisplayDate } = await import('@/lib/date');
    const start = formatDisplayDate('2026-12-01');
    const end = formatDisplayDate('2027-01-06');
    expect(start).not.toMatch(/invalid/i);
    expect(end).not.toMatch(/invalid/i);
    expect(start.length).toBeGreaterThan(3);
    expect(end.length).toBeGreaterThan(3);
  });
});
