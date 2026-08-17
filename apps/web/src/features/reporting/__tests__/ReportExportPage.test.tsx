/**
 * ReportExportPage tests — Phase 06 Plan 03
 *
 * Tests cover:
 * - Page renders with default date range
 * - "Generar resumen" calls getOperationsReport with form values
 * - Reversed range shows inline error and does NOT call API
 * - "Descargar CSV" invokes reportingApi.downloadCsv
 * - "Descargar PDF" with mocked 400 response surfaces the Spanish error message
 * - Empty data (daysCount=0) renders "No hay datos para este rango"
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ReportExportPage } from '../ReportExportPage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../reporting.api', () => ({
  reportingApi: {
    getOperationsReport: vi.fn(),
    downloadCsv: vi.fn(),
    downloadPdf: vi.fn(),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_REPORT = {
  range: { startDate: '2026-05-09', endDate: '2026-05-15' },
  totals: {
    totalRevenue: 0,
    avgOccupancyPct: 0,
    avgAdr: 0,
    avgRevpar: 0,
    totalArrivals: 0,
    totalDepartures: 0,
    daysCount: 0,
  },
  daily: [],
};

const REPORT_WITH_DATA = {
  range: { startDate: '2026-05-09', endDate: '2026-05-15' },
  totals: {
    totalRevenue: 6475000,
    avgOccupancyPct: 0.75,
    avgAdr: 185000,
    avgRevpar: 138750,
    totalArrivals: 35,
    totalDepartures: 28,
    daysCount: 7,
  },
  daily: [
    {
      businessDate: '2026-05-09',
      occupancyPct: 0.75,
      adr: 185000,
      revpar: 138750,
      arrivalsCount: 5,
      departuresCount: 4,
      totalRevenue: 925000,
    },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { reportingApi } from '../reporting.api';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={makeQueryClient()}>
        <ReportExportPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReportExportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: page renders with form controls ───────────────────────────────

  it('renders date inputs and action buttons', () => {
    renderPage();

    expect(screen.getByLabelText(/fecha inicio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha fin/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generar resumen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar pdf/i })).toBeInTheDocument();
  });

  // ── Test 2: default range is 7 days ──────────────────────────────────────

  it('renders with a default date range (7 days)', () => {
    renderPage();

    const startInput = screen.getByLabelText(/fecha inicio/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/fecha fin/i) as HTMLInputElement;

    // Both inputs should have values (non-empty)
    expect(startInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // startDate should be 6 days before endDate
    const startMs = new Date(startInput.value).getTime();
    const endMs = new Date(endInput.value).getTime();
    expect(endMs - startMs).toBe(6 * 86400000);
  });

  // ── Test 3: reversed range shows inline error and does NOT call API ───────

  it('shows inline error when startDate > endDate, does not call API', async () => {
    renderPage();

    // Set reversed range
    fireEvent.change(screen.getByLabelText(/fecha inicio/i), {
      target: { value: '2026-05-15' },
    });
    fireEvent.change(screen.getByLabelText(/fecha fin/i), {
      target: { value: '2026-05-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generar resumen/i }));

    expect(
      screen.getByText(/la fecha de inicio no puede ser posterior/i),
    ).toBeInTheDocument();
    expect(reportingApi.getOperationsReport).not.toHaveBeenCalled();
  });

  // ── Test 4: "Generar resumen" calls getOperationsReport with form values ──

  it('calls getOperationsReport with the current form dates', async () => {
    vi.mocked(reportingApi.getOperationsReport).mockResolvedValue(REPORT_WITH_DATA);
    renderPage();

    // Set a valid range
    fireEvent.change(screen.getByLabelText(/fecha inicio/i), {
      target: { value: '2026-05-09' },
    });
    fireEvent.change(screen.getByLabelText(/fecha fin/i), {
      target: { value: '2026-05-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generar resumen/i }));

    await waitFor(() => {
      expect(reportingApi.getOperationsReport).toHaveBeenCalledWith(
        '2026-05-09',
        '2026-05-15',
      );
    });
  });

  // ── Test 5: empty data renders "No hay datos para este rango" ─────────────

  it('renders empty state message when daysCount=0', async () => {
    vi.mocked(reportingApi.getOperationsReport).mockResolvedValue(EMPTY_REPORT);
    renderPage();

    fireEvent.change(screen.getByLabelText(/fecha inicio/i), {
      target: { value: '2026-05-09' },
    });
    fireEvent.change(screen.getByLabelText(/fecha fin/i), {
      target: { value: '2026-05-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generar resumen/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/no hay datos para este rango/i),
      ).toBeInTheDocument();
    });
  });

  // ── Test 6: "Descargar CSV" invokes reportingApi.downloadCsv ──────────────

  it('calls reportingApi.downloadCsv with form dates on CSV button click', async () => {
    vi.mocked(reportingApi.downloadCsv).mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByLabelText(/fecha inicio/i), {
      target: { value: '2026-05-01' },
    });
    fireEvent.change(screen.getByLabelText(/fecha fin/i), {
      target: { value: '2026-05-07' },
    });
    fireEvent.click(screen.getByRole('button', { name: /descargar csv/i }));

    await waitFor(() => {
      expect(reportingApi.downloadCsv).toHaveBeenCalledWith('2026-05-01', '2026-05-07');
    });
  });

  // ── Test 7: "Descargar PDF" surfaces Spanish 400 error message ─────────────

  it('surfaces Spanish 400 error message when PDF range > 31 days', async () => {
    const spanishMsg =
      'El reporte PDF está limitado a 31 días. Use formato CSV para rangos mayores.';
    vi.mocked(reportingApi.downloadPdf).mockRejectedValue({
      response: { data: { message: spanishMsg } },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText(/fecha inicio/i), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByLabelText(/fecha fin/i), {
      target: { value: '2026-02-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: /descargar pdf/i }));

    await waitFor(() => {
      expect(screen.getByText(spanishMsg)).toBeInTheDocument();
    });
  });

  // ── Test 8: report with data shows KPI cards ──────────────────────────────

  it('shows KPI summary cards after successful fetch', async () => {
    vi.mocked(reportingApi.getOperationsReport).mockResolvedValue(REPORT_WITH_DATA);
    renderPage();

    fireEvent.change(screen.getByLabelText(/fecha inicio/i), {
      target: { value: '2026-05-09' },
    });
    fireEvent.change(screen.getByLabelText(/fecha fin/i), {
      target: { value: '2026-05-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generar resumen/i }));

    await waitFor(() => {
      expect(screen.getByText('Ingreso total')).toBeInTheDocument();
      expect(screen.getByText('Ocupación prom.')).toBeInTheDocument();
    });
  });
});
