import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import type { PublicOffer } from '../types';
import { formatValidity } from '../utils/formatValidity';
import { OfferDetailDrawer } from './OfferDetailDrawer';

interface OffersSectionProps {
  offers: PublicOffer[];
}

/**
 * 2026-05-28 — OffersSection
 *
 * Replaces the static "Restaurante" section on the public homepage.
 * Driven by GET /api/public/offers and managed from the admin /offers page.
 *
 * Behaviour:
 *  - If `offers` is empty the parent section is hidden by the consumer
 *    (HotelHomePage). This component still renders defensively in case it
 *    is mounted with an empty list — it returns null.
 *  - Click on the card → OfferDetailDrawer (full-screen split modal).
 *  - Click on the CTA button directly → booking flow / external link,
 *    without opening the drawer (stopPropagation on CTA wrapper).
 */
export function OffersSection({ offers }: OffersSectionProps) {
  const [selected, setSelected] = useState<PublicOffer | null>(null);

  if (!offers || offers.length === 0) return null;

  return (
    <section id="ofertas" className="scroll-mt-20">
      <h2 className="font-display text-2xl lg:text-3xl text-ink-1 mb-6">Ofertas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} onOpenDrawer={() => setSelected(offer)} />
        ))}
      </div>

      {/* Detail drawer — conditionally mounted so state resets on (re)open */}
      {selected && (
        <OfferDetailDrawer offer={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

interface OfferCardProps {
  offer: PublicOffer;
  onOpenDrawer: () => void;
}

function OfferCard({ offer, onOpenDrawer }: OfferCardProps) {
  const ctaText = offer.ctaText ?? 'Reservar';
  // External link wins. Otherwise: if the offer targets a room type, append
  // roomTypeId so the booking flow preselects + locks that type.
  const ctaHref = (() => {
    if (offer.ctaLink && /^https?:\/\//i.test(offer.ctaLink)) return offer.ctaLink;
    const base = `/booking?offer=${encodeURIComponent(offer.id)}`;
    return offer.roomType ? `${base}&roomTypeId=${encodeURIComponent(offer.roomType.id)}` : base;
  })();
  const isExternal = ctaHref.startsWith('http');
  const validity = formatValidity(offer.validFrom, offer.validTo);

  return (
    <button type="button"
      onClick={onOpenDrawer}
      aria-label={`Ver detalle de ${offer.title}`}
      className="group flex flex-col rounded-2xl overflow-hidden border border-warm-line bg-warm-white shadow-sm hover:shadow-md transition-shadow cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-warm-cream">
        <img
          src={offer.imageUrl}
          alt={offer.title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
        />
        {offer.badge && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-terracotta text-warm-white text-xs font-medium px-3 py-1 shadow-sm">
            <Sparkles className="w-3 h-3" />
            {offer.badge}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 p-5 flex-1">
        <h3 className="font-display text-lg text-ink-1 leading-snug">{offer.title}</h3>
        {/* Room type pill — only shown when the offer targets a specific type */}
        {offer.roomType && (
          <span className="self-start inline-flex items-center rounded-full bg-warm-cream border border-warm-line text-ink-2 text-xs font-medium px-2.5 py-0.5">
            Aplica a: {offer.roomType.name}
          </span>
        )}
        {offer.description && (
          <p className="text-sm text-ink-2 leading-relaxed line-clamp-4">{offer.description}</p>
        )}
        {validity && (
          <p className="text-xs text-ink-3 mt-auto">{validity}</p>
        )}
        {/* Wrap CTA in a span with stopPropagation so clicking it doesn't open the drawer */}
        <div className="pt-2">
          <span onClick={(e) => e.stopPropagation()}>
            {isExternal ? (
              <a
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-terracotta text-warm-white text-sm font-medium px-4 py-2 hover:bg-terracotta-deep transition-colors"
              >
                {ctaText}
              </a>
            ) : (
              <Link
                to={ctaHref}
                className="inline-flex items-center justify-center rounded-full bg-terracotta text-warm-white text-sm font-medium px-4 py-2 hover:bg-terracotta-deep transition-colors"
              >
                {ctaText}
              </Link>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}
