import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { reportingApi } from './reporting.api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format ISO date string (UTC midnight) → 'DD/MM'
 * Handles both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm:ss.sssZ' formats.
 */
function fmtDateShort(iso: string): string {
  // Take only the date part to avoid UTC offset issues
  const datePart = iso.slice(0, 10);
  const [, m, d] = datePart.split('-');
  return `${d}/${m}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface OccupancyBarChartProps {
  /** Current hotel business date 'YYYY-MM-DD' */
  businessDate: string;
}

/**
 * OccupancyBarChart — 7-day occupancy % BarChart (Recharts 2.x).
 *
 * Fetches the last 7 business dates (inclusive) from /api/reports/daily-snapshots.
 * Empty data: renders empty axes (Recharts handles gracefully — no crash).
 * Partial data (< 7 days): renders available bars + footnote.
 *
 * Bar colors: today's bar → var(--terracotta), other days → var(--mustard).
 * Uses Recharts shape prop (Pattern 2) — CSS variable strings, no Tailwind classes.
 *
 * staleTime: 60s (snapshot data is produced once per night, no need for 30s poll)
 */
export function OccupancyBarChart({ businessDate }: OccupancyBarChartProps) {
  // Compute 6 days back inclusive (7-day window) in UTC to match DATE column
  const end = new Date(businessDate + 'T00:00:00.000Z');
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = businessDate.slice(0, 10);

  const { data = [] } = useQuery({
    queryKey: ['reports', 'occupancy7d', startIso, endIso],
    queryFn: () => reportingApi.getDailySnapshots(startIso, endIso),
    staleTime: 60_000,
  });

  const todayIso = businessDate.slice(0, 10);

  const chartData = data.map((d) => ({
    date: fmtDateShort(d.businessDate),
    occupancyPct: Math.round(Number(d.occupancyPct) * 1000) / 10, // 1 decimal, scaled 0-100
    isToday: d.businessDate.slice(0, 10) === todayIso,
  }));

  const isPartial = chartData.length > 0 && chartData.length < 7;

  return (
    <div>
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[240px] text-sm text-ink-3 text-center px-4">
          Sin datos aún — esperando primer night audit
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--warm-line-strong)"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'var(--ink-3)' }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 12, fill: 'var(--ink-3)' }}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(1)}%`, 'Ocupación']}
              contentStyle={{
                backgroundColor: 'var(--warm-white)',
                border: '1px solid var(--warm-line)',
                color: 'var(--ink-1)',
              }}
            />
            <Bar
              dataKey="occupancyPct"
              radius={[4, 4, 0, 0]}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: { isToday?: boolean } }) => (
                <rect
                  x={props.x}
                  y={props.y}
                  width={props.width}
                  height={props.height}
                  fill={props.payload?.isToday ? 'var(--terracotta)' : 'var(--mustard)'}
                  rx={4}
                />
              )}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
      {isPartial && (
        <p className="text-xs text-ink-3 mt-2 text-center">
          Iniciando — más datos llegan cada noche
        </p>
      )}
    </div>
  );
}
