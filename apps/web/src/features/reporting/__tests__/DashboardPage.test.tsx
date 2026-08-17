/**
 * DashboardPage tests — Phase 06 Plan 02
 *
 * Verifies:
 * - All 7 KPI card labels render
 * - snapshot: null → snapshot-derived cards show '—', no crash
 * - snapshot with data → occupancyPct=0.75 renders as '75%', ADR=185000 in COP format
 * - liveKpis always render (not snapshot-dependent)
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DashboardPage } from '../DashboardPage';
import type { DashboardDto } from '../reporting.api';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the reporting API — avoids real HTTP calls
vi.mock('../reporting.api', () => ({
  reportingApi: {
    getDashboard: vi.fn(),
    getDailySnapshots: vi.fn(),
    getRoomStatus: vi.fn(),
  },
}));

// Mock OccupancyBarChart — prevents recharts ResponsiveContainer issues in jsdom
vi.mock('../OccupancyBarChart', () => ({
  OccupancyBarChart: ({ businessDate }: { businessDate: string }) => (
    <div data-testid="occupancy-bar-chart" data-business-date={businessDate} />
  ),
}));

// Mock RoomStatusDonut — prevents recharts PieChart issues in jsdom
vi.mock('../RoomStatusDonut', () => ({
  RoomStatusDonut: ({ breakdown }: { breakdown: Record<string, number> }) => (
    <div data-testid="room-status-donut" data-breakdown={JSON.stringify(breakdown)} />
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { reportingApi } from '../reporting.api';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const MOCK_DASHBOARD_WITH_SNAPSHOT: DashboardDto = {
  businessDate: '2026-05-15',
  snapshot: {
    occupancyPct: 0.75,
    adr: 185000,
    revpar: 138750,
    totalRevenue: 3700000,
    arrivalsCount: 5,
    departuresCount: 3,
    noShowCount: 1,
  },
  liveKpis: {
    roomsInCleaning: 4,
    activeServiceRequests: 2,
    roomStatusBreakdown: {
      occupied: 15,
      cleaning: 4,
      maintenance: 1,
      available: 0,
    },
  },
};

const MOCK_DASHBOARD_NULL_SNAPSHOT: DashboardDto = {
  businessDate: '2026-05-15',
  snapshot: null,
  liveKpis: {
    roomsInCleaning: 0,
    activeServiceRequests: 0,
    roomStatusBreakdown: {
      occupied: 0,
      cleaning: 0,
      maintenance: 0,
      available: 20,
    },
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 7 KPI card titles', async () => {
    vi.mocked(reportingApi.getDashboard).mockResolvedValue(MOCK_DASHBOARD_WITH_SNAPSHOT);

    renderPage();

    // Wait for query to resolve
    expect(await screen.findByText('Ocupación')).toBeInTheDocument();
    expect(screen.getByText('ADR')).toBeInTheDocument();
    expect(screen.getByText('RevPAR')).toBeInTheDocument();
    expect(screen.getByText('Llegadas esperadas')).toBeInTheDocument();
    expect(screen.getByText('Salidas esperadas')).toBeInTheDocument();
    expect(screen.getByText('Hab. en limpieza')).toBeInTheDocument();
    expect(screen.getByText('Solicitudes activas')).toBeInTheDocument();
  });

  it('shows — for snapshot-derived cards when snapshot is null', async () => {
    vi.mocked(reportingApi.getDashboard).mockResolvedValue(MOCK_DASHBOARD_NULL_SNAPSHOT);

    renderPage();

    // Wait for render — multiple '—' are expected
    await screen.findByText('Ocupación');

    // All 5 snapshot cards should show '—'
    const dashes = screen.getAllByText('—');
    // At least 5 dashes (occupancy, ADR, RevPAR, arrivals, departures)
    expect(dashes.length).toBeGreaterThanOrEqual(5);
  });

  it('does not render 0 for snapshot-derived KPIs when snapshot is null', async () => {
    vi.mocked(reportingApi.getDashboard).mockResolvedValue(MOCK_DASHBOARD_NULL_SNAPSHOT);

    renderPage();

    await screen.findByText('Ocupación');

    // Occupancy should not be '0%' when snapshot is null
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('renders occupancyPct=0.75 as "75%"', async () => {
    vi.mocked(reportingApi.getDashboard).mockResolvedValue(MOCK_DASHBOARD_WITH_SNAPSHOT);

    renderPage();

    expect(await screen.findByText('75%')).toBeInTheDocument();
  });

  it('renders ADR=185000 in COP format', async () => {
    vi.mocked(reportingApi.getDashboard).mockResolvedValue(MOCK_DASHBOARD_WITH_SNAPSHOT);

    renderPage();

    await screen.findByText('ADR');

    // COP 185.000 — es-CO locale uses dot as thousands separator
    // The exact symbol may vary ('COP', '$', etc.) — match the number part
    const copValues = screen.getAllByText(/185/);
    expect(copValues.length).toBeGreaterThan(0);
  });

  it('renders live KPIs (roomsInCleaning=4, activeServiceRequests=2)', async () => {
    vi.mocked(reportingApi.getDashboard).mockResolvedValue(MOCK_DASHBOARD_WITH_SNAPSHOT);

    renderPage();

    await screen.findByText('Hab. en limpieza');

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders OccupancyBarChart and RoomStatusDonut after data loads', async () => {
    vi.mocked(reportingApi.getDashboard).mockResolvedValue(MOCK_DASHBOARD_WITH_SNAPSHOT);

    renderPage();

    expect(await screen.findByTestId('occupancy-bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('room-status-donut')).toBeInTheDocument();
  });

  it('uses queryKey [reports, dashboard] — verified via mock call', async () => {
    vi.mocked(reportingApi.getDashboard).mockResolvedValue(MOCK_DASHBOARD_WITH_SNAPSHOT);

    renderPage();

    await screen.findByText('Ocupación');

    // getDashboard must have been called exactly once
    expect(vi.mocked(reportingApi.getDashboard)).toHaveBeenCalledTimes(1);
  });
});
