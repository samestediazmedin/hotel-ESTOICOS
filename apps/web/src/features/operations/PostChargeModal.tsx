import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { postCharge } from './folio.api';

// ─── Schema (Zod v4) ─────────────────────────────────────────────────────────

/**
 * PostChargeSchema — Zod v4 validation schema for the manual charge form.
 * No invalid_type_error (removed in Zod v4). Uses .issues not .errors for access.
 * taxRate defaults to 0.19 (IVA Colombia) — staff can override for 0% charges.
 */
const PostChargeSchema = z.object({
  description: z.string().min(1, 'Descripción requerida').max(200, 'Máx. 200 caracteres'),
  quantity: z.number().int('Debe ser entero').positive('Cantidad debe ser positiva'),
  unitPrice: z.number().nonnegative('Precio no puede ser negativo'),
  taxRate: z.number().min(0, 'IVA mínimo 0').max(1, 'IVA máximo 1'),
});

type PostChargeFormData = z.infer<typeof PostChargeSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostChargeModalProps {
  /** ID of the folio to append the charge to */
  folioId: string;
  /** React Query key used by FolioPage to invalidate on success */
  reservationId: string;
  /** Called when the modal should close (cancel or success) */
  onClose: () => void;
  /** Optional callback on successful post */
  onPosted?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PostChargeModal — modal form for manual charge posting (CHG-01/CHG-02).
 *
 * - Uses react-hook-form + zodResolver (same pattern as SeasonsPage Phase 02-03)
 * - On success: invalidates ['staff', 'folios', reservationId] so FolioPage
 *   immediately reflects the new charge with postedAt + postedByUserId
 * - Disabled if folio is SETTLED (parent responsibility — this component assumes
 *   the caller already checked folio.isOpen before rendering)
 */
export function PostChargeModal({
  folioId,
  reservationId,
  onClose,
  onPosted,
}: PostChargeModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PostChargeFormData>({
    resolver: zodResolver(PostChargeSchema),
    defaultValues: {
      quantity: 1,
      taxRate: 0.19,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: PostChargeFormData) => postCharge(folioId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', 'folios', reservationId] });
      reset();
      onPosted?.();
      onClose();
    },
  });

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
        aria-label="Agregar cargo manual"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-warm-white border border-warm-line rounded-xl shadow-xl w-full max-w-md p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-ink-1 font-semibold">Agregar cargo manual</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-3 hover:text-ink-1"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <form
            onSubmit={handleSubmit((data) => mutation.mutate(data))}
            className="space-y-4"
          >
            {/* Description */}
            <div className="flex flex-col gap-1">
              <label htmlFor="pc-description" className="text-sm font-medium text-ink-2">
                Descripción
              </label>
              <Input
                id="pc-description"
                type="text"
                placeholder="Minibar, lavandería, etc."
                {...register('description')}
              />
              {errors.description && (
                <p className="text-xs text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Quantity + Price */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 w-24">
                <label htmlFor="pc-quantity" className="text-sm font-medium text-ink-2">Cantidad</label>
                <Input
                  id="pc-quantity"
                  type="number"
                  min={1}
                  {...register('quantity', { valueAsNumber: true })}
                />
                {errors.quantity && (
                  <p className="text-xs text-red-600">{errors.quantity.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1 flex-1">
                <label htmlFor="pc-unitPrice" className="text-sm font-medium text-ink-2">
                  Precio unitario (COP)
                </label>
                <Input
                  id="pc-unitPrice"
                  type="number"
                  min={0}
                  placeholder="50000"
                  {...register('unitPrice', { valueAsNumber: true })}
                />
                {errors.unitPrice && (
                  <p className="text-xs text-red-600">{errors.unitPrice.message}</p>
                )}
              </div>
            </div>

            {/* Tax rate */}
            <div className="flex flex-col gap-1">
              <label htmlFor="pc-taxRate" className="text-sm font-medium text-ink-2">
                IVA (0 a 1, ej: 0.19 para 19%)
              </label>
              <Input
                id="pc-taxRate"
                type="number"
                min={0}
                max={1}
                step={0.01}
                {...register('taxRate', { valueAsNumber: true })}
              />
              {errors.taxRate && (
                <p className="text-xs text-red-600">{errors.taxRate.message}</p>
              )}
            </div>

            {/* Error */}
            {mutation.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-red-600 text-sm">
                  {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                    'Error al registrar cargo.'}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting || mutation.isPending}
              >
                {isSubmitting || mutation.isPending ? 'Guardando...' : 'Registrar cargo'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
