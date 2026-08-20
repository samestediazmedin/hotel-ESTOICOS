import { Button } from '@/components/ui/button';
import { useReservationWizardStore } from '../store/reservation-wizard.store';
import { Step1Dates } from './Step1Dates';
import { Step2Room } from './Step2Room';
import { Step3Guest } from './Step3Guest';
import { Step4Confirm } from './Step4Confirm';
import { StepIndicator } from './StepIndicator';

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEP_LABELS = ['Fechas', 'Habitación', 'Datos huésped', 'Confirmar'];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ReservationWizard — 4-step inline fixed-panel wizard.
 *
 * Follows the inline fixed-panel pattern from RoomDrawer.tsx (Phase 02-01).
 * Reads all state from useReservationWizardStore — NOT local useState.
 *
 * Structure:
 * - Header: title + step indicator pill + close button
 * - Body: renders the active step component (each manages its own form)
 * - Footer: "Atrás" (hidden on step 1) — per-step "Siguiente"/"Confirmar" lives INSIDE each step
 */
export function ReservationWizard() {
  const isOpen = useReservationWizardStore((s) => s.isOpen);
  const currentStep = useReservationWizardStore((s) => s.currentStep);
  const closeWizard = useReservationWizardStore((s) => s.closeWizard);
  const goBack = useReservationWizardStore((s) => s.goBack);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-1/20 z-40"
        onClick={closeWizard}
        aria-hidden="true"
      />

      {/* Wizard panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nueva reserva"
        className="fixed right-0 top-0 h-full w-full max-w-[640px] bg-warm-cream border-l border-warm-line shadow-lg z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 border-b border-warm-line pb-4">
          <h1 className="font-display italic text-3xl text-ink-1">
            Nueva reserva
          </h1>

          <button type="button"
            onClick={closeWizard}
            className="text-ink-3 hover:text-ink-1 transition-colors mt-1 p-1 rounded-md hover:bg-warm-paper"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* StepIndicator — replaces old progress bar */}
        <div className="px-6 border-b border-warm-line">
          <StepIndicator steps={STEP_LABELS} currentStep={currentStep} />
        </div>

        {/* Step content area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-warm-white border border-warm-line rounded-xl p-6">
            {currentStep === 1 && <Step1Dates />}
            {currentStep === 2 && <Step2Room />}
            {currentStep === 3 && <Step3Guest />}
            {currentStep === 4 && <Step4Confirm />}
          </div>
        </div>

        {/* Footer — "Atrás" lives here; "Siguiente"/"Confirmar" lives in each step */}
        <div className="p-6 border-t border-warm-line flex items-center justify-between">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
            >
              ← Atrás
            </Button>
          ) : (
            <div />
          )}

          <Button
            type="button"
            variant="outline"
            onClick={closeWizard}
          >
            Cerrar
          </Button>
        </div>
      </div>
    </>
  );
}
