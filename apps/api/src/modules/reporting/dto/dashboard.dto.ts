/**
 * DashboardDto — shape returned by GET /api/reports/dashboard
 *
 * snapshot is null when no DailySnapshot row exists for the current businessDate
 * (new hotel or audit has not yet run for today).
 *
 * All COP amounts are integers (Math.round applied in DashboardService).
 * occupancyPct is 0..1 — the frontend multiplies by 100 to display percentage.
 */
export interface SnapshotDto {
  occupancyPct: number; // 0..1 (frontend multiplies by 100)
  adr: number; // COP integer
  revpar: number; // COP integer
  totalRevenue: number; // COP integer
  arrivalsCount: number;
  departuresCount: number;
  noShowCount: number;
}

export interface RoomStatusBreakdownDto {
  occupied: number;
  cleaning: number;
  maintenance: number;
  available: number;
}

export interface LiveKpisDto {
  roomsInCleaning: number;
  activeServiceRequests: number;
  roomStatusBreakdown: RoomStatusBreakdownDto;
}

export interface DashboardDto {
  businessDate: string; // YYYY-MM-DD
  snapshot: SnapshotDto | null;
  liveKpis: LiveKpisDto;
}
