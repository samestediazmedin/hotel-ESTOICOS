import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles } from 'lucide-react';
import type { PublicOffer } from '../types';
import { formatValidity } from '../utils/formatValidity';

interface OfferDetailDrawerProps {
  offer: PublicOffer;
  onClose: () => void;
}

/**
 * OfferDetailDrawer — full-screen detail modal for a single public offer.
 *
 * Layout mirrors RoomTypeDetailDrawer:
 *   - Desktop (lg+): two columns — LEFT 60% large image, RIGHT 40% info panel
 *   - Mobile/tablet: stacked — image on top, info below
 *
 * Differences from RoomTypeDetailDrawer (by design):
 *   - No gallery (offers have exactly one image) — no chevrons, no counter,
 *     no thumbnail strip.
 *   - Image uses object-contain (not object-cover) so portrait / screenshot
 *     promotional images are never cropped.
 *   - CTA follows offer rules: external href when ctaLink is absolute URL,
 *     otherwise /booking?offer=<id>.
 */
export function OfferDetailDrawer({ offer, onClose }: OfferDetailDrawerProps) {
  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const validity = formatValidity(offer.validFrom, offer.validTo);

  const ctaText = offer.ctaText ?? 'Reservar';
  const isExternal =
    offer.ctaLink !== null && /^https?:\/\//i.test(offer.ctaLink);
  const ctaHref = (() => {
    if (isExternal) return offer.ctaLink as string;
    const base = `/booking?offer=${encodeURIComponent(offer.id)}`;
    return offer.roomType ? `${base}&roomTypeId=${encodeURIComponent(offer.roomType.id)}` : base;
  })();

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        className="fixed inset-0 z-40 bg-ink-1/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Full-screen modal container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`offer-detail-${offer.id}-title`}
        className="fixed inset-0 z-50 flex flex-col lg:grid lg:grid-cols-[3fr_2fr] bg-warm-white"
      >
        {/* ── LEFT: single large image ─────────────────────────────────────── */}
        <section className="relative bg-ink-1 flex flex-col min-h-0">
          <div className="relative flex-1 min-h-[60vw] sm:min-h-[50vw] lg:min-h-0 bg-ink-1 overflow-hidden">
            <img
              src={offer.imageUrl}
              alt={offer.title}
              className="absolute inset-0 w-full h-full object-contain"
            />
          </div>
        </section>

        {/* ── RIGHT: detail panel + sticky CTA ────────────────────────────── */}
        <section className="relative flex flex-col bg-warm-white border-l border-warm-line min-h-0">
          {/* Header */}
          <header className="flex items-start justify-between px-5 lg:px-7 py-4 lg:py-5 border-b border-warm-line shrink-0">
            <div className="min-w-0 flex-1">
              {offer.badge && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-terracotta text-warm-white text-[10px] font-medium uppercase tracking-wide mb-2">
                  <Sparkles className="w-3 h-3" />
                  {offer.badge}
                </span>
              )}
              <h2
                id={`offer-detail-${offer.id}-title`}
                className="font-display text-2xl lg:text-3xl text-ink-1 leading-tight"
              >
                {offer.title}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="text-ink-3 hover:text-ink-1 shrink-0 ml-3 mt-1"
            >
              <X className="w-6 h-6" />
            </button>
          </header>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 lg:px-7 py-5 flex flex-col gap-5">
            {offer.description && (
              <p className="text-sm lg:text-base text-ink-2 leading-relaxed whitespace-pre-line">
                {offer.description}
              </p>
            )}
            {/* Room type pill — shown prominently between description and validity */}
            {offer.roomType && (
              <span className="self-start inline-flex items-center rounded-full bg-warm-cream border border-warm-line text-ink-2 text-sm font-medium px-3 py-1">
                Aplica a: {offer.roomType.name}
              </span>
            )}
            {validity && (
              <p className="text-xs text-ink-3">{validity}</p>
            )}
          </div>

          {/* Sticky footer CTA */}
          <footer className="px-5 lg:px-7 py-4 border-t border-warm-line shrink-0 bg-warm-white">
            {isExternal ? (
              <a
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center rounded-full bg-terracotta text-warm-white text-sm font-medium px-4 py-3 hover:bg-terracotta-deep transition-colors"
              >
                {ctaText}
              </a>
            ) : (
              <Link
                to={ctaHref}
                onClick={onClose}
                className="block w-full text-center rounded-full bg-terracotta text-warm-white text-sm font-medium px-4 py-3 hover:bg-terracotta-deep transition-colors"
              >
                {ctaText}
              </Link>
            )}
          </footer>
        </section>
      </div>
    </>
  );
}
