import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const roomTypeSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  basePrice: z.number().positive('El precio debe ser mayor a 0'),
  maxOccupancy: z.number().int().min(1, 'Mínimo 1 persona'),
  amenitiesRaw: z.string().optional(),
});

type RoomTypeFormData = z.infer<typeof roomTypeSchema>;

interface RoomType {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  maxOccupancy: number;
  amenities: string[];
  isActive: boolean;
}

interface RoomTypeDrawerProps {
  isOpen: boolean;
  roomType: RoomType | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * RoomTypeDrawer — slide-in drawer for creating and editing room types.
 *
 * Mirrors UserFormDrawer pattern:
 *  - Fixed overlay + fixed panel
 *  - react-hook-form + zod
 *  - Design tokens — no hardcoded hex
 *
 * Amenities are entered as a comma-separated string and parsed on submit.
 *
 * OBS-008: consolidated from legacy text-text-* / bg-warm-white-* to current token ramp.
 */
export function RoomTypeDrawer({
  isOpen,
  roomType,
  onClose,
  onSuccess,
}: RoomTypeDrawerProps) {
  const isEdit = roomType !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RoomTypeFormData>({
    resolver: zodResolver(roomTypeSchema),
  });

  // Populate form when editing
  useEffect(() => {
    if (roomType) {
      reset({
        name: roomType.name,
        description: roomType.description ?? '',
        basePrice: roomType.basePrice,
        maxOccupancy: roomType.maxOccupancy,
        amenitiesRaw: roomType.amenities.join(', '),
      });
    } else {
      reset({
        name: '',
        description: '',
        basePrice: undefined as unknown as number,
        maxOccupancy: undefined as unknown as number,
        amenitiesRaw: '',
      });
    }
  }, [roomType, reset]);

  const onSubmit = async (data: RoomTypeFormData) => {
    const amenities = (data.amenitiesRaw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name: data.name,
      description: data.description || undefined,
      basePrice: data.basePrice,
      maxOccupancy: data.maxOccupancy,
      amenities,
    };

    try {
      if (isEdit) {
        await api.patch(`/inventory/room-types/${roomType.id}`, payload);
      } else {
        await api.post('/inventory/room-types', payload);
      }
      reset();
      onSuccess();
    } catch (err) {
      console.error('Error saving room type:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-warm-tan/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Editar tipo de habitación' : 'Nuevo tipo de habitación'}
        className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-warm-white border-l border-warm-line shadow-lg z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-warm-line">
          <h2 className="text-ink-1 text-lg font-semibold">
            {isEdit ? 'Editar tipo de habitación' : 'Nuevo tipo de habitación'}
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
          <div className="flex flex-col gap-1">
            <label
              htmlFor="rtName"
              className="text-sm font-medium text-ink-2"
            >
              Nombre
            </label>
            <Input
              id="rtName"
              type="text"
              placeholder="Suite Ejecutiva"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-terracotta-deep">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="rtDescription"
              className="text-sm font-medium text-ink-2"
            >
              Descripción{' '}
              <span className="text-ink-3 font-normal">(opcional)</span>
            </label>
            <textarea
              id="rtDescription"
              rows={3}
              placeholder="Vista panorámica, piso 10..."
              {...register('description')}
              className="flex w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-2 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta resize-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="rtBasePrice"
              className="text-sm font-medium text-ink-2"
            >
              Precio base (COP por noche)
            </label>
            <Input
              id="rtBasePrice"
              type="number"
              placeholder="350000"
              {...register('basePrice', { valueAsNumber: true })}
            />
            {errors.basePrice && (
              <p className="text-xs text-terracotta-deep">
                {errors.basePrice.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="rtMaxOccupancy"
              className="text-sm font-medium text-ink-2"
            >
              Máx. ocupantes
            </label>
            <Input
              id="rtMaxOccupancy"
              type="number"
              placeholder="2"
              {...register('maxOccupancy', { valueAsNumber: true })}
            />
            {errors.maxOccupancy && (
              <p className="text-xs text-terracotta-deep">
                {errors.maxOccupancy.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="rtAmenities"
              className="text-sm font-medium text-ink-2"
            >
              Amenidades{' '}
              <span className="text-ink-3 font-normal">
                (separadas por coma)
              </span>
            </label>
            <Input
              id="rtAmenities"
              type="text"
              placeholder="WiFi, Minibar, Jacuzzi, Caja fuerte"
              {...register('amenitiesRaw')}
            />
            <p className="text-xs text-ink-3">
              Ejemplo: WiFi, Minibar, Jacuzzi
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 mt-auto">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting
                ? 'Guardando...'
                : isEdit
                ? 'Guardar cambios'
                : 'Crear tipo'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
