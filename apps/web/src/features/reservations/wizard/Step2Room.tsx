import { useAvailability } from '../reservations.api';
import { useReservationWizardStore } from '../store/reservation-wizard.store';
import { usePublicRoomTypes, type PublicRoomType } from '@/features/public-booking/public-booking.api';
import type { PricingBreakdown } from '@/features/pricing/types';

// ─── COP formatter ────────────────────────────────────────────────────────────
const formatCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="border border-warm-line rounded-xl p-4 animate-pulse">
      <div className="h-4 bg-warm-tan rounded w-24 mb-2" />
      <div className="h-3 bg-warm-tan rounded w-36 mb-1" />
      <div className="h-3 bg-warm-tan rounded w-20" />
    </div>
  );
}

/**
 * Build a minimal PricingBreakdown from a room type when staff creates a
 * request-only reservation (no physical room yet). Uses the base price × nights
 * + IVA 19% as a placeholder estimate; the real breakdown is computed at
 * confirm time by the backend.
 */
function makeEstimateBreakdown(
  type: PublicRoomType,
  checkIn: string,
  checkOut: string,
): PricingBreakdown {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(checkOut + 'T00:00:00.000Z').getTime() -
        new Date(checkIn + 'T00:00:00.000Z').getTime()) /
        86_400_000,
    ),
  );
  const subtotal = type.basePrice * nights;
  const totalIva = Math.round(subtotal * 0.19);
  const total = subtotal + totalIva;
  return {
    roomTypeId: type.id,
    ratePlanId: null,
    nights,
    items: [],
    subtotal,
    totalIva,
    total,
    currency: 'COP',
    appliedRatePlan: 'Estimado (tarifa base)',
    // these legacy fields keep backward compat with components that read them
    totalNights: nights,
  } as unknown as PricingBreakdown;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Step2Room — staff wizard step 2.
 *
 * 2026-05-27 redesign: now offers TWO selection modes in the same step:
 *  1. "Habitaciones específicas disponibles" — physical rooms free in the date
 *     range (existing behaviour, calls /api/reservations/availability).
 *  2. "Tipos de habitación (solicitud sin habitación asignada)" — always
 *     visible, lets the staff create a PENDING-style reservation without
 *     locking a specific room. Used when:
 *       - All physical rooms appear taken (request-to-book flow)
 *       - The admin wants to register a guest's request and decide the room later
 *       - A walk-in needs immediate registration before housekeeping confirms
 *
 * Selecting either option calls setStep2 which advances the wizard. The
 * difference is captured in store.step2.roomId — null for type-only requests.
 */
export function Step2Room() {
  const step1 = useReservationWizardStore((s) => s.step1);
  const setStep2 = useReservationWizardStore((s) => s.setStep2);

  const checkIn = step1.checkIn ?? '';
  const checkOut = step1.checkOut ?? '';
  const adults = step1.adults ?? 1;

  const { data: availabilityData, isLoading: availLoading, error: availError } =
    useAvailability({ checkIn, checkOut, adults }, { enabled: !!checkIn && !!checkOut });

  const { data: roomTypes = [], isLoading: typesLoading } = usePublicRoomTypes();

  const rooms = availabilityData?.rooms ?? [];

  function handleSelectRoom(room: typeof rooms[number]) {
    setStep2({
      roomId: room.id,
      roomTypeId: room.roomTypeId,
      roomNumber: room.number,
      roomTypeName: room.roomType.name,
      pricingBreakdown: room.pricing as PricingBreakdown,
    });
  }

  function handleSelectType(type: PublicRoomType) {
    setStep2({
      roomId: null,
      roomTypeId: type.id,
      roomNumber: null,
      roomTypeName: type.name,
      pricingBreakdown: makeEstimateBreakdown(type, checkIn, checkOut),
    });
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div>
        <p className="text-sm text-ink-2">
          Buscar disponibilidad para{' '}
          <span className="font-medium text-ink-1">
            {checkIn} → {checkOut}
          </span>
        </p>
        <p className="text-xs text-ink-3 mt-0.5">
          {adults} {adults === 1 ? 'adulto' : 'adultos'}
        </p>
      </div>

      {/* ─── Section A: specific rooms available ───────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-1">Habitaciones específicas disponibles</h3>
          <p className="text-xs text-ink-3 mt-0.5">
            Asigna una habitación física al momento de crear la reserva.
          </p>
        </div>

        {availLoading && (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {availError && (
          <p className="text-sm text-terracotta bg-terracotta-tint border border-terracotta-soft rounded px-3 py-2">
            Error al buscar disponibilidad. Igual puedes crear la reserva como solicitud abajo.
          </p>
        )}

        {!availLoading && !availError && rooms.length === 0 && (
          <p className="text-sm text-ink-3 bg-warm-cream border border-warm-line rounded px-3 py-3">
            No hay habitaciones físicas libres para esas fechas. Puedes crear la reserva
            como <strong>solicitud sin habitación específica</strong> en la sección de abajo —
            la recepción asignará una habitación al momento del check-in.
          </p>
        )}

        {!availLoading && !availError && rooms.length > 0 && (
          <div className="grid gap-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="border border-warm-line rounded-xl p-4 hover:border-terracotta hover:bg-terracotta-tint transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-ink-1">
                        Habitación {room.number}
                      </span>
                      <span className="text-xs text-ink-3 bg-warm-cream border border-warm-line px-1.5 py-0.5 rounded">
                        {room.roomType.name}
                      </span>
                    </div>
                    {room.photos?.[0]?.signedUrl && (
                      <img
                        src={room.photos[0].signedUrl}
                        alt={`Habitación ${room.number}`}
                        className="w-full h-28 object-cover rounded-md mb-2 border border-warm-line"
                      />
                    )}
                    <div className="mt-1">
                      <span className="text-base font-mono font-semibold text-ink-1">
                        {formatCOP.format(room.pricing?.total ?? 0)}
                      </span>
                      <span className="text-xs text-ink-3 ml-1">
                        total ({room.pricing?.totalNights ?? 0}{' '}
                        {(room.pricing?.totalNights ?? 0) === 1 ? 'noche' : 'noches'})
                      </span>
                    </div>
                  </div>
                  <button type="button"
                    onClick={() => handleSelectRoom(room)}
                    className="flex-shrink-0 px-4 py-2 rounded-md bg-terracotta text-warm-white text-sm font-medium hover:bg-terracotta-deep transition-colors focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-1"
                  >
                    Seleccionar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Section B: room types (request without specific room) ─────────── */}
      <section className="flex flex-col gap-3 border-t border-warm-line pt-6">
        <div>
          <h3 className="text-sm font-semibold text-ink-1">
            Tipos de habitación (solicitud sin asignar)
          </h3>
          <p className="text-xs text-ink-3 mt-0.5">
            Crea la reserva por categoría. La habitación física se elegirá en el check-in
            o desde el detalle de la reserva.
          </p>
        </div>

        {typesLoading && (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!typesLoading && roomTypes.length === 0 && (
          <p className="text-sm text-ink-3 bg-warm-cream border border-warm-line rounded px-3 py-2">
            No hay tipos de habitación publicados.
          </p>
        )}

        {!typesLoading && roomTypes.length > 0 && (
          <div className="grid gap-3">
            {roomTypes.map((type) => {
              const estimate = makeEstimateBreakdown(type, checkIn, checkOut);
              return (
                <div
                  key={type.id}
                  className="border border-warm-line rounded-xl p-4 hover:border-mustard hover:bg-warm-cream transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-ink-1">{type.name}</span>
                        {type.badge && (
                          <span className="text-xs text-mustard bg-warm-cream border border-warm-line px-1.5 py-0.5 rounded">
                            {type.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-3 mb-1">
                        Hasta {type.capacity} {type.capacity === 1 ? 'persona' : 'personas'}
                      </p>
                      {type.description && (
                        <p className="text-xs text-ink-3 line-clamp-2 mb-2">{type.description}</p>
                      )}
                      <div className="mt-1">
                        <span className="text-base font-mono font-semibold text-ink-1">
                          {formatCOP.format(estimate.total)}
                        </span>
                        <span className="text-xs text-ink-3 ml-1">
                          estimado ({estimate.totalNights}{' '}
                          {estimate.totalNights === 1 ? 'noche' : 'noches'})
                        </span>
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => handleSelectType(type)}
                      className="flex-shrink-0 px-4 py-2 rounded-md bg-mustard text-ink-1 text-sm font-medium hover:bg-mustard-deep hover:text-warm-white transition-colors focus:outline-none focus:ring-2 focus:ring-mustard focus:ring-offset-1"
                    >
                      Crear solicitud
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
