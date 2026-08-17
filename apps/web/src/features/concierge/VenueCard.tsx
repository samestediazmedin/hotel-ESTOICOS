import { MapPin, Star, Phone, Navigation, ExternalLink } from 'lucide-react';
import type { VenueCardData, VenueType } from './types';

// ─── Spanish type labels ──────────────────────────────────────────────────────

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
  OTHER: 'Lugar',
};

// ─── Rating stars ─────────────────────────────────────────────────────────────

function RatingStars({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < filled ? 'fill-mustard text-mustard' : 'text-ink-4'
          }`}
          aria-hidden
        />
      ))}
      <span className="text-xs text-ink-3 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VenueCardProps {
  venue: VenueCardData;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * VenueCard — renders a Bogotá venue recommendation from the concierge.
 *
 * 2026-05-26 redesign (no-photo edition): Foursquare's free tier does not expose
 * real venue photos. Rather than render an empty grey photo slot, the card now
 * uses Foursquare's per-category PNG icon as the visual identity and emphasises
 * the textual recommendation (name, category, distance, address). This keeps the
 * card honest — no missing-data placeholders — and visually intentional.
 *
 * Photo support remains in the data model: if the backend ever populates a real
 * photoUrl (e.g. after switching to a Foursquare paid tier or migrating to Yelp /
 * Google Places), the component automatically falls back to showing the image.
 */
export function VenueCard({ venue }: VenueCardProps) {
  const {
    name,
    type,
    category,
    rating,
    distanceKm,
    photoUrl,
    categoryIconUrl,
    mapsUrl,
    phone,
    reservationUrl,
    address,
  } = venue;

  // Universal Google Maps navigation URL (works on iOS + Android via deep link).
  // Backend always provides mapsUrl from lat/lng. Fallback is client-side defense.
  const mapsHref =
    mapsUrl ??
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name + (address ? ', ' + address : ''))}`;

  // photoUrl may arrive either as a full URL (Foursquare paid / external CDN) or
  // as a bare R2 object key (legacy admin-uploaded photos).
  const r2PublicUrl = (import.meta.env.VITE_R2_PUBLIC_URL as string) ?? '';
  const photoSrc = photoUrl
    ? /^https?:\/\//i.test(photoUrl)
      ? photoUrl
      : r2PublicUrl
        ? `${r2PublicUrl}/${photoUrl}`
        : null
    : null;

  const typeLabel = VENUE_TYPE_LABELS[type] ?? VENUE_TYPE_LABELS.OTHER;
  // Prefer the raw Foursquare category string ("Italian Restaurant", "Coffee Shop")
  // because it's more specific than the bucketed type label ("Restaurante").
  const subtitle =
    category && category.trim().length > 0 ? category : typeLabel;

  return (
    <article className="rounded-2xl border border-warm-line bg-warm-white shadow-sm overflow-hidden flex flex-col">
      {/* Hero — real photo if available; otherwise the category icon + name + subtitle */}
      {photoSrc ? (
        <div className="aspect-video bg-warm-cream overflow-hidden">
          <img
            src={photoSrc}
            alt={`Foto de ${name}`}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 pt-4">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-terracotta-tint flex items-center justify-center">
            {categoryIconUrl ? (
              <img
                src={categoryIconUrl}
                alt=""
                loading="lazy"
                className="w-7 h-7 object-contain"
                aria-hidden
              />
            ) : (
              <MapPin className="w-6 h-6 text-terracotta-deep" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base text-ink-1 leading-snug truncate">
              {name}
            </h3>
            <p className="text-xs text-ink-3 mt-0.5 truncate">{subtitle}</p>
          </div>
        </div>
      )}

      {/* Content — when there's a hero photo we still need name + subtitle below
          (the photo replaces the icon, but the title block is essential). */}
      <div className="p-4 flex flex-col gap-3">
        {photoSrc && (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-base text-ink-1 leading-snug">{name}</h3>
              <p className="text-xs text-ink-3 mt-0.5">{subtitle}</p>
            </div>
            <span className="shrink-0 rounded-full bg-terracotta-tint px-2 py-0.5 text-xs font-medium text-terracotta-deep">
              {typeLabel}
            </span>
          </div>
        )}

        {/* Rating + Distance */}
        <div className="flex items-center gap-3 flex-wrap text-ink-3">
          {rating !== null && <RatingStars rating={rating} />}
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />
            {distanceKm.toFixed(1)} km del hotel
          </span>
        </div>

        {/* Address (optional) */}
        {address && (
          <p className="text-xs text-ink-4 line-clamp-2">{address}</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Cómo llegar — ALWAYS present */}
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta px-3 py-2 text-xs font-medium text-warm-white hover:bg-terracotta-deep transition-colors"
          >
            <Navigation className="w-3.5 h-3.5 shrink-0" aria-hidden />
            Cómo llegar
          </a>

          {/* Llamar — ONLY if phone present */}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-warm-line bg-warm-white px-3 py-2 text-xs font-medium text-ink-2 hover:bg-warm-cream transition-colors"
            >
              <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden />
              Llamar
            </a>
          )}

          {/* Reservar — ONLY if reservationUrl present */}
          {reservationUrl && (
            <a
              href={reservationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-warm-line bg-warm-white px-3 py-2 text-xs font-medium text-ink-2 hover:bg-warm-cream transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
              Reservar
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
