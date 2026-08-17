import { api } from '@/lib/api';

// ─── Reporting export types (Plan 06-03) ──────────────────────────────────────

export interface OperationsReportTotals {
  totalRevenue: number;       // COP integer
  avgOccupancyPct: number;    // 0..1
  avgAdr: number;             // COP integer
  avgRevpar: number;          // COP integer
  totalArrivals: number;
  totalDepartures: number;
  daysCount: number;
}

export interface OperationsReportDaily {
  businessDate: string;       // YYYY-MM-DD
  occupancyPct: number;       // 0..1
  adr: number;                // COP integer
  revpar: number;             // COP integer
  arrivalsCount: number;
  departuresCount: number;
  totalRevenue: number;       // COP integer
}

export interface OperationsReportDto {
  range: { startDate: string; endDate: string };
  totals: OperationsReportTotals;
  daily: OperationsReportDaily[];
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardSnapshot {
  occupancyPct: number;       // 0..1 — multiply by 100 for display
  adr: number;                // COP integer
  revpar: number;             // COP integer
  totalRevenue: number;       // COP integer
  arrivalsCount: number;
  departuresCount: number;
  noShowCount: number;
}

export interface DashboardLiveKpis {
  roomsInCleaning: number;
  activeServiceRequests: number;
  roomStatusBreakdown: {
    occupied: number;
    cleaning: number;
    maintenance: number;
    available: number;
  };
}

export interface DashboardDto {
  businessDate: string;           // 'YYYY-MM-DD'
  snapshot: DashboardSnapshot | null;   // null when no night audit has run yet
  liveKpis: DashboardLiveKpis;
}

export interface DailySnapshot {
  id: string;
  businessDate: string;     // ISO datetime (UTC midnight) — e.g. '2026-05-15T00:00:00.000Z'
  totalRooms: number;
  occupiedRooms: number;
  occupancyPct: number;     // 0..1
  adr: number;
  revpar: number;
  totalRevenue: number;
  arrivalsCount: number;
  departuresCount: number;
  noShowCount: number;
}

export interface RoomStatusBreakdown {
  occupied: number;
  reserved: number;
  cleaning: number;
  maintenance: number;
  available: number;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const reportingApi = {
  /**
   * GET /api/reports/dashboard
   * Returns latest daily_snapshot + live room/task counts.
   * snapshot is null on day-1 before first night audit.
   */
  getDashboard: (): Promise<DashboardDto> =>
    api.get<DashboardDto>('/reports/dashboard').then((r) => r.data),

  /**
   * GET /api/reports/daily-snapshots?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
   * Returns DailySnapshot[] ordered ASC by businessDate.
   * Used by OccupancyBarChart for the 7-day window.
   */
  getDailySnapshots: (startDate: string, endDate: string): Promise<DailySnapshot[]> =>
    api
      .get<DailySnapshot[]>('/reports/daily-snapshots', {
        params: { startDate, endDate },
      })
      .then((r) => r.data),

  /**
   * GET /api/reports/room-status
   * Returns { occupied, reserved, cleaning, maintenance, available } live counts.
   */
  getRoomStatus: (): Promise<RoomStatusBreakdown> =>
    api.get<RoomStatusBreakdown>('/reports/room-status').then((r) => r.data),

  // ─── Plan 06-03: Export methods ─────────────────────────────────────────────

  /**
   * GET /api/reports/operations?startDate=&endDate=
   * Returns aggregated OperationsReportDto for preview in the UI.
   * ADMIN and MANAGER only — 403 for other roles (server enforces).
   */
  getOperationsReport: (startDate: string, endDate: string): Promise<OperationsReportDto> =>
    api
      .get<OperationsReportDto>('/reports/operations', {
        params: { startDate, endDate },
      })
      .then((r) => r.data),

  /**
   * GET /api/reports/operations/export/csv?startDate=&endDate=
   * Downloads CSV file via Blob + URL.createObjectURL (JWT via interceptor).
   * No token in URL — auth handled by axios interceptor.
   */
  downloadCsv: async (startDate: string, endDate: string): Promise<void> => {
    const res = await api.get('/reports/operations/export/csv', {
      params: { startDate, endDate },
      responseType: 'blob',
    });
    triggerDownload(
      res.data as Blob,
      `reporte-operacional-${startDate}-to-${endDate}.csv`,
    );
  },

  /**
   * GET /api/reports/operations/export/pdf?startDate=&endDate=
   * Downloads PDF file via Blob + URL.createObjectURL (JWT via interceptor).
   * Backend returns 400 if range > 31 days — catch and surface Spanish message.
   */
  downloadPdf: async (startDate: string, endDate: string): Promise<void> => {
    const res = await api.get('/reports/operations/export/pdf', {
      params: { startDate, endDate },
      responseType: 'blob',
    });
    triggerDownload(
      res.data as Blob,
      `reporte-operacional-${startDate}-to-${endDate}.pdf`,
    );
  },
};

// ─── Blob download helper ─────────────────────────────────────────────────────

/**
 * triggerDownload — create a temporary <a> element to trigger browser file download.
 *
 * Uses URL.createObjectURL (JWT auth via interceptor, no token in URL).
 * Revokes the object URL after click to free memory.
 * Pattern from Phase 04-03 folio.api.ts (downloadFolioPdf).
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
