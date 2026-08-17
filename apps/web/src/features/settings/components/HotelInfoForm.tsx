import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TagsInput } from './TagsInput';
import {
  HotelInfoSchema,
  type HotelInfoFormData,
  type HotelInfoFormInput,
  type AdminSystemConfig,
} from '../types';
import { useUpdateSystemConfig } from '../hooks/useUpdateSystemConfig';

interface Props {
  initial: AdminSystemConfig;
}

/**
 * HotelInfoForm — 6-field form for editing hotel identity settings.
 *
 * Fields: name (required), address (required), tagline, description (Textarea),
 * phone, tags (TagsInput chip component).
 *
 * Validation: react-hook-form + zodResolver(HotelInfoSchema).
 * Submit: calls useUpdateSystemConfig (PATCH /api/system-config).
 * On success: resets isDirty flag; shows inline success banner.
 * Cancel: resets form to last-saved values via reset(initial).
 *
 * No toast library — uses inline role="alert" / role="status" banners.
 */
export function HotelInfoForm({ initial }: Props) {
  const mutation = useUpdateSystemConfig();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<HotelInfoFormInput, unknown, HotelInfoFormData>({
    resolver: zodResolver(HotelInfoSchema),
    defaultValues: initial,
  });

  // Keep form in sync when server data changes (e.g., background refetch)
  useEffect(() => {
    reset(initial);
  }, [initial, reset]);

  const onSubmit = handleSubmit(async (data) => {
    await mutation.mutateAsync(data);
    // Reset isDirty after successful save so Cancel/Submit disable
    reset(data);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="hi-name" className="text-sm font-medium text-ink-2">
          Nombre del hotel
        </label>
        <Input id="hi-name" type="text" {...register('name')} />
        {errors.name && (
          <p className="text-xs text-terracotta">{errors.name.message}</p>
        )}
      </div>

      {/* Address */}
      <div className="flex flex-col gap-1">
        <label htmlFor="hi-address" className="text-sm font-medium text-ink-2">
          Dirección
        </label>
        <Input id="hi-address" type="text" {...register('address')} />
        {errors.address && (
          <p className="text-xs text-terracotta">{errors.address.message}</p>
        )}
      </div>

      {/* Tagline */}
      <div className="flex flex-col gap-1">
        <label htmlFor="hi-tagline" className="text-sm font-medium text-ink-2">
          Lema{' '}
          <span className="text-ink-4 font-normal">(opcional)</span>
        </label>
        <Input id="hi-tagline" type="text" {...register('tagline')} />
        {errors.tagline && (
          <p className="text-xs text-terracotta">{errors.tagline.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="hi-description"
          className="text-sm font-medium text-ink-2"
        >
          Descripción{' '}
          <span className="text-ink-4 font-normal">(opcional)</span>
        </label>
        <Textarea
          id="hi-description"
          rows={4}
          placeholder="Cuéntale a tus huéspedes sobre el hotel..."
          {...register('description')}
        />
        {errors.description && (
          <p className="text-xs text-terracotta">{errors.description.message}</p>
        )}
      </div>

      {/* Phone */}
      <div className="flex flex-col gap-1">
        <label htmlFor="hi-phone" className="text-sm font-medium text-ink-2">
          Teléfono{' '}
          <span className="text-ink-4 font-normal">(opcional)</span>
        </label>
        <Input
          id="hi-phone"
          type="text"
          placeholder="+57 (1) 555-0100"
          {...register('phone')}
        />
        {errors.phone && (
          <p className="text-xs text-terracotta">{errors.phone.message}</p>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-ink-2">
          Etiquetas{' '}
          <span className="text-ink-4 font-normal">(máx. 8)</span>
        </label>
        <Controller
          control={control}
          name="tags"
          render={({ field }) => (
            <TagsInput
              value={field.value ?? []}
              onChange={field.onChange}
            />
          )}
        />
        {errors.tags && (
          <p className="text-xs text-terracotta">{errors.tags.message}</p>
        )}
      </div>

      {/* IVA price display toggle */}
      <div className="flex items-center justify-between rounded-lg border border-warm-line bg-warm-paper px-4 py-3 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-ink-2">
            Mostrar precios con IVA incluido en el sitio público
          </span>
          <span className="text-xs text-ink-4">
            Cuando está activo, el portal muestra el precio base + 19% IVA con la nota "IVA incluido".
            El flujo de reserva siempre muestra el desglose completo, independientemente de este ajuste.
          </span>
        </div>
        <Controller
          control={control}
          name="displayPricesWithIva"
          render={({ field }) => (
            <button
              type="button"
              role="switch"
              aria-checked={field.value}
              aria-label="Mostrar precios con IVA incluido"
              onClick={() => field.onChange(!field.value)}
              className={
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 ' +
                (field.value ? 'bg-terracotta' : 'bg-warm-line-strong')
              }
            >
              <span
                className={
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ' +
                  (field.value ? 'translate-x-5' : 'translate-x-0')
                }
              />
            </button>
          )}
        />
      </div>

      {/* Mutation status banners */}
      {mutation.isError && (
        <div
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 text-terracotta px-3 py-2 text-sm"
        >
          No se pudo guardar los cambios.{' '}
          {mutation.error?.message ?? 'Intenta de nuevo.'}
        </div>
      )}
      {mutation.isSuccess && !isDirty && (
        <div
          role="status"
          className="rounded-md border border-olive/30 bg-olive/10 text-olive px-3 py-2 text-sm"
        >
          Cambios guardados correctamente.
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset(initial);
            mutation.reset();
          }}
          disabled={!isDirty || isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="terracotta"
          disabled={!isDirty || isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}
