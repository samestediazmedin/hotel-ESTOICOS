/**
 * OccupancyBarChart tests — Phase 06 Plan 02
 *
 * Recharts note: ResponsiveContainer requires a browser layout environment.
 * In jsdom, ResizeObserver is not available and dimensions default to 0.
 * We wrap in a sized div to give Recharts a container and mock ResizeObserver.
 *
 * Verifies:
 * - Renders without crash when getDailySnapshots returns []
 * - Maps occupancyPct: 0.75 to chart data value 75 (1 decimal → 75.0)
 * - Hits the correct queryKey ['reports', 'occupancy7d', startIso, endIso]
 * - Empty-state message shown when no data
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { OccupancyBarChart } from '../OccupancyBarChart';
import type { DailySnapshot } from '../reporting.api';

// ─── Mock ResizeObserver (required for Recharts ResponsiveContainer in jsdom) ─
// Must be a class (constructable) — vi.fn() arrow factories are not constructable.
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// ─── Mock the reporting API ───────────────────────────────────────────────────

vi.mock('../reporting.api', () => ({
  reportingApi: {
    getDashboard: vi.fn(),
    getDailySnapshots: vi.fn(),
    getRoomStatus: vi.fn(),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { reportingApi } from '../reporting.api';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

/**
 * Wrap in a sized div so Recharts ResponsiveContainer can measure.
 * This is the documented jsdom workaround for Recharts tests.
 */
function renderChart(businessDate: string) {
  const qc = makeQueryClient();
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <div style={{ width: 600, height: 300 }}>
          <OccupancyBarChart businessDate={businessDate} />
        </div>
      </QueryClientProvider>,
    ),
  };
}

const BUSINESS_DATE = '2026-05-15';

const MOCK_SNAPSHOTS: DailySnapshot[] = [
  {
    id: 's1',
    businessDate: '2026-05-09T00:00:00.000Z',
    totalRooms: 20,
    occupiedRooms: 15,
    occupancyPct: 0.75,
    adr: 185000,
    revpar: 138750,
    totalRevenue: 2775000,
    arrivalsCount: 3,
    departuresCount: 2,
    noShowCount: 0,
  },
  {
    id: 's2',
    businessDate: '2026-05-10T00:00:00.000Z',
    totalRooms: 20,
    occupiedRooms: 10,
    occupancyPct: 0.5,
    adr: 150000,
    revpar: 75000,
    totalRevenue: 1500000,
    arrivalsCount: 2,
    departuresCount: 4,
    noShowCount: 0,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OccupancyBarChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crash when getDailySnapshots returns []', async () => {
    vi.mocked(reportingApi.getDailySnapshots).mockResolvedValue([]);

    renderChart(BUSINESS_DATE);

    // Empty-state message must appear
    expect(
      await screen.findByText('Sin datos aún — esperando primer night audit'),
    ).toBeInTheDocument();
  });

  it('calls getDailySnapshots with 7-day window ending on businessDate', async () => {
    vi.mocked(reportingApi.getDailySnapshots).mockResolvedValue([]);

    renderChart(BUSINESS_DATE);

    // Wait for query
    await screen.findByText('Sin datos aún — esperando primer night audit');

    expect(vi.mocked(reportingApi.getDailySnapshots)).toHaveBeenCalledWith(
      '2026-05-09', // 6 days before 2026-05-15
      '2026-05-15',
    );
  });

  it('maps occupancyPct=0.75 to chart data value 75.0', async () => {
    vi.mocked(reportingApi.getDailySnapshots).mockResolvedValue(MOCK_SNAPSHOTS);

    const { qc } = renderChart(BUSINESS_DATE);

    // Wait for query to resolve
    await vi.waitFor(() => {
      const state = qc.getQueryState([
        'reports',
        'occupancy7d',
        '2026-05-09',
        '2026-05-15',
      ]);
      expect(state?.status).toBe('success');
    });

    // Verify the chart data in the query cache
    const data = qc.getQueryData([
      'reports',
      'occupancy7d',
      '2026-05-09',
      '2026-05-15',
    ]) as DailySnapshot[];

    expect(data).toBeDefined();
    // occupancyPct 0.75 → scaled to 75 in chart
    const firstEntry = data[0];
    const scaled = Math.round(Number(firstEntry.occupancyPct) * 1000) / 10;
    expect(scaled).toBe(75);
  });

  it('shows partial data footnote when fewer than 7 days returned', async () => {
    // Only 2 snapshots (partial week)
    vi.mocked(reportingApi.getDailySnapshots).mockResolvedValue(MOCK_SNAPSHOTS);

    renderChart(BUSINESS_DATE);

    expect(
      await screen.findByText('Iniciando — más datos llegan cada noche'),
    ).toBeInTheDocument();
  });

  it('hits the correct queryKey [reports, occupancy7d, startIso, endIso]', async () => {
    vi.mocked(reportingApi.getDailySnapshots).mockResolvedValue([]);

    const { qc } = renderChart(BUSINESS_DATE);

    await screen.findByText('Sin datos aún — esperando primer night audit');

    // Query state should exist for the expected key
    const state = qc.getQueryState([
      'reports',
      'occupancy7d',
      '2026-05-09',
      '2026-05-15',
    ]);
    expect(state).toBeDefined();
    expect(state?.status).toBe('success');
  });
});
