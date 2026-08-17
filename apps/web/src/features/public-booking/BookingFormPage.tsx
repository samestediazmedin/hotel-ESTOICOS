import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Heart } from 'lucide-react';
import { useCsrfToken, useCreatePublicBooking, usePublicOffer } from './public-booking.api';

// ─── Schema ───────────────────────────────────────────────────────────────────

const guestFormSchema = z.object({
  // Campos requeridos (preexistentes)
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
  email: z.string().email('Correo electrónico inválido'),
  phone: z.string().min(5, 'Teléfono inválido').max(40),
  documentType: z.enum(['CC', 'CE', 'PASSPORT', 'TI', 'NIT'], {
    message: 'Selecciona un tipo de documento',
  }),
  documentNumber: z.string().min(3, 'Número de documento inválido').max(40),
  nationality: z.string().length(2, 'Código de país de 2 letras (ej: CO, US)'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  // Phase 15 — Extended contact capture (GCC-04)
  preferredLanguage: z.enum(['es', 'en']).optional().default('es'),
  contactPreference: z.enum(['EMAIL', 'PHONE', 'WHATSAPP']).nullable().optional(),
  whatsappNumber: z
    .string()
    // Strip all whitespace then trim — "   " → "" → treated as absent by onSubmit normalisation
    .transform((v) => (v ?? '').replace(/\s+/g, '').trim())
    .pipe(
      z.string()
        .refine(
          (v) => v === '' || /^\+[1-9]\d{6,14}$/.test(v),
          { message: 'WhatsApp debe ser formato E.164 (ej: +573001234567)' },
        )
    )
    .optional(),
  marketingConsent: z.boolean().optional().default(false),
  dietaryRestrictions: z.string().max(500, 'Máximo 500 caracteres').optional(),
  specialRequests: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
});

type GuestFormInput = z.input<typeof guestFormSchema>;
type GuestFormData = z.output<typeof guestFormSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * BookingFormPage — guest data form at /booking/checkout.
 *
 * Reads room context from URL search params.
 * Fetches CSRF token via useCsrfToken (already cached from BookingPage mount).
 * On submit: calls POST /api/public/bookings with X-CSRF-Token header.
 * On 409: inline error + link to start over.
 * On 403: CSRF expired — invalidates token and shows retry instructions.
 */
export function BookingFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 2026-05-27 — public flow no longer captures roomId. The admin assigns a
  // specific room at check-in. We only carry roomTypeId through the wizard.
  const roomTypeIdParam = searchParams.get('roomTypeId') ?? '';
  const checkIn = searchParams.get('checkIn') ?? '';
  const checkOut = searchParams.get('checkOut') ?? '';
  const adults = parseInt(searchParams.get('adults') ?? '2', 10);
  const total = parseFloat(searchParams.get('total') ?? '0');
  const sourceOfferId = searchParams.get('offer');
  // 2026-05-29 Phase 2 — engine-driven rate plan chosen in BookingResultsPage.
  // ratePlanId: null or absent → server uses BAR (backward-compat).
  // ratePlanName: display-only, carried as query param to avoid a re-fetch.
  const ratePlanId = searchParams.get('ratePlanId') ?? null;
  const ratePlanName = searchParams.get('ratePlanName')
    ? decodeURIComponent(searchParams.get('ratePlanName') ?? '')
    : null;

  // Fetch the offer when present so we can enforce the room-type lock.
  const { data: offerDetail } = usePublicOffer(sourceOfferId);

  // When the offer targets a specific room type, that type is authoritative —
  // the URL param may lag or be absent (direct offer CTA click).
  const lockedRoomType = offerDetail?.roomType ?? null;
  const roomTypeId = lockedRoomType?.id || roomTypeIdParam;

  const nights = checkIn && checkOut
    ? Math.round((new Date(checkOut + 'T00:00:00.000Z').getTime() - new Date(checkIn + 'T00:00:00.000Z').getTime()) / 86_400_000)
    : 0;

  // Ensure CSRF token is ready
  const { isLoading: isCsrfLoading } = useCsrfToken();
  const { mutateAsync: createBooking, isPending } = useCreatePublicBooking();

  const [serverError, setServerError] = useState<string | null>(null);
  const [csrfExpired, setCsrfExpired] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuestFormInput, unknown, GuestFormData>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: {
      nationality: 'CO',
      documentType: 'CC',
      preferredLanguage: 'es',
      marketingConsent: false,
    },
  });

  const onSubmit = async (data: GuestFormData) => {
    setServerError(null);
    setCsrfExpired(false);

    try {
      // Phase 15 — normalise empty optional strings to undefined for cleaner payload
      const result = await createBooking({
        ...data,
        whatsappNumber: data.whatsappNumber || undefined,
        dietaryRestrictions: data.dietaryRestrictions || undefined,
        specialRequests: data.specialRequests || undefined,
        roomTypeId,
        checkIn,
        checkOut,
        adults,
        sourceOfferId,
        // Phase 2 — forward chosen rate plan; server recalculates with this plan.
        ratePlanId: ratePlanId || undefined,
      });

      navigate(
        `/booking/confirmation?reservationId=${result.reservationId}&guestName=${encodeURIComponent(result.guestName)}&total=${result.total}`,
      );
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setServerError('La habitación ya no está disponible para esas fechas. Vuelve a buscar disponibilidad.');
      } else if (status === 403) {
        setCsrfExpired(true);
        // Invalidate CSRF token cache so useCsrfToken refetches on retry
        await queryClient.invalidateQueries({ queryKey: ['public', 'csrf'] });
      } else {
        setServerError('Ocurrió un error al procesar tu reserva. Intenta de nuevo.');
      }
    }
  };

  if (!roomTypeId || !checkIn || !checkOut) {
    return (
      <div className="min-h-screen bg-[#f9f5f0] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Información de reserva incompleta.</p>
          <Link to="/booking" className="text-[#c45a3a] underline">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f5f0]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">Datos del huésped</h1>
          <Link to={`/booking/rooms?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}`}
            className="text-sm text-[#c45a3a] hover:underline">
            ← Cambiar habitación
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto py-8 px-6">
        {/* Booking summary */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Resumen de tu reserva</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-600">Entrada</span><span className="font-medium">{checkIn}</span>
            <span className="text-gray-600">Salida</span><span className="font-medium">{checkOut}</span>
            <span className="text-gray-600">Noches</span><span className="font-medium">{nights}</span>
            <span className="text-gray-600">Huéspedes</span><span className="font-medium">{adults}</span>
            {ratePlanName && (
              <>
                <span className="text-gray-600">Tarifa</span>
                <span className="font-medium text-gray-800">{ratePlanName}</span>
              </>
            )}
            <span className="text-gray-600 font-semibold">Total</span>
            <span className="font-bold text-[#c45a3a] text-base">{formatCOP(total)}</span>
          </div>
          {/* Room type lock banner — shown when the offer targets a specific room type */}
          {lockedRoomType && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-warm-cream border border-warm-line px-3 py-2 text-sm text-ink-2">
              <span className="font-medium text-ink-1">Esta oferta aplica únicamente a</span>
              <span className="inline-flex items-center rounded-full bg-terracotta/10 text-terracotta-deep text-xs font-semibold px-2 py-0.5">
                {lockedRoomType.name}
              </span>
            </div>
          )}
        </div>

        {/* Errors */}
        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm">{serverError}</p>
            {serverError.includes('disponible') && (
              <Link to="/booking" className="text-[#c45a3a] underline text-sm mt-2 block">
                Buscar otra habitación
              </Link>
            )}
          </div>
        )}

        {csrfExpired && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">
              Tu sesión de seguridad expiró. El token CSRF ha sido renovado. Por favor, intenta enviar el formulario de nuevo.
            </p>
          </div>
        )}

        {/* Guest form */}
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-100 p-6 flex flex-col gap-5">
          <h2 className="text-lg font-semibold text-gray-800">Información personal</h2>

          <div className="flex flex-col gap-1">
            <label htmlFor="fullName" className="text-sm font-medium text-gray-700">Nombre completo *</label>
            <input id="fullName" type="text" className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c45a3a]/30" {...register('fullName')} />
            {errors.fullName && <p className="text-xs text-red-600">{errors.fullName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">Correo electrónico *</label>
              <input id="email" type="email" className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c45a3a]/30" {...register('email')} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="phone" className="text-sm font-medium text-gray-700">Teléfono *</label>
              <input id="phone" type="tel" className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c45a3a]/30" {...register('phone')} />
              {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="documentType" className="text-sm font-medium text-gray-700">Tipo de documento *</label>
              <select id="documentType" className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c45a3a]/30 bg-white" {...register('documentType')}>
                <option value="CC">CC — Cédula de Ciudadanía</option>
                <option value="CE">CE — Cédula de Extranjería</option>
                <option value="PASSPORT">Pasaporte</option>
                <option value="TI">TI — Tarjeta de Identidad</option>
                <option value="NIT">NIT</option>
              </select>
              {errors.documentType && <p className="text-xs text-red-600">{errors.documentType.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="documentNumber" className="text-sm font-medium text-gray-700">Número de documento *</label>
              <input id="documentNumber" type="text" className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c45a3a]/30" {...register('documentNumber')} />
              <p className="text-xs text-gray-400">Tu documento se guarda cifrado por ley</p>
              {errors.documentNumber && <p className="text-xs text-red-600">{errors.documentNumber.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="nationality" className="text-sm font-medium text-gray-700">Nacionalidad (código ISO) *</label>
              <input id="nationality" type="text" maxLength={2} placeholder="CO" className="border border-gray-200 rounded-lg px-4 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#c45a3a]/30" {...register('nationality')} />
              <p className="text-xs text-gray-400">Ej: CO, US, ES, MX</p>
              {errors.nationality && <p className="text-xs text-red-600">{errors.nationality.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="dateOfBirth" className="text-sm font-medium text-gray-700">Fecha de nacimiento *</label>
              {/* HTML date input returns YYYY-MM-DD directly — no UTC shift risk (D-15 note) */}
              <input id="dateOfBirth" type="date" className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c45a3a]/30" {...register('dateOfBirth')} />
              {errors.dateOfBirth && <p className="text-xs text-red-600">{errors.dateOfBirth.message}</p>}
            </div>
          </div>

          {/* ─── Phase 15 — Preferencias de contacto (colapsable) ─────────── */}
          <details className="rounded-lg border border-warm-line overflow-hidden bg-warm-paper">
            <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-warm-cream list-none [&::-webkit-details-marker]:hidden">
              <MessageCircle className="w-4 h-4 text-terracotta flex-shrink-0" />
              <span className="font-medium text-ink-1 text-sm">Preferencias de contacto</span>
              <span className="ml-auto text-xs text-ink-3">(opcional)</span>
            </summary>
            <div className="p-4 space-y-4 bg-warm-white border-t border-warm-line">
              {/* WhatsApp */}
              <div className="flex flex-col gap-1">
                <label htmlFor="whatsappNumber" className="text-sm font-medium text-ink-2">WhatsApp</label>
                <input
                  id="whatsappNumber"
                  type="tel"
                  placeholder="+57 300 123 4567"
                  className="border border-warm-line rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 bg-white"
                  {...register('whatsappNumber')}
                />
                <p className="text-xs text-ink-3">Incluye el código de país (ej: +57 para Colombia)</p>
                {errors.whatsappNumber && (
                  <p className="text-xs text-terracotta">{errors.whatsappNumber.message}</p>
                )}
              </div>

              {/* Preferencia de contacto */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-ink-2">Prefiero ser contactado por</label>
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-sm text-ink-1 cursor-pointer">
                    <input type="radio" value="EMAIL" {...register('contactPreference')} className="accent-terracotta" />
                    Correo electrónico
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-1 cursor-pointer">
                    <input type="radio" value="PHONE" {...register('contactPreference')} className="accent-terracotta" />
                    Teléfono
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-1 cursor-pointer">
                    <input type="radio" value="WHATSAPP" {...register('contactPreference')} className="accent-terracotta" />
                    WhatsApp
                  </label>
                </div>
              </div>

              {/* Idioma preferido */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-ink-2">Idioma preferido</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-ink-1 cursor-pointer">
                    <input type="radio" value="es" {...register('preferredLanguage')} className="accent-terracotta" />
                    Español
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-1 cursor-pointer">
                    <input type="radio" value="en" {...register('preferredLanguage')} className="accent-terracotta" />
                    English
                  </label>
                </div>
              </div>

              {/* Consentimiento de marketing — Ley 1581 Colombia */}
              <div className="flex items-start gap-2">
                <input
                  id="marketingConsent"
                  type="checkbox"
                  {...register('marketingConsent')}
                  className="mt-1 accent-terracotta"
                />
                <label htmlFor="marketingConsent" className="text-sm text-ink-2 leading-snug cursor-pointer">
                  Quiero recibir ofertas y novedades del hotel. Puedo darme de baja en cualquier momento.
                </label>
              </div>
            </div>
          </details>

          {/* ─── Phase 15 — Preferencias adicionales (colapsable) ─────────── */}
          <details className="rounded-lg border border-warm-line overflow-hidden bg-warm-paper">
            <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-warm-cream list-none [&::-webkit-details-marker]:hidden">
              <Heart className="w-4 h-4 text-terracotta flex-shrink-0" />
              <span className="font-medium text-ink-1 text-sm">Preferencias adicionales</span>
              <span className="ml-auto text-xs text-ink-3">(opcional)</span>
            </summary>
            <div className="p-4 space-y-4 bg-warm-white border-t border-warm-line">
              {/* Restricciones dietarias */}
              <div className="flex flex-col gap-1">
                <label htmlFor="dietaryRestrictions" className="text-sm font-medium text-ink-2">Restricciones dietarias</label>
                <textarea
                  id="dietaryRestrictions"
                  maxLength={500}
                  rows={3}
                  placeholder="Ej: vegetariano, sin gluten, alergia a frutos secos"
                  className="border border-warm-line rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 bg-white resize-none"
                  {...register('dietaryRestrictions')}
                />
                {errors.dietaryRestrictions && (
                  <p className="text-xs text-terracotta">{errors.dietaryRestrictions.message}</p>
                )}
              </div>

              {/* Solicitudes especiales */}
              <div className="flex flex-col gap-1">
                <label htmlFor="specialRequests" className="text-sm font-medium text-ink-2">Solicitudes especiales</label>
                <textarea
                  id="specialRequests"
                  maxLength={1000}
                  rows={4}
                  placeholder="Ej: cama extra, cuna para bebé, vista a los cerros si es posible"
                  className="border border-warm-line rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 bg-white resize-none"
                  {...register('specialRequests')}
                />
                {errors.specialRequests && (
                  <p className="text-xs text-terracotta">{errors.specialRequests.message}</p>
                )}
              </div>
            </div>
          </details>

          <button
            type="submit"
            disabled={isPending || isCsrfLoading}
            className="bg-[#c45a3a] text-white py-3 px-8 rounded-lg font-medium hover:bg-[#a84830] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Procesando...' : 'Confirmar reserva'}
          </button>
        </form>
      </div>
    </div>
  );
}
