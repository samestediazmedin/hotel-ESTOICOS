import { useEffect, useState } from 'react';
import { X, Users, BedDouble, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { RoomTypeCard } from '../types';
import type { IvaDisplayContext } from '../utils/displayPrice';
import { formatRoomPrice, formatCOP } from '../utils/displayPrice';
import { useReservationUiStore } from '../stores/reservationUiStore';

interface RoomTypeDetailDrawerProps {
  room: RoomTypeCard;
  ivaContext: IvaDisplayContext;
  onClose: () => void;
}

/**
 * RoomTypeDetailDrawer — full-screen detail modal with split layout.
 *
 * 2026-05-28 refactor: the previous compact right-side drawer wasn't giving
 * the gallery enough visual weight. New layout:
 *  - Desktop (lg+): two columns
 *      LEFT (60%): hero gallery — large image, chevron nav, thumb strip
 *      RIGHT (40%): scrollable info panel with sticky CTA footer
 *  - Mobile/tablet: stacked column — image on top, info below
 *
 * Behaviours preserved from the previous drawer:
 *  - ESC, backdrop click, and X button all close
 *  - Body scroll locked while open
 *  - Component remounts per open → activeIdx resets
 *  - Same prop API (room, onClose) so the homepage call site is untouched
 */
export function RoomTypeDetailDrawer({ room, ivaContext, onClose }: RoomTypeDetailDrawerProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const requestDatePicker = useReservationUiStore((s) => s.requestDatePicker);

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

  const hasPhotos = room.photos.length > 0;
  const heroPhoto = hasPhotos ? room.photos[activeIdx] : null;

  const next = () => setActiveIdx((i) => (i + 1) % room.photos.length);
  const prev = () =>
    setActiveIdx((i) => (i - 1 + room.photos.length) % room.photos.length);

  const { amount: displayAmount, ivaIncluded } = formatRoomPrice(room.basePrice, ivaContext);

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
        aria-labelledby={`room-type-detail-${room.id}-title`}
        className="fixed inset-0 z-50 flex flex-col lg:grid lg:grid-cols-[3fr_2fr] bg-warm-white"
      >
        {/* ── LEFT: large gallery ─────────────────────────────────────────── */}
        <section className="relative bg-ink-1 flex flex-col min-h-0">
          {/* Hero image area — fills the column */}
          <div className="relative flex-1 min-h-[60vw] sm:min-h-[50vw] lg:min-h-0 bg-ink-1 overflow-hidden">
            {heroPhoto ? (
              <>
                <img
                  src={heroPhoto.url}
                  alt={heroPhoto.alt}
                  className="absolute inset-0 w-full h-full object-contain"
                />
                {room.photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={prev}
                      aria-label="Foto anterior"
                      className="absolute left-3 lg:left-5 top-1/2 -translate-y-1/2 bg-warm-white/90 hover:bg-warm-white rounded-full p-2.5 shadow-md transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-ink-1" />
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      aria-label="Foto siguiente"
                      className="absolute right-3 lg:right-5 top-1/2 -translate-y-1/2 bg-warm-white/90 hover:bg-warm-white rounded-full p-2.5 shadow-md transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-ink-1" />
                    </button>
                    <span className="absolute bottom-4 right-4 bg-ink-1/75 text-warm-white text-xs font-mono px-3 py-1 rounded-full">
                      {activeIdx + 1} / {room.photos.length}
                    </span>
                  </>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-warm-cream text-sm">
                Sin fotos aún
              </div>
            )}
          </div>

          {/* Thumbnail strip — only when there are 2+ photos */}
          {room.photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3 bg-ink-1/95 shrink-0">
              {room.photos.map((p, i) => (
                <button
                  key={p.url}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={
                    'shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-opacity ' +
                    (i === activeIdx
                      ? 'border-terracotta opacity-100'
                      : 'border-transparent opacity-70 hover:opacity-100')
                  }
                  aria-label={`Ver foto ${i + 1}`}
                >
                  <img src={p.url} alt={p.alt} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── RIGHT: detail panel + sticky CTA ────────────────────────────── */}
        <section className="relative flex flex-col bg-warm-white border-l border-warm-line min-h-0">
          {/* Header */}
          <header className="flex items-start justify-between px-5 lg:px-7 py-4 lg:py-5 border-b border-warm-line shrink-0">
            <div className="min-w-0 flex-1">
              {room.badge && (
                <span
                  className={
                    room.badge === 'Mejor valor'
                      ? 'inline-block px-2 py-0.5 rounded-full bg-terracotta-soft text-terracotta-deep text-[10px] font-medium uppercase tracking-wide mb-2'
                      : 'inline-block px-2 py-0.5 rounded-full bg-mustard text-ink-1 text-[10px] font-medium uppercase tracking-wide mb-2'
                  }
                >
                  {room.badge}
                </span>
              )}
              <h2
                id={`room-type-detail-${room.id}-title`}
                className="font-display text-2xl lg:text-3xl text-ink-1 leading-tight truncate"
              >
                {room.name}
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
            {/* Quick facts */}
            <div className="flex items-center gap-4 text-sm text-ink-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-terracotta" />
                <span>
                  Hasta {room.capacity} {room.capacity === 1 ? 'persona' : 'personas'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <BedDouble className="w-4 h-4 text-terracotta" />
                <span>{room.name}</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm lg:text-base text-ink-2 leading-relaxed whitespace-pre-line">
              {room.description}
            </p>

            {/* Amenities */}
            {room.amenities && room.amenities.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-base text-ink-1">Amenidades</h3>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm text-ink-2">
                  {room.amenities.map((a) => (
                    <li key={a} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-terracotta shrink-0" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Price */}
            <div className="border-t border-warm-line pt-4 mt-2">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl lg:text-3xl text-ink-1">
                  {formatCOP(displayAmount)}
                </span>
                <span className="text-sm text-ink-3">/ noche</span>
              </div>
              {ivaIncluded && (
                <p className="text-xs text-ink-4 mt-0.5">IVA incluido</p>
              )}
            </div>
          </div>

          {/* Sticky footer CTA */}
          <footer className="px-5 lg:px-7 py-4 border-t border-warm-line shrink-0 bg-warm-white">
            <button
              type="button"
              onClick={() => {
                onClose();
                requestDatePicker();
              }}
              className="block w-full text-center rounded-full bg-terracotta text-warm-white text-sm font-medium px-4 py-3 hover:bg-terracotta-deep transition-colors"
            >
              Reservar {room.name}
            </button>
          </footer>
        </section>
      </div>
    </>
  );
}
