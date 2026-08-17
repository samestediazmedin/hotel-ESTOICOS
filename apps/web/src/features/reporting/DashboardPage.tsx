import { useQuery } from '@tanstack/react-query';
import { reportingApi, type DashboardDto } from './reporting.api';
import { KpiCard } from './KpiCard';
import { OccupancyBarChart } from './OccupancyBarChart';
import { RoomStatusDonut } from './RoomStatusDonut';
import { formatCOP, formatPct } from './lib/format-cop';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format 'YYYY-MM-DD' → 'DD/MM/YYYY' */
function fmtBusinessDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="bg-warm-paper border border-warm-line rounded-xl p-4 animate-pulse">
      <div className="h-3 w-24 bg-warm-cream rounded mb-3" />
      <div className="h-8 w-16 bg-warm-cream rounded" />
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <KpiSkeleton key={i} />
      ))}
    </div>
  );
}

// ─── KPI grid ─────────────────────────────────────────────────────────────────

interface KpiGridProps {
  data: DashboardDto;
}

function KpiGrid({ data }: KpiGridProps) {
  const { snapshot, liveKpis } = data;

  const noSnapshotSubtitle = snapshot === null
    ? 'Sin datos aún (esperando primer cierre de día)'
    : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Ocupación */}
      <KpiCard
        title="Ocupación"
        value={snapshot !== null ? formatPct(snapshot.occupancyPct) : '—'}
        subtitle={noSnapshotSubtitle}
      />

      {/* 2. ADR */}
      <KpiCard
        title="ADR"
        value={snapshot !== null ? formatCOP(snapshot.adr) : '—'}
        subtitle={noSnapshotSubtitle}
      />

      {/* 3. RevPAR */}
      <KpiCard
        title="RevPAR"
        value={snapshot !== null ? formatCOP(snapshot.revpar) : '—'}
        subtitle={noSnapshotSubtitle}
      />

      {/* 4. Llegadas esperadas */}
      <KpiCard
        title="Llegadas esperadas"
        value={snapshot !== null ? snapshot.arrivalsCount : '—'}
        subtitle={noSnapshotSubtitle}
      />

      {/* 5. Salidas esperadas */}
      <KpiCard
        title="Salidas esperadas"
        value={snapshot !== null ? snapshot.departuresCount : '—'}
        subtitle={noSnapshotSubtitle}
      />

      {/* 6. Habitaciones en limpieza (live — no snapshot needed) */}
      <KpiCard
        title="Hab. en limpieza"
        value={liveKpis.roomsInCleaning}
      />

      {/* 7. Solicitudes activas (live — no snapshot needed) */}
      <KpiCard
        title="Solicitudes activas"
        value={liveKpis.activeServiceRequests}
      />
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

/**
 * DashboardPage — Phase 6 Plan 02 (restyled Phase 11 Plan 03).
 *
 * Shows:
 * - Header with Instrument Serif italic heading + current business date
 * - 7 KPI cards sourced exclusively from /api/reports/dashboard
 * - 7-day occupancy BarChart from /api/reports/daily-snapshots
 * - Room status donut from dashboard.liveKpis.roomStatusBreakdown
 *
 * Polls every 30s via TanStack Query refetchInterval.
 * No direct /api/reservations or prisma. calls — reporting feature boundary enforced.
 */
export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: reportingApi.getDashboard,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen bg-warm-paper p-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="font-display italic text-3xl text-ink-1">
          Buen día
          {data?.businessDate && (
            <span className="not-italic font-normal text-ink-3 text-xl ml-2">
              — {fmtBusinessDate(data.businessDate)}
            </span>
          )}
        </h1>
        <p className="text-sm text-ink-3 mt-1">
          Actualización automática cada 30 segundos
        </p>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && !data && (
        <div className="mb-4 rounded-lg border px-4 py-3 text-sm"
          style={{ background: 'var(--terracotta-tint)', borderColor: 'var(--terracotta-soft)', color: 'var(--terracotta-deep)' }}>
          No se pudo cargar el dashboard. Intente de nuevo.
        </div>
      )}

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      {isLoading && !data ? (
        <GridSkeleton />
      ) : data ? (
        <KpiGrid data={data} />
      ) : null}

      {/* ── Section divider ───────────────────────────────────────────────── */}
      {data && <div className="border-t border-warm-line my-8" />}

      {/* ── Charts row ────────────────────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Occupancy 7-day BarChart */}
          <div className="bg-warm-paper border border-warm-line rounded-xl p-5">
            <h2 className="text-sm font-semibold text-ink-2 mb-4 uppercase tracking-wide">
              Ocupación 7 días
            </h2>
            <OccupancyBarChart businessDate={data.businessDate} />
          </div>

          {/* Room status donut */}
          <div className="bg-warm-paper border border-warm-line rounded-xl p-5">
            <h2 className="text-sm font-semibold text-ink-2 mb-4 uppercase tracking-wide">
              Estado de habitaciones
            </h2>
            <RoomStatusDonut breakdown={data.liveKpis.roomStatusBreakdown} />
          </div>
        </div>
      )}
    </div>
  );
}
