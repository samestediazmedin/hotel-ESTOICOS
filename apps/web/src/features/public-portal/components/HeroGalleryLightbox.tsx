import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Photo } from '../types';

interface HeroGalleryLightboxProps {
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
}

/**
 * HeroGalleryLightbox — full-screen photo viewer for the homepage hero gallery.
 *
 * Design mirrors the gallery portion of RoomTypeDetailDrawer:
 *  - Dark bg-ink-1 backdrop, image rendered with object-contain so portrait
 *    and landscape photos never crop.
 *  - Prev / next chevrons on either side of the image.
 *  - "current / total" counter badge (bottom-right of image).
 *  - Thumbnail strip along the bottom.
 *  - X close button (top-right). Backdrop click, ESC key also close.
 *  - Body scroll locked while open (restored on unmount).
 *  - Opens at the provided startIndex; wrap-around navigation.
 */
export function HeroGalleryLightbox({ photos, startIndex, onClose }: HeroGalleryLightboxProps) {
  const [activeIdx, setActiveIdx] = useState(startIndex);

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

  const next = () => setActiveIdx((i) => (i + 1) % photos.length);
  const prev = () => setActiveIdx((i) => (i - 1 + photos.length) % photos.length);

  const heroPhoto = photos[activeIdx];

  return (
    <>
      {/* Backdrop */}
      <button type="button"
        aria-label="Cerrar"
        className="fixed inset-0 z-40 bg-ink-1/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Lightbox container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Galería de fotos"
        className="fixed inset-0 z-50 flex flex-col bg-ink-1"
      >
        {/* Top bar: counter (left) + close button (right) */}
        <header className="flex items-center justify-between px-4 py-3 shrink-0">
          <span className="text-warm-white/70 text-sm font-mono">
            {activeIdx + 1} / {photos.length}
          </span>
          <button type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="text-warm-white/70 hover:text-warm-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </header>

        {/* Hero image area — fills remaining vertical space */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <img
            src={heroPhoto.url}
            alt={heroPhoto.alt}
            className="absolute inset-0 w-full h-full object-contain"
          />

          {photos.length > 1 && (
            <>
              <button type="button"
                onClick={prev}
                aria-label="Foto anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-warm-white/90 hover:bg-warm-white rounded-full p-2.5 shadow-md transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-ink-1" />
              </button>
              <button type="button"
                onClick={next}
                aria-label="Foto siguiente"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-warm-white/90 hover:bg-warm-white rounded-full p-2.5 shadow-md transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-ink-1" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip — only when there are 2+ photos */}
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-3 bg-ink-1/95 shrink-0">
            {photos.map((p, i) => (
              <button type="button"
                key={p.url}
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
      </div>
    </>
  );
}
