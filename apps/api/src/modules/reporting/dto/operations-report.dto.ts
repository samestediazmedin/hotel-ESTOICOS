/**
 * OperationsReportDto — shape of the date-range operations report.
 *
 * Aggregated from daily_snapshot rows for the requested date range.
 * All COP amounts are integers (Math.round applied — no decimals).
 * occupancyPct is 0..1 (multiply by 100 for display %).
 */
export interface OperationsReportDto {
  range: {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
  };
  totals: {
    totalRevenue: number;       // COP integer — sum of all daily totalRevenue
    avgOccupancyPct: number;    // 0..1 — arithmetic mean of daily occupancyPct
    avgAdr: number;             // COP integer — arithmetic mean of daily ADR
    avgRevpar: number;          // COP integer — arithmetic mean of daily RevPAR
    totalArrivals: number;      // sum of daily arrivalsCount
    totalDepartures: number;    // sum of daily departuresCount
    daysCount: number;          // number of daily_snapshot rows found
  };
  daily: Array<{
    businessDate: string;       // YYYY-MM-DD
    occupancyPct: number;       // 0..1
    adr: number;                // COP integer
    revpar: number;             // COP integer
    arrivalsCount: number;
    departuresCount: number;
    totalRevenue: number;       // COP integer
  }>;
}
