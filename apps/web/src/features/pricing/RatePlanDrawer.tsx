import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomType {
  id: string;
  name: string;
  isActive: boolean;
}

export interface RatePlanExtra {
  id: string;
  ratePlanId: string;
  name: string;
  amount: number;
  pricingMode: 'PER_STAY' | 'PER_NIGHT' | 'PER_PERSON_PER_NIGHT';
}

export interface RatePlan {
  id: string;
  name: string;
  type: string;
  roomTypeId: string;
  isActive: boolean;
  description?: string | null;
  priceModifier: number;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const ratePlanSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  type: z.enum(['BAR', 'PROMO', 'PACKAGE'], {
    message: 'Tipo inválido',
  }),
  roomTypeId: z.string().min(1, 'Seleccione un tipo de habitación'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  priceModifier: z
    .number({ error: 'Debe ser un número' })
    .positive('Debe ser mayor que 0'),
});

type RatePlanFormData = z.infer<typeof ratePlanSchema>;

// ─── Extra row schema ─────────────────────────────────────────────────────────

const extraRowSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(120, 'Máximo 120 caracteres'),
  amount: z.number({ error: 'Ingrese un monto' }).min(0.01, 'Debe ser positivo'),
  pricingMode: z.enum(['PER_STAY', 'PER_NIGHT', 'PER_PERSON_PER_NIGHT'], {
    message: 'Modo inválido',
  }),
});

type ExtraRowFormData = z.infer<typeof extraRowSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const PRICING_MODE_LABELS: Record<string, string> = {
  PER_STAY: 'Por estadía',
  PER_NIGHT: 'Por noche',
  PER_PERSON_PER_NIGHT: 'Por persona por noche',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface RatePlanDrawerProps {
  isOpen: boolean;
  ratePlan: RatePlan | null;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Extra add/edit row ───────────────────────────────────────────────────────

interface AddExtraRowProps {
  ratePlanId: string;
  onSaved: () => void;
}

function AddExtraRow({ ratePlanId, onSaved }: AddExtraRowProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExtraRowFormData>({
    resolver: zodResolver(extraRowSchema),
    defaultValues: { name: '', amount: 0, pricingMode: 'PER_STAY' },
  });

  const onSubmit = async (data: ExtraRowFormData) => {
    await api.post(`/pricing/rate-plans/${ratePlanId}/extras`, data);
    reset();
    onSaved();
  };

  return (
    <div
      className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-start"
      data-testid="add-extra-form"
    >
      <div className="flex flex-col gap-1">
        <Input
          type="text"
          placeholder="Nombre del extra"
          aria-label="Nombre del extra"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-xs text-status-in-progress">{errors.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Input
          type="number"
          step="1"
          min="1"
          placeholder="Monto COP"
          aria-label="Monto COP"
          {...register('amount', { valueAsNumber: true })}
          className="w-32"
        />
        {errors.amount && (
          <p className="text-xs text-status-in-progress">{errors.amount.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <select
          {...register('pricingMode')}
          aria-label="Modo de cobro"
          className="flex rounded-md border border-warm-line-strong bg-warm-cream px-3 py-2 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
        >
          <option value="PER_STAY">Por estadía</option>
          <option value="PER_NIGHT">Por noche</option>
          <option value="PER_PERSON_PER_NIGHT">Por persona por noche</option>
        </select>
        {errors.pricingMode && (
          <p className="text-xs text-status-in-progress">{errors.pricingMode.message}</p>
        )}
      </div>

      <Button
        type="button"
        disabled={isSubmitting}
        onClick={() => void handleSubmit(onSubmit)()}
        className="whitespace-nowrap"
      >
        {isSubmitting ? 'Guardando...' : 'Agregar'}
      </Button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * RatePlanDrawer — inline fixed-panel drawer for creating and editing rate plans.
 *
 * Follows the project's drawer pattern (not shadcn Sheet):
 *   fixed overlay + fixed panel, same as RoomTypeDrawer and UserFormDrawer.
 *
 * priceModifier:
 *   Decimal field (default 1.0). Multiplies the room type's base price within
 *   the pricing engine. 0.85 = 15% cheaper, 1.15 = 15% more expensive.
 *
 * Extras UX:
 *   - Edit mode: per-row immediate mutations against /pricing/extras endpoints.
 *     Each add/delete fires its own request and invalidates ['rate-plan-extras', id].
 *   - Create mode: extras cannot be attached until the plan exists.
 *     A hint "Guarda el plan primero para agregar extras" is shown instead.
 */
export function RatePlanDrawer({
  isOpen,
  ratePlan,
  onClose,
  onSuccess,
}: RatePlanDrawerProps) {
  const queryClient = useQueryClient();
  const isEdit = ratePlan !== null;

  const [extrasRefreshKey, setExtrasRefreshKey] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RatePlanFormData>({
    resolver: zodResolver(ratePlanSchema),
  });

  const watchedType = watch('type');

  // Load active room types for the select
  const { data: roomTypes = [] } = useQuery<RoomType[]>({
    queryKey: ['room-types'],
    queryFn: () =>
      api.get<RoomType[]>('/inventory/room-types').then((r) => r.data),
    enabled: isOpen,
  });

  // Load extras for an existing plan (edit mode only)
  const { data: extras = [] } = useQuery<RatePlanExtra[]>({
    queryKey: ['rate-plan-extras', ratePlan?.id, extrasRefreshKey],
    queryFn: () =>
      api
        .get<RatePlanExtra[]>(`/pricing/rate-plans/${ratePlan!.id}/extras`)
        .then((r) => r.data),
    enabled: isOpen && isEdit && ratePlan !== null,
  });

  const deleteExtraMutation = useMutation({
    mutationFn: (extraId: string) =>
      api.delete(`/pricing/extras/${extraId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rate-plans'] });
      setExtrasRefreshKey((k) => k + 1);
    },
  });

  useEffect(() => {
    if (ratePlan) {
      reset({
        name: ratePlan.name,
        type: ratePlan.type as 'BAR' | 'PROMO' | 'PACKAGE',
        roomTypeId: ratePlan.roomTypeId,
        description: ratePlan.description ?? '',
        // Defensive coercion: Prisma Decimal serializes as a string over HTTP.
        // Even though the TS type says `number`, the runtime value may be "1.0000".
        // Number() normalises both cases; react-hook-form requires an actual number.
        priceModifier: Number(ratePlan.priceModifier),
      });
    } else {
      reset({ name: '', type: 'BAR', roomTypeId: '', description: '', priceModifier: 1.0 });
    }
  }, [ratePlan, reset]);

  const onSubmit = async (data: RatePlanFormData) => {
    try {
      const payload = {
        ...data,
        description: data.description?.trim() || null,
      };
      if (isEdit) {
        await api.patch(`/pricing/rate-plans/${ratePlan.id}`, payload);
      } else {
        await api.post('/pricing/rate-plans', payload);
      }
      reset();
      onSuccess();
    } catch (err) {
      console.error('Error guardando tarifa:', err);
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

      {/* Panel — wider to accommodate extras section */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Editar plan de tarifa' : 'Nuevo plan de tarifa'}
        className="fixed right-0 top-0 h-full w-full max-w-[560px] bg-warm-white border-l border-warm-line shadow-lg z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-warm-line">
          <h2 className="text-ink-1 text-lg font-semibold">
            {isEdit ? 'Editar plan de tarifa' : 'Nuevo plan de tarifa'}
          </h2>
          <button type="button"
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
            <label htmlFor="rpName" className="text-sm font-medium text-ink-2">
              Nombre
            </label>
            <Input
              id="rpName"
              type="text"
              placeholder="Tarifa BAR 2026"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-status-in-progress">{errors.name.message}</p>
            )}
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1">
            <label htmlFor="rpType" className="text-sm font-medium text-ink-2">
              Tipo de tarifa
            </label>
            <select
              id="rpType"
              {...register('type')}
              className="flex w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-2 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
            >
              <option value="BAR">BAR — Best Available Rate</option>
              <option value="PROMO">PROMO — Tarifa promocional</option>
              <option value="PACKAGE">PACKAGE — Paquete con servicios</option>
            </select>
            {errors.type && (
              <p className="text-xs text-status-in-progress">{errors.type.message}</p>
            )}
          </div>

          {/* Room type */}
          <div className="flex flex-col gap-1">
            <label htmlFor="rpRoomType" className="text-sm font-medium text-ink-2">
              Tipo de habitación
            </label>
            <select
              id="rpRoomType"
              {...register('roomTypeId')}
              className="flex w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-2 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
            >
              <option value="">Seleccione un tipo...</option>
              {roomTypes
                .filter((rt) => rt.isActive)
                .map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
            </select>
            {errors.roomTypeId && (
              <p className="text-xs text-status-in-progress">{errors.roomTypeId.message}</p>
            )}
          </div>

          {/* Price modifier */}
          <div className="flex flex-col gap-1">
            <label htmlFor="rpPriceModifier" className="text-sm font-medium text-ink-2">
              Modificador de precio
            </label>
            <Input
              id="rpPriceModifier"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="1.0"
              data-testid="price-modifier-input"
              {...register('priceModifier', { valueAsNumber: true })}
            />
            <p className="text-xs text-ink-3">
              1.0 = sin cambio · 0.85 = 15% más barato · 1.15 = 15% más caro.
              Multiplica el precio base de la habitación para este plan.
            </p>
            {errors.priceModifier && (
              <p className="text-xs text-status-in-progress">{errors.priceModifier.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label htmlFor="rpDescription" className="text-sm font-medium text-ink-2">
              Descripción <span className="text-ink-3 font-normal">(opcional)</span>
            </label>
            <textarea
              id="rpDescription"
              rows={3}
              maxLength={500}
              placeholder="Describe las condiciones o beneficios de este plan..."
              {...register('description')}
              className="flex w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-2 text-sm text-ink-1 shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
            />
            {errors.description && (
              <p className="text-xs text-status-in-progress">{errors.description.message}</p>
            )}
          </div>

          {/* ── Extras section ───────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 pt-2 border-t border-warm-line">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-1">Extras del plan</h3>
              {watchedType !== 'PACKAGE' && (
                <span className="text-xs text-ink-3">
                  Los extras suelen usarse en paquetes
                </span>
              )}
            </div>

            {isEdit ? (
              <>
                {/* Existing extras list */}
                {extras.length > 0 ? (
                  <ul className="flex flex-col gap-2" data-testid="extras-list">
                    {extras.map((extra) => (
                      <li
                        key={extra.id}
                        className="flex items-center justify-between rounded-md border border-warm-line bg-warm-cream px-3 py-2 text-sm"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-ink-1">{extra.name}</span>
                          <span className="text-xs text-ink-3">
                            {/* Defensive coercion: extra.amount is Decimal-origin and may arrive as a string */}
                            {COP.format(Number(extra.amount))} — {PRICING_MODE_LABELS[extra.pricingMode] ?? extra.pricingMode}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteExtraMutation.mutate(extra.id)}
                          disabled={deleteExtraMutation.isPending}
                          className="text-xs text-status-in-progress hover:underline disabled:opacity-50"
                          aria-label={`Eliminar extra ${extra.name}`}
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-3">
                    No hay extras configurados para este plan.
                  </p>
                )}

                {/* Add extra row */}
                <AddExtraRow
                  ratePlanId={ratePlan.id}
                  onSaved={() => {
                    void queryClient.invalidateQueries({ queryKey: ['rate-plans'] });
                    setExtrasRefreshKey((k) => k + 1);
                  }}
                />
              </>
            ) : (
              /* Create mode — plan must exist before extras can be attached */
              <p
                className="text-xs text-ink-3 bg-warm-cream rounded-md px-3 py-2 border border-warm-line"
                data-testid="extras-create-hint"
              >
                Guarda el plan primero para agregar extras.
              </p>
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
                : 'Crear plan'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
