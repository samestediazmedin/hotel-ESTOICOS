import { useState } from 'react';
import type { Photo } from '../types';
import { HeroGalleryLightbox } from './HeroGalleryLightbox';

interface HeroGalleryProps {
  photos: Photo[];
}

export function HeroGallery({ photos }: HeroGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Phase 12: API-success-but-no-photos case — render placeholder instead of nothing
  if (photos.length === 0) {
    return (
      <div
        className="rounded-2xl overflow-hidden bg-warm-cream"
        style={{ height: '440px' }}
        aria-label="Sin fotos disponibles"
      />
    );
  }

  return (
    <>
      {/* Desktop gallery: 3-column grid, 2 rows — 4 cells visible + overlay on last */}
      <div
        className="hidden lg:grid gap-1.5 rounded-2xl overflow-hidden"
        style={{
          gridTemplateColumns: '1.4fr 1fr 1fr',
          gridTemplateRows: '220px 220px',
        }}
      >
        {/* Large left image — spans 2 rows */}
        <button type="button"
          aria-label={photos[0].alt || 'Ver foto 1'}
          onClick={() => setOpenIndex(0)}
          className="row-span-2 block w-full h-full overflow-hidden cursor-pointer"
        >
          <img
            src={photos[0].url}
            alt={photos[0].alt}
            className="w-full h-full object-cover hover:opacity-90 transition-opacity"
          />
        </button>

        {/* Top-middle */}
        {photos[1] && (
          <button type="button"
            aria-label={photos[1].alt || 'Ver foto 2'}
            onClick={() => setOpenIndex(1)}
            className="block w-full h-full overflow-hidden cursor-pointer"
          >
            <img
              src={photos[1].url}
              alt={photos[1].alt}
              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
            />
          </button>
        )}

        {/* Top-right */}
        {photos[2] && (
          <button type="button"
            aria-label={photos[2].alt || 'Ver foto 3'}
            onClick={() => setOpenIndex(2)}
            className="block w-full h-full overflow-hidden cursor-pointer"
          >
            <img
              src={photos[2].url}
              alt={photos[2].alt}
              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
            />
          </button>
        )}

        {/* Bottom-middle */}
        {photos[3] && (
          <button type="button"
            aria-label={photos[3].alt || 'Ver foto 4'}
            onClick={() => setOpenIndex(3)}
            className="block w-full h-full overflow-hidden cursor-pointer"
          >
            <img
              src={photos[3].url}
              alt={photos[3].alt}
              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
            />
          </button>
        )}

        {/* Bottom-right: overlay with "Ver las N fotos" — only when at least 4 photos exist */}
        {(photos[4] ?? photos[3]) && (
          <div className="relative w-full h-full overflow-hidden">
            <button type="button"
              aria-label={(photos[4] ?? photos[3]).alt || `Ver foto ${Math.min(5, photos.length)}`}
              onClick={() => setOpenIndex(4 < photos.length ? 4 : photos.length - 1)}
              className="block w-full h-full overflow-hidden cursor-pointer"
            >
              <img
                src={(photos[4] ?? photos[3]).url}
                alt={(photos[4] ?? photos[3]).alt}
                className="w-full h-full object-cover hover:opacity-90 transition-opacity"
              />
            </button>
            <button type="button"
              onClick={() => setOpenIndex(0)}
              className="absolute bottom-3 right-3 bg-warm-white text-ink-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-warm-line pointer-events-auto"
            >
              Ver las {photos.length} fotos
            </button>
          </div>
        )}
      </div>

      {/* Mobile gallery: 2-column grid, 2 rows — 3 cells, overlay on last */}
      <div
        className="grid lg:hidden gap-1 rounded-xl overflow-hidden"
        style={{
          gridTemplateColumns: '1.6fr 1fr',
          gridTemplateRows: '120px 120px',
        }}
      >
        {/* Large left image — spans 2 rows */}
        <button type="button"
          aria-label={photos[0].alt || 'Ver foto 1'}
          onClick={() => setOpenIndex(0)}
          className="row-span-2 block w-full h-full overflow-hidden cursor-pointer"
        >
          <img
            src={photos[0].url}
            alt={photos[0].alt}
            className="w-full h-full object-cover hover:opacity-90 transition-opacity"
          />
        </button>

        {/* Top-right */}
        {photos[1] && (
          <button type="button"
            aria-label={photos[1].alt || 'Ver foto 2'}
            onClick={() => setOpenIndex(1)}
            className="block w-full h-full overflow-hidden cursor-pointer"
          >
            <img
              src={photos[1].url}
              alt={photos[1].alt}
              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
            />
          </button>
        )}

        {/* Bottom-right: overlay — only when at least 2 photos exist */}
        {(photos[2] ?? photos[1]) && (
          <div className="relative w-full h-full overflow-hidden">
            <button type="button"
              aria-label={(photos[2] ?? photos[1]).alt || `Ver foto ${Math.min(3, photos.length)}`}
              onClick={() => setOpenIndex(2 < photos.length ? 2 : photos.length - 1)}
              className="block w-full h-full overflow-hidden cursor-pointer"
            >
              <img
                src={(photos[2] ?? photos[1]).url}
                alt={(photos[2] ?? photos[1]).alt}
                className="w-full h-full object-cover hover:opacity-90 transition-opacity"
              />
            </button>
            <button type="button"
              onClick={() => setOpenIndex(0)}
              className="absolute bottom-2 right-2 bg-warm-white text-ink-1 text-xs font-medium px-2 py-1 rounded-lg border border-warm-line pointer-events-auto"
            >
              Ver las {photos.length} fotos
            </button>
          </div>
        )}
      </div>

      {/* Lightbox — conditionally mounted so it remounts fresh each open */}
      {openIndex !== null && (
        <HeroGalleryLightbox
          photos={photos}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
