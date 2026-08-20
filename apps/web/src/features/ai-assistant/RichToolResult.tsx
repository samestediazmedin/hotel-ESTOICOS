import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

// ─── COP formatter ────────────────────────────────────────────────────────────

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatCOP(value: number | string | undefined | null): string {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  return Number.isNaN(n) ? '—' : copFormatter.format(n);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RichToolResultProps {
  toolName: string;
  result?: unknown;
  error?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * RichToolResult — renders a tool result in a shape-aware way.
 *
 * Covers all 7 tool output shapes from Phase 07-01.
 * Action buttons use navigate() — they NEVER call mutation APIs.
 */
export function RichToolResult({ toolName, result, error }: RichToolResultProps) {
  const navigate = useNavigate();

  if (error) {
    return (
      <div className="rounded-lg border border-status-in-progress bg-red-50 p-3 text-xs text-status-in-progress">
        Error en herramienta <strong>{toolName}</strong>: {error}
      </div>
    );
  }

  if (!result) return null;

  switch (toolName) {
    // ── get_availability ────────────────────────────────────────────────────
    case 'get_availability': {
      // Backend returns { rooms: RoomRow[], truncated: boolean, total: number }.
      // The old "flat array + sentinel row" format was never the real shape.
      const envelope = result as {
        rooms?: Array<{
          roomNumber?: string;
          typeName?: string;
          floor?: number;
          pricePerNight?: number;
        }>;
        truncated?: boolean;
        total?: number;
      };
      const dataRows = Array.isArray(envelope.rooms) ? envelope.rooms : [];
      const truncated = envelope.truncated ?? false;
      const total = envelope.total ?? dataRows.length;
      return (
        <div className="overflow-hidden rounded-lg border border-warm-line">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Habitación</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Piso</TableHead>
                <TableHead>Precio/noche</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataRows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.roomNumber ?? '—'}</TableCell>
                  <TableCell>{r.typeName ?? '—'}</TableCell>
                  <TableCell>{r.floor ?? '—'}</TableCell>
                  <TableCell>{formatCOP(r.pricePerNight)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {truncated && (
            <p className="px-3 py-2 text-xs text-ink-3">
              Resultados truncados (mostrando {dataRows.length} de {total} total)
            </p>
          )}
        </div>
      );
    }

    // ── get_checkins_today / get_checkouts_today ─────────────────────────────
    case 'get_checkins_today':
    case 'get_checkouts_today': {
      // Backend returns { checkins/checkouts: Row[], truncated, total }.
      const envelope = result as {
        checkins?: Array<{ reservationId?: string; guestName?: string; roomNumber?: string; checkInDate?: string; status?: string }>;
        checkouts?: Array<{ reservationId?: string; guestName?: string; roomNumber?: string; checkOutDate?: string; folioBalance?: number }>;
        truncated?: boolean;
        total?: number;
      };
      const rows = Array.isArray(envelope.checkins)
        ? envelope.checkins
        : Array.isArray(envelope.checkouts)
          ? envelope.checkouts
          : [];
      return (
        <div className="overflow-hidden rounded-lg border border-warm-line">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reserva</TableHead>
                <TableHead>Huésped</TableHead>
                <TableHead>Habitación</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.reservationId?.slice(0, 8) ?? '—'}</TableCell>
                  <TableCell>{r.guestName ?? '—'}</TableCell>
                  <TableCell>{r.roomNumber ?? '—'}</TableCell>
                  <TableCell>{'checkInDate' in r ? r.checkInDate : 'checkOutDate' in r ? (r as { checkOutDate?: string }).checkOutDate : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }

    // ── get_occupancy_kpi ────────────────────────────────────────────────────
    case 'get_occupancy_kpi': {
      const kpi = result as {
        occupancyPct?: number;
        adr?: number;
        revpar?: number;
        totalRevenue?: number;
      };
      return (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Ocupación', value: kpi.occupancyPct != null ? `${Math.round(kpi.occupancyPct * 100)}%` : '—' },
            { label: 'ADR', value: formatCOP(kpi.adr) },
            { label: 'RevPAR', value: formatCOP(kpi.revpar) },
            { label: 'Ingresos', value: formatCOP(kpi.totalRevenue) },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-warm-line bg-warm-white p-3"
            >
              <p className="text-xs text-ink-3">{item.label}</p>
              <p className="text-sm font-semibold text-ink-1">{item.value}</p>
            </div>
          ))}
        </div>
      );
    }

    // ── get_folio_summary ────────────────────────────────────────────────────
    case 'get_folio_summary': {
      const folio = result as {
        reservationId?: string;
        totalBalance?: number;
        isOpen?: boolean;
        itemCount?: number;
      };
      return (
        <div className="rounded-lg border border-warm-line bg-warm-white p-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-ink-3">Folio</p>
            <p className="text-sm font-semibold text-ink-1">
              {formatCOP(folio.totalBalance)}
            </p>
            <p className="text-xs text-ink-3">
              {folio.itemCount ?? 0} concepto(s)
            </p>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              folio.isOpen
                ? 'bg-green-100 text-green-700'
                : 'bg-warm-white-hover text-ink-3'
            }`}
          >
            {folio.isOpen ? 'Abierto' : 'Cerrado'}
          </span>
          {folio.reservationId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/folios/${folio.reservationId}`)}
            >
              Ver folio
            </Button>
          )}
        </div>
      );
    }

    // ── find_guest ───────────────────────────────────────────────────────────
    case 'find_guest': {
      // Backend returns { guests: GuestRow[], truncated: boolean, total: number }.
      const envelope = result as {
        guests?: Array<{
          id?: string;
          fullName?: string;
          nationality?: string;
          totalStays?: number;
        }>;
        truncated?: boolean;
        total?: number;
      };
      const guests = Array.isArray(envelope.guests) ? envelope.guests : [];
      return (
        <div className="flex flex-col gap-2">
          {guests.map((g, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-warm-line bg-warm-white px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-ink-1">{g.fullName ?? '—'}</p>
                <p className="text-xs text-ink-3">
                  {g.nationality ?? ''} · {g.totalStays ?? 0} estada(s)
                </p>
              </div>
              {g.id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/guests/${g.id}`)}
                >
                  Ver perfil
                </Button>
              )}
            </div>
          ))}
        </div>
      );
    }

    // ── get_reservation ──────────────────────────────────────────────────────
    case 'get_reservation': {
      const res = result as {
        id?: string;
        status?: string;
        checkIn?: string;
        checkOut?: string;
        guestName?: string;
        roomNumber?: string;
      };
      return (
        <div className="rounded-lg border border-warm-line bg-warm-white p-3 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-ink-3 font-mono">{res.id?.slice(0, 8) ?? '—'}</p>
            <p className="text-sm font-medium text-ink-1">{res.guestName ?? '—'}</p>
            <p className="text-xs text-ink-3">
              Hab. {res.roomNumber ?? '—'} · {res.checkIn ?? '—'} → {res.checkOut ?? '—'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-warm-white-hover text-ink-3 font-medium">
              {res.status ?? '—'}
            </span>
            {res.id && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/reservations/${res.id}`)}
              >
                Ver reserva
              </Button>
            )}
          </div>
        </div>
      );
    }

    // ── Fallback ─────────────────────────────────────────────────────────────
    default: {
      return (
        <div className="rounded-lg border border-warm-line bg-warm-white p-3 text-xs text-ink-3">
          <strong>{toolName}</strong>:{' '}
          <code className="break-all">{JSON.stringify(result, null, 2)}</code>
        </div>
      );
    }
  }
}
