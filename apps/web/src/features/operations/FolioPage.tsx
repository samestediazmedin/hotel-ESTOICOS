import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { formatDisplayDate } from '@/lib/date';
import { getFolio, voidCharge, downloadFolioPdf } from './folio.api';
import type { FolioItemDto } from './folio.api';
import { PostChargeModal } from './PostChargeModal';

// ─── COP Formatter (P13 — es-CO currency, no decimals) ───────────────────────

/**
 * formatCOP — formats a number as Colombian Peso currency.
 * Uses Intl.NumberFormat in browser context (not react-pdf — P13).
 * No decimals (COP is an integer currency in practice).
 */
function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── FolioItemTypeLabel ───────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  ROOM_CHARGE: 'Cargo habitación',
  MANUAL_CHARGE: 'Cargo manual',
  VOID: 'Anulado',
  ADJUSTMENT: 'Ajuste',
  TAX: 'IVA',
};

// ─── FolioPage ────────────────────────────────────────────────────────────────

/**
 * isAutomaticCharge — returns true for charges posted by the night audit cron.
 *
 * Night audit charges have predictable description prefixes (RESEARCH 3.7):
 *  - ROOM_CHARGE: description starts with "Habitación"
 *  - TAX: description starts with "IVA"
 *
 * Also covers TAX items by type — any TAX line is IVA (automatic).
 */
function isAutomaticCharge(item: FolioItemDto): boolean {
  return (
    item.type === 'ROOM_CHARGE' ||
    item.type === 'TAX' ||
    item.description.startsWith('Habitación') ||
    item.description.startsWith('IVA')
  );
}

/**
 * FolioPage — itemized folio view with running balance.
 *
 * Route: /folios/:reservationId
 * Protected: ADMIN, MANAGER, RECEPTION only.
 *
 * Features:
 *  - Itemized charges table with COP formatting (no decimals, es-CO)
 *  - Running balance = sum of (amount + taxAmount) across all items
 *  - "Automático" badge for night-audit charges; "Manual" badge for staff charges
 *  - postedAt timestamp (formatDisplayDate) and type label per row
 *  - "Agregar cargo" button when folio is OPEN (disabled when SETTLED)
 *  - "Folio cerrado" badge + snapshotHash (truncated) when SETTLED
 *  - Void button per non-VOID item when folio is OPEN
 */
export function FolioPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const queryClient = useQueryClient();
  const [showPostCharge, setShowPostCharge] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const { data: folio, isLoading, error } = useQuery({
    queryKey: ['staff', 'folios', reservationId],
    queryFn: () => getFolio(reservationId!),
    enabled: !!reservationId,
  });

  const voidMutation = useMutation({
    mutationFn: (itemId: string) => voidCharge(folio!.id, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'folios'] });
    },
  });

  async function handleDownloadPdf() {
    if (!folio) return;
    setIsPdfLoading(true);
    try {
      await downloadFolioPdf(folio.id);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Error al generar el PDF';
      alert(message);
    } finally {
      setIsPdfLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-ink-3 text-sm text-center py-12">Cargando folio...</div>
      </div>
    );
  }

  if (error || !folio) {
    return (
      <div className="p-6">
        <div className="text-red-600 text-sm">
          {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al cargar el folio.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-ink-1 text-2xl font-semibold">Folio</h1>
          <p className="text-ink-3 text-sm mt-1 font-mono">
            #{folio.id.slice(-12).toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {folio.isOpen ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
              Abierto
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warm-cream text-ink-3 border border-warm-line">
              Folio cerrado
            </span>
          )}
          {/* Descargar PDF — disabled when OPEN (backend also enforces SETTLED-only) */}
          <button
            onClick={() => void handleDownloadPdf()}
            disabled={folio.isOpen || isPdfLoading}
            title={
              folio.isOpen
                ? 'Disponible solo para folios cerrados'
                : isPdfLoading
                ? 'Generando PDF...'
                : 'Descargar PDF'
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-warm-line bg-warm-cream px-3 py-1.5 text-sm font-medium text-ink-1 transition-colors hover:bg-warm-white-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPdfLoading ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>
      </div>

      {/* Snapshot hash (only when SETTLED) */}
      {!folio.isOpen && folio.snapshotHash && (
        <div className="bg-warm-cream rounded-lg border border-warm-line p-4">
          <p className="text-ink-3 text-xs mb-1">Hash SHA-256 de liquidación</p>
          <p className="font-mono text-xs text-ink-2 break-all">{folio.snapshotHash}</p>
          <p className="text-ink-3 text-xs mt-1">
            Cerrado el {folio.closedAt ? new Date(folio.closedAt).toLocaleDateString('es-CO') : '—'}
          </p>
        </div>
      )}

      {/* Items table */}
      <div className="bg-warm-white border border-warm-line rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-line">
          <h2 className="text-ink-1 text-sm font-semibold">
            Cargos ({folio.items.length})
          </h2>
          {folio.isOpen && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowPostCharge(true)}
            >
              + Agregar cargo
            </Button>
          )}
        </div>

        {folio.items.length === 0 ? (
          <div className="text-ink-3 text-sm text-center py-8">
            Sin cargos registrados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-warm-cream">
                <tr className="text-ink-3 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Descripción</th>
                  <th className="px-3 py-3 text-center">Tipo</th>
                  <th className="px-3 py-3 text-center">Origen</th>
                  <th className="px-3 py-3 text-right">Cant.</th>
                  <th className="px-3 py-3 text-right">P.Unit</th>
                  <th className="px-3 py-3 text-right">IVA%</th>
                  <th className="px-3 py-3 text-right">IVA</th>
                  <th className="px-3 py-3 text-right">Monto</th>
                  <th className="px-3 py-3 text-right">Fecha</th>
                  {folio.isOpen && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-line">
                {folio.items.map((item: FolioItemDto) => (
                  <tr
                    key={item.id}
                    className={`${item.type === 'VOID' ? 'opacity-50 line-through' : ''}`}
                  >
                    <td className="px-5 py-3 text-ink-1">{item.description}</td>
                    <td className="px-3 py-3 text-center text-ink-3">
                      {TYPE_LABEL[item.type] ?? item.type}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {isAutomaticCharge(item) ? (
                        <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          Automático
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-ink-2">{item.quantity}</td>
                    <td className="px-3 py-3 text-right text-ink-2">
                      {formatCOP(item.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-right text-ink-3">
                      {Math.round(item.taxRate * 100)}%
                    </td>
                    <td className="px-3 py-3 text-right text-ink-3">
                      {formatCOP(item.taxAmount)}
                    </td>
                    <td className={`px-3 py-3 text-right font-medium ${item.amount < 0 ? 'text-red-600' : 'text-ink-1'}`}>
                      {formatCOP(item.amount)}
                    </td>
                    <td className="px-3 py-3 text-right text-ink-3 text-xs">
                      {item.businessDate
                        ? formatDisplayDate(
                            typeof item.businessDate === 'string'
                              ? item.businessDate.slice(0, 10)
                              : new Date(item.businessDate).toISOString().slice(0, 10),
                          )
                        : '—'}
                    </td>
                    {folio.isOpen && (
                      <td className="px-3 py-3">
                        {item.type !== 'VOID' && !item.voidedByEntryId && (
                          <button
                            onClick={() => voidMutation.mutate(item.id)}
                            disabled={voidMutation.isPending}
                            className="text-xs text-ink-3 hover:text-red-600 transition-colors"
                            title="Anular cargo"
                          >
                            Anular
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Balance row */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-warm-line bg-warm-cream">
          <span className="text-ink-1 text-sm font-semibold">Balance total</span>
          <span className="text-brand-primary text-lg font-bold">
            {formatCOP(folio.balance)}
          </span>
        </div>
      </div>

      {/* PostChargeModal — extracted component (CHG-01/CHG-02) */}
      {showPostCharge && (
        <PostChargeModal
          folioId={folio.id}
          reservationId={reservationId!}
          onClose={() => setShowPostCharge(false)}
        />
      )}
    </div>
  );
}
