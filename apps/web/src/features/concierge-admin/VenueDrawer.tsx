import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { VenuePhotoUploader } from './VenuePhotoUploader';
import { createVenue, updateVenue } from './concierge-admin.api';
import type { Venue, CreateVenueDto } from './concierge-admin.api';
import type { VenueType } from '@/features/concierge/types';

// ─── Form schema ──────────────────────────────────────────────────────────────

const VENUE_TYPES: VenueType[] = [
  'RESTAURANT', 'BAR', 'CAFE', 'MUSEUM', 'PARK',
  'SHOPPING', 'NIGHTLIFE', 'TRANSPORT_HUB', 'EVENT_VENUE', 'OTHER',
];

const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  RESTAURANT: 'Restaurante',
  BAR: 'Bar',
  CAFE: 'Café',
  MUSEUM: 'Museo',
  PARK: 'Parque',
  SHOPPING: 'Compras',
  NIGHTLIFE: 'Vida nocturna',
  TRANSPORT_HUB: 'Transporte',
  EVENT_VENUE: 'Evento',
  OTHER: 'Otro',
};

/**
 * Zod schema for venue form.
 * Mirrors backend validation for correctness at the form level.
 * Frontend schema — does NOT need to be identical to backend DTO.
 */
const venueFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  type: z.enum([
    'RESTAURANT', 'BAR', 'CAFE', 'MUSEUM', 'PARK',
    'SHOPPING', 'NIGHTLIFE', 'TRANSPORT_HUB', 'EVENT_VENUE', 'OTHER',
  ] as [VenueType, ...VenueType[]]),
  lat: z
    .number()
    .min(-90, 'Latitud mínima -90')
    .max(90, 'Latitud máxima 90'),
  lng: z
    .number()
    .min(-180, 'Longitud mínima -180')
    .max(180, 'Longitud máxima 180'),
  description: z.string().max(1000).optional(),
  rating: z.number().min(0).max(5).optional().or(z.nan().transform(() => undefined)),
  address: z.string().max(300).optional(),
  phone: z
    .string()
    .regex(/^\+57\d{10}$/, 'Formato: +57 seguido de 10 dígitos')
    .optional()
    .or(z.literal('')),
  mapsUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  reservationUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

type VenueFormInput = z.input<typeof venueFormSchema>;
type VenueFormData = z.output<typeof venueFormSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface VenueDrawerProps {
  isOpen: boolean;
  venue: Venue | null; // null = create mode, non-null = edit mode
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * VenueDrawer — inline fixed-panel drawer for venue create/edit.
 *
 * CRITICAL: Uses fixed inset-y-0 right-0 pattern (NOT shadcn Sheet).
 * Convention established in Phase 02-01 (RoomDrawer) and repeated here.
 */
export function VenueDrawer({ isOpen, venue, onClose, onSuccess }: VenueDrawerProps) {
  const queryClient = useQueryClient();
  const isEdit = venue !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VenueFormInput, unknown, VenueFormData>({
    resolver: zodResolver(venueFormSchema),
    defaultValues: { isActive: true, type: 'RESTAURANT' },
  });

  // Populate form when editing
  useEffect(() => {
    if (venue) {
      reset({
        name: venue.name,
        type: venue.type,
        lat: venue.lat,
        lng: venue.lng,
        description: venue.description ?? '',
        rating: venue.rating ?? undefined,
        address: venue.address ?? '',
        phone: venue.phone ?? '',
        mapsUrl: venue.mapsUrl ?? '',
        reservationUrl: venue.reservationUrl ?? '',
        website: venue.website ?? '',
        isActive: venue.isActive,
      });
    } else {
      reset({
        name: '',
        type: 'RESTAURANT',
        lat: 4.711,
        lng: -74.0721,
        isActive: true,
      });
    }
  }, [venue, reset]);

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const onSubmit = async (data: VenueFormData) => {
    const dto: CreateVenueDto = {
      name: data.name,
      type: data.type,
      lat: data.lat,
      lng: data.lng,
      description: data.description || undefined,
      rating: data.rating,
      address: data.address || undefined,
      phone: data.phone || undefined,
      mapsUrl: data.mapsUrl || undefined,
      reservationUrl: data.reservationUrl || undefined,
      website: data.website || undefined,
      isActive: data.isActive,
    };

    try {
      if (isEdit) {
        await updateVenue(venue.id, dto);
      } else {
        await createVenue(dto);
      }
      void queryClient.invalidateQueries({ queryKey: ['concierge', 'venues'] });
      onSuccess();
    } catch (err) {
      console.error('Error saving venue:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Inline fixed-panel drawer — NOT shadcn Sheet */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Editar: ${venue!.name}` : 'Nuevo lugar'}
        className="fixed inset-y-0 right-0 w-full max-w-md bg-warm-white border-l border-warm-line shadow-xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-warm-line">
          <h2 className="text-ink-1 text-lg font-semibold">
            {isEdit ? `Editar: ${venue!.name}` : 'Nuevo lugar'}
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
        <div className="flex-1 overflow-y-auto p-6">
          <form
            onSubmit={handleSubmit(onSubmit)}
            autoComplete="off"
            className="flex flex-col gap-4"
            id="venue-form"
          >
            {/* Name */}
            <div className="flex flex-col gap-1">
              <label htmlFor="venueName" className="text-sm font-medium text-ink-2">
                Nombre *
              </label>
              <Input id="venueName" {...register('name')} placeholder="El Cielo Restaurante" />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1">
              <label htmlFor="venueType" className="text-sm font-medium text-ink-2">
                Tipo *
              </label>
              <select
                id="venueType"
                {...register('type')}
                className="flex h-9 w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-1 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary"
              >
                {VENUE_TYPES.map((t) => (
                  <option key={t} value={t}>{VENUE_TYPE_LABELS[t]}</option>
                ))}
              </select>
              {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
            </div>

            {/* Lat + Lng */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label htmlFor="venueLat" className="text-sm font-medium text-ink-2">
                  Latitud *
                </label>
                <Input
                  id="venueLat"
                  type="number"
                  step="any"
                  {...register('lat', { valueAsNumber: true })}
                  placeholder="4.711"
                />
                {errors.lat && <p className="text-xs text-red-500">{errors.lat.message}</p>}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label htmlFor="venueLng" className="text-sm font-medium text-ink-2">
                  Longitud *
                </label>
                <Input
                  id="venueLng"
                  type="number"
                  step="any"
                  {...register('lng', { valueAsNumber: true })}
                  placeholder="-74.0721"
                />
                {errors.lng && <p className="text-xs text-red-500">{errors.lng.message}</p>}
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label htmlFor="venueDesc" className="text-sm font-medium text-ink-2">
                Descripción <span className="text-ink-3 font-normal">(opcional)</span>
              </label>
              <textarea
                id="venueDesc"
                rows={2}
                {...register('description')}
                className="flex w-full rounded-md border border-warm-line-strong bg-warm-cream px-3 py-2 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary resize-none"
              />
            </div>

            {/* Rating */}
            <div className="flex flex-col gap-1">
              <label htmlFor="venueRating" className="text-sm font-medium text-ink-2">
                Calificación <span className="text-ink-3 font-normal">(0–5)</span>
              </label>
              <Input
                id="venueRating"
                type="number"
                step="0.1"
                min="0"
                max="5"
                {...register('rating', { valueAsNumber: true })}
                placeholder="4.5"
              />
            </div>

            {/* Address */}
            <div className="flex flex-col gap-1">
              <label htmlFor="venueAddress" className="text-sm font-medium text-ink-2">
                Dirección <span className="text-ink-3 font-normal">(opcional)</span>
              </label>
              <Input id="venueAddress" {...register('address')} placeholder="Calle 127 # 21-30" />
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1">
              <label htmlFor="venuePhone" className="text-sm font-medium text-ink-2">
                Teléfono <span className="text-ink-3 font-normal">(opcional — +57XXXXXXXXXX)</span>
              </label>
              <Input id="venuePhone" {...register('phone')} placeholder="+573001234567" />
              {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
            </div>

            {/* Maps URL */}
            <div className="flex flex-col gap-1">
              <label htmlFor="venueMaps" className="text-sm font-medium text-ink-2">
                URL de Maps <span className="text-ink-3 font-normal">(opcional)</span>
              </label>
              <Input id="venueMaps" {...register('mapsUrl')} placeholder="https://..." />
              {errors.mapsUrl && <p className="text-xs text-red-500">{errors.mapsUrl.message}</p>}
            </div>

            {/* Reservation URL */}
            <div className="flex flex-col gap-1">
              <label htmlFor="venueRes" className="text-sm font-medium text-ink-2">
                URL de reserva <span className="text-ink-3 font-normal">(opcional)</span>
              </label>
              <Input id="venueRes" {...register('reservationUrl')} placeholder="https://..." />
              {errors.reservationUrl && (
                <p className="text-xs text-red-500">{errors.reservationUrl.message}</p>
              )}
            </div>

            {/* Website */}
            <div className="flex flex-col gap-1">
              <label htmlFor="venueWebsite" className="text-sm font-medium text-ink-2">
                Sitio web <span className="text-ink-3 font-normal">(opcional)</span>
              </label>
              <Input id="venueWebsite" {...register('website')} placeholder="https://..." />
              {errors.website && <p className="text-xs text-red-500">{errors.website.message}</p>}
            </div>

            {/* isActive toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="venueActive"
                {...register('isActive')}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="venueActive" className="text-sm font-medium text-ink-2">
                Activo (visible para el concierge)
              </label>
            </div>
          </form>

          {/* Photo uploader — edit mode only */}
          {isEdit && venue && (
            <div className="mt-6 pt-6 border-t border-warm-line flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-ink-1">Foto del lugar</h3>
              {venue.photoUrl && (
                <img
                  src={`${(import.meta.env.VITE_R2_PUBLIC_URL as string) ?? ''}/${venue.photoUrl}`}
                  alt={venue.name}
                  className="w-full aspect-video object-cover rounded-lg"
                />
              )}
              <VenuePhotoUploader
                venueId={venue.id}
                onUploaded={() => {
                  void queryClient.invalidateQueries({ queryKey: ['concierge', 'venues'] });
                }}
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-warm-line p-4 flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="venue-form"
            className="flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear lugar'}
          </Button>
        </div>
      </aside>
    </>
  );
}
