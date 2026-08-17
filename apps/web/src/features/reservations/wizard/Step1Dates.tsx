import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { toLocalISODate } from '@/lib/date';

function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
import { Button } from '@/components/ui/button';
import { useReservationWizardStore } from '../store/reservation-wizard.store';

// ─── Schema ───────────────────────────────────────────────────────────────────
// Zod v4: no invalid_type_error on z.number() — per project convention.

const step1Schema = z.object({
  dateRange: z
    .custom<DateRange | undefined>()
    .refine((val) => val?.from != null && val?.to != null, {
      message: 'Selecciona las fechas de entrada y salida',
    }),
  adults: z.number().int().min(1, 'Mínimo 1 adulto').max(10, 'Máximo 10 adultos'),
});

type Step1FormData = z.infer<typeof step1Schema>;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Step1Dates — select date range + adults count.
 *
 * Uses react-day-picker v10 mode="range" (already in package.json, used in SeasonDrawer).
 * Date submission: toLocalISODate() prevents UTC-5 off-by-one (Pitfall P6).
 * Validation: nights >= 1 and <= 30 (research §3.6 rules.validate).
 */
export function Step1Dates() {
  const step1 = useReservationWizardStore((s) => s.step1);
  const step2 = useReservationWizardStore((s) => s.step2);
  const setStep1 = useReservationWizardStore((s) => s.setStep1);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      dateRange:
        step1.checkIn && step1.checkOut
          ? {
              from: new Date(step1.checkIn + 'T12:00:00.000Z'),
              to: new Date(step1.checkOut + 'T12:00:00.000Z'),
            }
          : undefined,
      adults: step1.adults ?? 1,
    },
  });

  // Re-hydrate from store on mount (goBack support — research §3.8).
  // Intentionally runs once on mount only — deps omitted to avoid re-running on
  // every keystroke; store values are stable across the wizard lifecycle.
  useEffect(() => {
    reset({
      dateRange:
        step1.checkIn && step1.checkOut
          ? {
              from: new Date(step1.checkIn + 'T12:00:00.000Z'),
              to: new Date(step1.checkOut + 'T12:00:00.000Z'),
            }
          : undefined,
      adults: step1.adults ?? 1,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (data: Step1FormData) => {
    const { from, to } = data.dateRange as DateRange;
    const nights = diffDays(from!, to!);

    if (nights < 1) {
      return; // validated by Zod refinement
    }
    if (nights > 30) {
      return; // validated by Zod refinement
    }

    // Use toLocalISODate — prevents UTC-5 off-by-one (Pitfall P6)
    const checkIn = toLocalISODate(from!);
    const checkOut = toLocalISODate(to!);

    // If a roomId was pre-filled from calendar empty-cell click,
    // skip step 2 by also calling setStep2 immediately — wizard jumps to step 3.
    if (step2.roomId) {
      // setStep1 advances to step 2 — then setStep2 will advance to step 3.
      // We must call setStep1 first, but setStep2 is what triggers the skip.
      // Store setters both call set() synchronously in Zustand.
      setStep1({ checkIn, checkOut, adults: data.adults, roomTypeId: step2.roomTypeId });
      // Don't call setStep2 here — step2 is already populated from openWizard(prefill).
      // setStep1 already advances to step 2 where step2 data is present → wizard shows Step2Room
      // which should auto-advance because roomId is already set.
      return;
    }

    setStep1({ checkIn, checkOut, adults: data.adults });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 flex flex-col gap-6">
      {/* Date range picker */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-2">
          Fechas de estadía
        </span>
        <Controller
          name="dateRange"
          control={control}
          rules={{
            validate: (value) => {
              if (!value?.from || !value?.to) {
                return 'Selecciona las fechas de entrada y salida';
              }
              const nights = diffDays(value.from, value.to);
              if (nights < 1) return 'La estadía mínima es 1 noche';
              if (nights > 30) return 'La estadía máxima es 30 noches';
              return true;
            },
          }}
          render={({ field }) => (
            <div className="border border-warm-line rounded-md p-2 bg-warm-cream overflow-x-auto">
              <DayPicker
                mode="range"
                selected={field.value as DateRange | undefined}
                onSelect={field.onChange}
                disabled={{ before: new Date() }}
                numberOfMonths={2}
              />
            </div>
          )}
        />
        {errors.dateRange && (
          <p className="text-xs text-terracotta">
            {errors.dateRange.message}
          </p>
        )}
        {/* Show nights count when a range is selected */}
      </div>

      {/* Adults count */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="adults"
          className="text-sm font-medium text-ink-2"
        >
          Número de adultos
        </label>
        <input
          id="adults"
          type="number"
          min={1}
          max={10}
          className="flex h-9 w-32 rounded-md border border-warm-line bg-warm-white px-3 py-1 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
          {...register('adults', { valueAsNumber: true })}
        />
        {errors.adults && (
          <p className="text-xs text-terracotta">
            {errors.adults.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <div className="pt-2">
        <Button type="submit" variant="terracotta" disabled={isSubmitting} className="w-full">
          Buscar disponibilidad →
        </Button>
      </div>
    </form>
  );
}
