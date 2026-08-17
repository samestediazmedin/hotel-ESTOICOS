import { Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepIndicatorProps {
  /** Labels in order — e.g., ['Fechas', 'Habitación', 'Datos', 'Confirmar'] */
  steps: string[];
  /** 1-based active step index */
  currentStep: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * StepIndicator — visual stepper for multi-step wizard flows.
 *
 * States:
 * - Active  (stepNum === currentStep): bg-terracotta ring-4 ring-terracotta-tint
 * - Completed (stepNum < currentStep): bg-mustard + Check icon
 * - Pending   (stepNum > currentStep): bg-warm-tan text-ink-3
 *
 * Connector lines between dots turn bg-mustard once the left step is completed.
 * Off-by-one note: stepNum = idx + 1 (1-based) compared against currentStep (1-based).
 */
export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-start justify-center gap-2 py-6">
      {steps.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        const isLast = idx === steps.length - 1;

        const circleClasses = isActive
          ? 'bg-terracotta text-warm-white ring-4 ring-terracotta-tint'
          : isCompleted
          ? 'bg-mustard text-warm-white'
          : 'bg-warm-tan text-ink-3';

        const labelClasses = isActive
          ? 'font-medium text-terracotta-deep'
          : isCompleted
          ? 'text-ink-2'
          : 'text-ink-3';

        const connectorClasses = isCompleted ? 'bg-mustard' : 'bg-warm-line';

        return (
          <div key={stepNum} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-2 w-24">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${circleClasses}`}
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" aria-hidden />
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`text-[13px] uppercase tracking-wide text-center ${labelClasses}`}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`h-px w-12 mt-4 transition-colors ${connectorClasses}`}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
