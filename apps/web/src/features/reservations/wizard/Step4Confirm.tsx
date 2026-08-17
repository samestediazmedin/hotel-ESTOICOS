import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useCreateReservation } from '../reservations.api';
import { useReservationWizardStore } from '../store/reservation-wizard.store';

// ─── COP formatter ────────────────────────────────────────────────────────────
const formatCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Step4Confirm — summary + pricing breakdown + submit reservation.
 *
 * Reads all steps from the wizard store.
 * Submits POST /api/reservations with source: 'DIRECT' (RES-07).
 *
 * 409 handling: surfaces inline "La habitación ya no está disponible" error
 *   + "Buscar otra habitación" button → goBack() to step 2.
 *
 * Pricing breakdown reuses data from step2.pricingBreakdown (no extra API call).
 */
export function Step4Confirm() {
  const queryClient = useQueryClient();

  const step1 = useReservationWizardStore((s) => s.step1);
  const step2 = useReservationWizardStore((s) => s.step2);
  const step3 = useReservationWizardStore((s) => s.step3);
  const closeWizard = useReservationWizardStore((s) => s.closeWizard);
  const goBack = useReservationWizardStore((s) => s.goBack);

  const [conflictError, setConflictError] = useState<string | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);

  const createReservation = useCreateReservation();

  const pricing = step2.pricingBreakdown;

  async function handleConfirm() {
    setConflictError(null);
    setGenericError(null);

    if (!step1.checkIn || !step1.checkOut || !step2.roomId || !step3.guestId) {
      setGenericError('Faltan datos para completar la reserva. Revisa los pasos anteriores.');
      return;
    }

    try {
      await createReservation.mutateAsync({
        guestId: step3.guestId!,
        roomId: step2.roomId!,
        roomTypeId: step2.roomTypeId!,
        checkInDate: step1.checkIn!,
        checkOutDate: step1.checkOut!,
        source: 'DIRECT',
        adults: step1.adults ?? 1,
        status: 'CONFIRMED',
      });

      // Invalidate reservations query so the calendar refreshes
      void queryClient.invalidateQueries({ queryKey: ['staff', 'reservations'] });

      closeWizard();
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { message?: string | string[] } } };
      const statusCode = apiErr?.response?.status;
      const message = apiErr?.response?.data?.message;

      if (statusCode === 409) {
        // 409 ConflictException from backend (23P01 exclusion constraint violation)
        setConflictError(
          'La habitación ya no está disponible para esas fechas. ' +
            (typeof message === 'string' ? message : ''),
        );
      } else {
        setGenericError(
          typeof message === 'string'
            ? message
            : 'Ocurrió un error al crear la reserva. Intenta de nuevo.',
        );
      }
    }
  }

  function handleSearchAnotherRoom() {
    setConflictError(null);
    // Invalidate availability cache so step 2 re-fetches fresh data
    void queryClient.invalidateQueries({ queryKey: ['staff', 'availability'] });
    // goBack() twice: from step 4 → step 3 → step 2
    goBack();
    goBack();
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ── Reservation summary ── */}
      <div className="bg-warm-cream border border-warm-line rounded-xl divide-y divide-warm-line">
        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-ink-3 text-xs uppercase tracking-wide self-center">Huésped</span>
          <span className="text-ink-1 font-medium text-right truncate max-w-[60%]">
            {step3.guestId ? (
              <span className="text-terracotta-deep">ID: {step3.guestId.slice(0, 8)}...</span>
            ) : (
              <span className="text-terracotta">Sin huésped</span>
            )}
          </span>
        </div>

        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-ink-3 text-xs uppercase tracking-wide self-center">Habitación</span>
          <span className="text-ink-1 font-mono font-medium">
            {step2.roomNumber} — {step2.roomTypeName}
          </span>
        </div>

        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-ink-3 text-xs uppercase tracking-wide self-center">Check-in</span>
          <span className="text-ink-1 font-mono font-medium">{step1.checkIn}</span>
        </div>

        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-ink-3 text-xs uppercase tracking-wide self-center">Check-out</span>
          <span className="text-ink-1 font-mono font-medium">{step1.checkOut}</span>
        </div>

        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-ink-3 text-xs uppercase tracking-wide self-center">Noches</span>
          <span className="text-ink-1 font-mono font-medium">
            {pricing?.totalNights ?? '—'}
          </span>
        </div>

        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-ink-3 text-xs uppercase tracking-wide self-center">Adultos</span>
          <span className="text-ink-1 font-mono font-medium">{step1.adults ?? 1}</span>
        </div>

        <div className="px-4 py-3 flex justify-between text-sm">
          <span className="text-ink-3 text-xs uppercase tracking-wide self-center">Origen</span>
          <span className="text-ink-1 font-medium">DIRECT</span>
        </div>
      </div>

      {/* ── Pricing breakdown ── */}
      {pricing && (
        <div>
          <h3 className="text-sm font-semibold text-ink-1 mb-2">
            Desglose de cobros
          </h3>

          <div className="overflow-x-auto rounded-xl border border-warm-line">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-warm-cream border-b border-warm-line">
                  <th className="text-left px-3 py-2 text-ink-2 font-medium">Fecha</th>
                  <th className="text-left px-3 py-2 text-ink-2 font-medium">Temporada</th>
                  <th className="text-right px-3 py-2 text-ink-2 font-medium">Mult.</th>
                  <th className="text-right px-3 py-2 text-ink-2 font-medium">Base</th>
                  <th className="text-right px-3 py-2 text-ink-2 font-medium">IVA</th>
                  <th className="text-right px-3 py-2 text-ink-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {pricing.items.map((item) => (
                  <tr
                    key={item.date}
                    className="border-b border-warm-line last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-ink-1">{item.date}</td>
                    <td className="px-3 py-2 text-ink-3">{item.seasonName ?? 'Base'}</td>
                    <td className="px-3 py-2 text-right font-mono text-ink-1">
                      {item.multiplier.toFixed(2)}x
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-ink-1">
                      {formatCOP.format(item.nightRate)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-ink-3">
                      {formatCOP.format(item.ivaAmount)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-ink-1 font-medium">
                      {formatCOP.format(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-warm-cream border-t border-warm-line-strong">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-right text-sm font-semibold text-ink-1"
                  >
                    Total
                  </td>
                  <td className="px-3 py-2 text-right text-xl font-mono font-bold text-terracotta-deep">
                    {formatCOP.format(pricing.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── 409 conflict error ── */}
      {conflictError && (
        <div className="bg-terracotta-tint border border-terracotta-soft rounded-xl px-4 py-3 flex flex-col gap-2">
          <p className="text-sm text-terracotta-deep">La habitación ya no está disponible para esas fechas.</p>
          {conflictError && (
            <p className="text-xs text-terracotta">{conflictError}</p>
          )}
          <button
            type="button"
            onClick={handleSearchAnotherRoom}
            className="text-sm text-terracotta-deep underline hover:no-underline self-start"
          >
            Buscar otra habitación
          </button>
        </div>
      )}

      {/* ── Generic error ── */}
      {genericError && !conflictError && (
        <p className="text-sm text-terracotta bg-terracotta-tint border border-terracotta-soft rounded px-3 py-2">
          {genericError}
        </p>
      )}

      {/* ── Submit ── */}
      <Button
        type="button"
        variant="terracotta"
        onClick={handleConfirm}
        disabled={createReservation.isPending || !step3.guestId}
        className="w-full"
      >
        {createReservation.isPending ? 'Confirmando reserva...' : 'Confirmar reserva'}
      </Button>
    </div>
  );
}
