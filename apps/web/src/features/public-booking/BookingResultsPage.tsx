import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  usePublicRoomTypes,
  useRateOptions,
  type PublicRoomType,
  type RatePlanOption,
} from './public-booking.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function RoomTypeCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200" />
      <div className="p-5 flex flex-col gap-3">
        <div className="h-5 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-8 bg-gray-200 rounded w-full mt-2" />
      </div>
    </div>
  );
}

function RateOptionsSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse" aria-label="Cargando tarifas">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-lg border border-gray-100 p-3 flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-3/4" />
          </div>
          <div className="h-8 bg-gray-200 rounded w-24" />
        </div>
      ))}
    </div>
  );
}

// ─── Rate plan type badge ─────────────────────────────────────────────────────

function RateBadge({ type }: { type: string }) {
  switch (type) {
    case 'PROMO':
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
          Promoción
        </span>
      );
    case 'PACKAGE':
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
          Paquete
        </span>
      );
    case 'BAR':
    case 'BASE':
    default:
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
          Tarifa estándar
        </span>
      );
  }
}

// ─── Single rate row ──────────────────────────────────────────────────────────

interface RateRowProps {
  option: RatePlanOption;
  nights: number;
  onSelect: () => void;
}

function RateRow({ option, nights, onSelect }: RateRowProps) {
  const { breakdown } = option;
  const isBlocked = Boolean(breakdown.minNightsViolation);
  const violation = breakdown.minNightsViolation;

  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-2 ${
        isBlocked
          ? 'border-gray-100 bg-gray-50 opacity-60'
          : 'border-gray-200 bg-white hover:border-[#c45a3a]/40 transition-colors'
      }`}
      aria-disabled={isBlocked}
    >
      {/* Name + badge row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-800">{option.ratePlanName}</span>
        <RateBadge type={option.ratePlanType} />
      </div>

      {/* Description */}
      {option.description && (
        <p className="text-xs text-gray-500">{option.description}</p>
      )}

      {/* PACKAGE extras list — shown as included benefits, not as separate charges */}
      {option.ratePlanType === 'PACKAGE' && breakdown.extras.length > 0 && (
        <ul className="text-xs text-purple-700 space-y-0.5 pl-3 border-l-2 border-purple-200">
          {breakdown.extras.map((ex, i) => (
            <li key={i} className="flex items-center gap-1">
              <span className="font-medium">{ex.name}</span>
              {' · '}
              <span className="text-purple-500">incluido</span>
            </li>
          ))}
        </ul>
      )}

      {/* Price + CTA row */}
      <div className="flex items-center justify-between gap-3 mt-1">
        <div>
          <span className="text-lg font-bold text-[#c45a3a]">
            {formatCOP(breakdown.total)}
          </span>
          <span className="text-xs text-gray-400 ml-1">
            · {nights} noche{nights !== 1 ? 's' : ''} · IVA incluido
          </span>
        </div>

        {isBlocked ? (
          <span className="text-xs text-gray-500 shrink-0">
            Mínimo {violation!.required} noches
          </span>
        ) : (
          <button type="button"
            onClick={onSelect}
            className="shrink-0 bg-[#c45a3a] text-white text-sm px-4 py-1.5 rounded-lg font-medium hover:bg-[#a84830] transition-colors"
            aria-label={`Reservar ${option.ratePlanName}`}
          >
            Reservar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Rate options panel (lazy — fetches on expand) ────────────────────────────

/**
 * RateOptionsPanel wraps the expand-on-demand UX for a single room type card.
 *
 * UX choice: lazy fetch on expand.
 * - On mount, NO rate-options requests are fired. The user sees a "Ver tarifas"
 *   button. On first click the hook becomes enabled and fetches exactly once for
 *   that room type. Subsequent toggles reuse the cached result (staleTime 60s).
 * - Rationale: the catalogue can have N room types. Firing N parallel engine
 *   requests on page load would be wasteful and could overwhelm the API on
 *   larger hotels. Expand-on-demand keeps the first paint fast and gives the
 *   guest a natural progressive-disclosure flow.
 */
interface RateOptionsPanelProps {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  nights: number;
  onSelectRate: (option: RatePlanOption) => void;
}

function RateOptionsPanel({
  roomTypeId,
  checkIn,
  checkOut,
  adults,
  nights,
  onSelectRate,
}: RateOptionsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // Only enable the query once the user expands the panel.
  const { data: options, isLoading, isError } = useRateOptions(
    expanded
      ? { roomTypeId, checkIn, checkOut, adults }
      : null,
  );

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-[#c45a3a] hover:text-[#a84830] transition-colors"
        aria-expanded={expanded}
        aria-controls={`rate-panel-${roomTypeId}`}
      >
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {expanded ? 'Ocultar tarifas' : 'Ver tarifas'}
      </button>

      {expanded && (
        <div id={`rate-panel-${roomTypeId}`} className="mt-3 flex flex-col gap-2">
          {isLoading && <RateOptionsSkeleton />}

          {isError && (
            <p className="text-xs text-red-600 py-2">
              Error al cargar tarifas. Intenta de nuevo.
            </p>
          )}

          {!isLoading && !isError && options && options.length === 0 && (
            <p className="text-xs text-gray-500 py-2">
              No hay tarifas disponibles para estas fechas.
            </p>
          )}

          {!isLoading && !isError && options && options.length > 0 && (
            <>
              {options.map((opt, i) => (
                <RateRow
                  key={opt.ratePlanId ?? `base-${i}`}
                  option={opt}
                  nights={nights}
                  onSelect={() => onSelectRate(opt)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Room type card ───────────────────────────────────────────────────────────

interface RoomTypeCardProps {
  type: PublicRoomType;
  checkIn: string;
  checkOut: string;
  adults: number;
  nights: number;
  offer: string | null;
  onSelectRate: (option: RatePlanOption) => void;
}

function RoomTypeCard({
  type,
  checkIn,
  checkOut,
  adults,
  nights,
  offer,
  onSelectRate,
}: RoomTypeCardProps) {
  const photoSrc = type.photos[0]?.url ?? null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      {photoSrc ? (
        <img src={photoSrc} alt={type.name} className="w-full h-48 object-cover" />
      ) : (
        <div className="h-48 bg-gradient-to-br from-[#f9f5f0] to-[#e8d5c4] flex items-center justify-center">
          <span className="text-[#c45a3a] text-2xl font-serif px-6 text-center">{type.name}</span>
        </div>
      )}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tipo de habitación</p>
          <h3 className="text-lg font-semibold text-gray-800">{type.name}</h3>
          {type.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{type.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Hasta {type.capacity} {type.capacity === 1 ? 'persona' : 'personas'}</span>
          {type.badge && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-[#c45a3a]/10 text-[#a84830] font-medium">
              {type.badge}
            </span>
          )}
        </div>

        {type.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {type.amenities.slice(0, 4).map((a) => (
              <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-[#f9f5f0] text-[#a84830]">
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Rate options panel — lazy fetch on expand */}
        <RateOptionsPanel
          roomTypeId={type.id}
          checkIn={checkIn}
          checkOut={checkOut}
          adults={adults}
          nights={nights}
          onSelectRate={onSelectRate}
        />
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * BookingResultsPage — public catalogue of room TYPES at /booking/rooms.
 *
 * 2026-05-27 redesign: switched from per-room availability to a request-to-book
 * model by room TYPE.
 *
 * 2026-05-28 — Propagates `?offer=<id>` so the resulting reservation can be
 * tagged with `sourceOfferId` on POST /api/public/bookings.
 *
 * 2026-05-29 Phase 2 — Replaced flat client-side price (basePrice × nights × 1.19)
 * with engine-driven rate options. Each room type card has a "Ver tarifas" expand
 * that lazy-fetches GET /api/public/rate-options for that room type. The user picks
 * a specific rate plan, which navigates to checkout carrying ratePlanId + the
 * engine-computed total.
 */
export function BookingResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const checkIn = searchParams.get('checkIn') ?? '';
  const checkOut = searchParams.get('checkOut') ?? '';
  const adults = Number.parseInt(searchParams.get('adults') ?? '2', 10);
  const offer = searchParams.get('offer');
  const nights = checkIn && checkOut
    ? Math.round(
        (new Date(checkOut + 'T00:00:00.000Z').getTime() -
          new Date(checkIn + 'T00:00:00.000Z').getTime()) /
          86_400_000,
      )
    : 0;

  const hasParams = Boolean(checkIn && checkOut && adults);
  const hasValidRange = hasParams && nights >= 1;

  const { data: types, isLoading, isError } = usePublicRoomTypes();

  const handleSelectRate = (type: PublicRoomType, option: RatePlanOption) => {
    const params = new URLSearchParams({
      roomTypeId: type.id,
      checkIn,
      checkOut,
      adults: String(adults),
      total: String(option.breakdown.total),
      ratePlanName: option.ratePlanName,
    });
    if (option.ratePlanId) {
      params.set('ratePlanId', option.ratePlanId);
    }
    if (offer) {
      params.set('offer', offer);
    }
    navigate(`/booking/checkout?${params.toString()}`);
  };

  if (!hasParams) {
    return (
      <div className="min-h-screen bg-[#f9f5f0] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Parámetros de búsqueda incompletos.</p>
          <Link to="/booking" className="text-[#c45a3a] underline">Volver a buscar</Link>
        </div>
      </div>
    );
  }

  if (!hasValidRange) {
    return (
      <div className="min-h-screen bg-[#f9f5f0] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Selecciona al menos 1 noche (la salida debe ser posterior a la entrada).
          </p>
          <Link to="/booking" className="text-[#c45a3a] underline">Volver a buscar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f5f0]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Elige tu tipo de habitación</h1>
            <p className="text-sm text-gray-500">
              {checkIn} → {checkOut} · {nights} noche{nights !== 1 ? 's' : ''} · {adults} huésped{adults !== 1 ? 'es' : ''}
            </p>
          </div>
          <Link to="/booking" className="text-sm text-[#c45a3a] hover:underline">
            ← Cambiar fechas
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto py-8 px-6">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => <RoomTypeCardSkeleton key={i} />)}
          </div>
        )}

        {isError && (
          <div className="text-center py-16">
            <p className="text-red-600 mb-4">Error al cargar el catálogo. Intenta de nuevo.</p>
            <Link to="/booking" className="text-[#c45a3a] underline">Volver</Link>
          </div>
        )}

        {!isLoading && !isError && types && types.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-600 text-lg mb-2">No hay tipos de habitación publicados.</p>
            <p className="text-gray-400 mb-6">Contacta directamente al hotel.</p>
          </div>
        )}

        {!isLoading && !isError && types && types.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {types.map((type) => (
                <RoomTypeCard
                  key={type.id}
                  type={type}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  adults={adults}
                  nights={nights}
                  offer={offer}
                  onSelectRate={(opt) => handleSelectRate(type, opt)}
                />
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 mt-8">
              Al enviar tu solicitud, te contactaremos para confirmar disponibilidad y asignar tu habitación.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
