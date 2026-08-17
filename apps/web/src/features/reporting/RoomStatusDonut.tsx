import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { STATUS_COLORS } from '@/lib/status-colors';
import type { RoomStatus } from '@/components/ui/status-pill';

// ─── Component ────────────────────────────────────────────────────────────────

interface RoomStatusBreakdown {
  occupied:    number;
  cleaning:    number;
  maintenance: number;
  available:   number;
}

interface RoomStatusDonutProps {
  breakdown: RoomStatusBreakdown;
}

/**
 * RoomStatusDonut — Recharts PieChart donut with 4 segments.
 *
 * Shows room distribution by status. innerRadius=60, outerRadius=90 → donut.
 * Colors: consumed from STATUS_COLORS (@/lib/status-colors) — CSS variable strings,
 * dark mode compatible, zero hex literals.
 * Empty (total=0): renders a placeholder message instead of crashing.
 */
export function RoomStatusDonut({ breakdown }: RoomStatusDonutProps) {
  const data: Array<{ name: string; value: number; statusKey: RoomStatus }> = [
    { name: 'Ocupadas',      value: breakdown.occupied,    statusKey: 'occupied' },
    { name: 'Limpieza',      value: breakdown.cleaning,    statusKey: 'cleaning' },
    { name: 'Mantenimiento', value: breakdown.maintenance, statusKey: 'maintenance' },
    { name: 'Disponibles',   value: breakdown.available,   statusKey: 'available' },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-sm text-ink-3">
        Sin habitaciones registradas
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={STATUS_COLORS[entry.statusKey]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => [`${v} hab.`, '']}
          contentStyle={{
            backgroundColor: 'var(--warm-white)',
            border: '1px solid var(--warm-line)',
            color: 'var(--ink-1)',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
