import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { checkOutReservation } from './operations.api';
import { getFolio } from './folio.api';
import type { ReservationResponseDto } from '@/features/reservations/reservations.api';

// ─── COP Formatter (P13 — es-CO currency, no decimals) ───────────────────────

function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckOutConfirmDialogProps {
  reservation: ReservationResponseDto | null;
  open: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CheckOutConfirmDialog — confirmation dialog for hotel check-out.
 *
 * Fetches folio to show total before confirming.
 * On confirm → POST /check-out → redirect to /folios/:reservationId.
 */
export function CheckOutConfirmDialog({
  reservation,
  open,
  onClose,
}: CheckOutConfirmDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch folio for this reservation (by reservationId as folio key)
  const { data: folio, isLoading: folioLoading } = useQuery({
    queryKey: ['staff', 'folios', reservation?.id],
    queryFn: () => getFolio(reservation!.id),
    enabled: open && !!reservation,
  });

  const mutation = useMutation({
    mutationFn: () => checkOutReservation(reservation!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['staff', 'folios'] });
      onClose();
      navigate(`/folios/${reservation!.id}`);
    },
  });

  if (!open || !reservation) return null;

  const errorMessage = mutation.error
    ? ((mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al realizar el check-out.')
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-1/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar check-out"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-warm-white border border-warm-line rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
          <div>
            <h2 className="text-ink-1 text-lg font-semibold">Confirmar Check-out</h2>
            <p className="text-ink-3 text-sm mt-1">
              {reservation.guest?.fullName ?? '—'} — Hab. {reservation.room?.number ?? '—'}
            </p>
          </div>

          {/* Folio summary */}
          {folioLoading ? (
            <div className="text-ink-3 text-sm text-center py-4">
              Cargando folio...
            </div>
          ) : folio ? (
            <div className="bg-warm-cream rounded-lg border border-warm-line p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-ink-3">Folio</span>
                <span className="text-ink-1 font-mono text-xs">
                  #{folio.id.slice(-8).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-3">Cargos ({folio.items.length})</span>
                <span className="text-ink-1">
                  {folio.items.filter((i) => i.type !== 'VOID').length} items
                </span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-warm-line pt-2 mt-2">
                <span className="text-ink-1">Total</span>
                <span className="text-brand-primary">{formatCOP(folio.balance)}</span>
              </div>
            </div>
          ) : (
            <p className="text-ink-3 text-sm text-center py-2">
              Sin folio disponible
            </p>
          )}

          <p className="text-ink-2 text-sm">
            Al confirmar, el folio quedará cerrado y se generará un hash SHA-256 de liquidación.
            Esta acción no se puede deshacer.
          </p>

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-red-600 text-sm">{errorMessage}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Procesando...' : 'Confirmar Check-out'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
