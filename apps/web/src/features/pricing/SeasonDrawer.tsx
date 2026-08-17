import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toLocalISODate } from '@/lib/date';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Season {
  id: string;
  roomTypeId: string;
  name: string;
  startDate: string;  // "YYYY-MM-DD"
  endDate: string;    // "YYYY-MM-DD"
  multiplier: number;
  minNights: number;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const seasonSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  multiplier: z
    .number()
    .min(0.1, 'Mínimo 0.1')
    .max(5.0, 'Máximo 5.0'),
  minNights: z
    .number()
    .int()
    .min(1, 'Mínimo 1 noche')
    .max(30, 'Máximo 30 noches'),
});

type SeasonFormData = z.infer<typeof seasonSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface SeasonDrawerProps {
  isOpen: boolean;
  season: Season | null;
  roomTypeId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * SeasonDrawer — inline fixed-panel drawer for creating and editing seasons.
 *
 * Uses react-day-picker v10 for the date range selection.
 *
 * DATE HANDLING (CRITICAL — D-15):
 *   - DO NOT use toISOString().slice(0,10) for user-picked dates.
 *   - In UTC-5 (Bogotá), a Date for June 15 at 8pm local has UTC value
 *     of June 15 at 1am next day, so toISOString() returns "2026-06-16".
 *   - Use toLocalISODate() from lib/date.ts which reads getFullYear/Month/Date.
 */
export function SeasonDrawer({
  isOpen,
  season,
  roomTypeId,
  onClose,
  onSuccess,
}: SeasonDrawerProps) {
  const isEdit = season !== null;
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [dateError, setDateError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SeasonFormData>({
    resolver: zodResolver(seasonSchema),
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  // Intentional: setState calls here reset derived UI state when `season` or `isOpen` changes.
  useEffect(() => {
    if (season) {
      reset({
        name: season.name,
        multiplier: season.multiplier,
        minNights: season.minNights,
      });
      // Parse stored ISO dates as UTC noon to avoid timezone shift when displaying
      setRange({
        from: new Date(season.startDate + 'T12:00:00.000Z'),
        to: new Date(season.endDate + 'T12:00:00.000Z'),
      });
    } else {
      reset({ name: '', multiplier: 1.0, minNights: 1 });
      setRange(undefined);
    }
    setDateError(null);
  }, [season, reset, isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onSubmit = async (data: SeasonFormData) => {
    if (!range?.from || !range?.to) {
      setDateError('Seleccione las fechas de inicio y fin de la temporada');
      return;
    }
    setDateError(null);

    // Use toLocalISODate — NOT toISOString() — to prevent UTC-5 off-by-one
    const startDate = toLocalISODate(range.from);
    const endDate = toLocalISODate(range.to);

    try {
      if (isEdit) {
        await api.patch(`/pricing/seasons/${season.id}`, {
          name: data.name,
          multiplier: data.multiplier,
          minNights: data.minNights,
          startDate,
          endDate,
        });
      } else {
        await api.post('/pricing/seasons', {
          roomTypeId,
          name: data.name,
          multiplier: data.multiplier,
          minNights: data.minNights,
          startDate,
          endDate,
        });
      }
      reset();
      setRange(undefined);
      onSuccess();
    } catch (err) {
      console.error('Error guardando temporada:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-1/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — wider to fit 2-month calendar */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Editar temporada' : 'Nueva temporada'}
        className="fixed right-0 top-0 h-full w-full max-w-[600px] bg-warm-white border-l border-warm-line shadow-lg z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-warm-line">
          <h2 className="text-ink-1 text-lg font-semibold">
            {isEdit ? 'Editar temporada' : 'Nueva temporada'}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink-1 transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          autoComplete="off"
          className="flex-1 overflow-y-auto p-6 flex flex-col gap-4"
        >
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="sName" className="text-sm font-medium text-ink-2">
              Nombre de temporada
            </label>
            <Input
              id="sName"
              type="text"
              placeholder="HIGH / MID / LOW / Semana Santa..."
              {...register('name')}
            />
            <p className="text-xs text-ink-3">
              {`Convención: HIGH, MID, LOW — o nombre libre como "Diciembre"`}
            </p>
            {errors.name && (
              <p className="text-xs text-status-in-progress">{errors.name.message}</p>
            )}
          </div>

          {/* Date range picker */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink-2">
              Rango de fechas
            </span>
            <p className="text-xs text-ink-3">
              El intervalo es semiabierto: [inicio, fin). El día de fin NO se cobra.
            </p>
            <div className="border border-warm-line rounded-md p-2 bg-warm-cream">
              <DayPicker
                mode="range"
                selected={range}
                onSelect={setRange}
                numberOfMonths={2}
              />
            </div>
            {range?.from && range?.to && (
              <p className="text-xs text-ink-3">
                Seleccionado: {toLocalISODate(range.from)} hasta {toLocalISODate(range.to)}
              </p>
            )}
            {dateError && (
              <p className="text-xs text-status-in-progress">{dateError}</p>
            )}
          </div>

          {/* Multiplier */}
          <div className="flex flex-col gap-1">
            <label htmlFor="sMultiplier" className="text-sm font-medium text-ink-2">
              Multiplicador
            </label>
            <Input
              id="sMultiplier"
              type="number"
              step="0.05"
              min="0.1"
              max="5.0"
              placeholder="1.25"
              {...register('multiplier', { valueAsNumber: true })}
            />
            <p className="text-xs text-ink-3">
              1.25 = +25% sobre precio base | 0.85 = -15% sobre precio base
            </p>
            {errors.multiplier && (
              <p className="text-xs text-status-in-progress">{errors.multiplier.message}</p>
            )}
          </div>

          {/* Min nights */}
          <div className="flex flex-col gap-1">
            <label htmlFor="sMinNights" className="text-sm font-medium text-ink-2">
              Noches mínimas
            </label>
            <Input
              id="sMinNights"
              type="number"
              min="1"
              max="30"
              placeholder="1"
              {...register('minNights', { valueAsNumber: true })}
            />
            <p className="text-xs text-ink-3">
              Estancias más cortas mostrarán una advertencia (no bloquea la reserva)
            </p>
            {errors.minNights && (
              <p className="text-xs text-status-in-progress">{errors.minNights.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 mt-auto">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting
                ? 'Guardando...'
                : isEdit
                ? 'Guardar cambios'
                : 'Crear temporada'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Multiplier display helper (used in SeasonsPage) ─────────────────────────

/**
 * Format a multiplier (1.25) as a percentage string ("+25%") with sign.
 * Returns green for positive, red for negative, neutral for ±0.
 */
export function formatMultiplier(multiplier: number): {
  label: string;
  colorClass: string;
} {
  const pct = Math.round((multiplier - 1) * 100);
  if (pct > 0) {
    return { label: `+${pct}%`, colorClass: 'text-green-700' };
  }
  if (pct < 0) {
    return { label: `${pct}%`, colorClass: 'text-red-700' };
  }
  return { label: '±0%', colorClass: 'text-ink-3' };
}
