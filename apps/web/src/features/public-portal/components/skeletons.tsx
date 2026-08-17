/**
 * Phase 12 — Skeleton loaders for public portal sections.
 *
 * Pattern: bg-warm-cream + animate-pulse (Phase 9 tokens).
 * No hex, no Tailwind palette colors.
 *
 * Each skeleton mirrors the layout of its real component so the
 * transition from loading → loaded has minimal visual shift.
 */

/**
 * HeroGallerySkeleton
 *
 * Desktop: 3-column 2-row grid (mirrors HeroGallery: gridTemplateColumns 1.4fr 1fr 1fr,
 * gridTemplateRows 220px 220px). Large cell spans 2 rows.
 * Mobile: 2-column 2-row grid (1.6fr 1fr, 120px 120px). Large cell spans 2 rows.
 */
export function HeroGallerySkeleton() {
  return (
    <>
      {/* Desktop skeleton */}
      <div
        className="hidden lg:grid gap-1.5 rounded-2xl overflow-hidden animate-pulse"
        style={{
          gridTemplateColumns: '1.4fr 1fr 1fr',
          gridTemplateRows: '220px 220px',
        }}
        data-testid="hero-gallery-skeleton"
        aria-busy="true"
        aria-label="Cargando galería de fotos"
      >
        <div className="row-span-2 bg-warm-cream" />
        <div className="bg-warm-cream" />
        <div className="bg-warm-cream" />
        <div className="bg-warm-cream" />
        <div className="bg-warm-cream" />
      </div>

      {/* Mobile skeleton */}
      <div
        className="grid lg:hidden gap-1 rounded-xl overflow-hidden animate-pulse"
        style={{
          gridTemplateColumns: '1.6fr 1fr',
          gridTemplateRows: '120px 120px',
        }}
        aria-busy="true"
        aria-label="Cargando galería de fotos"
      >
        <div className="row-span-2 bg-warm-cream" />
        <div className="bg-warm-cream" />
        <div className="bg-warm-cream" />
      </div>
    </>
  );
}

/**
 * HotelIdentitySkeleton
 *
 * Mirrors HotelIdentity layout: h1 title, rating row, tags/pills row, description paragraph.
 */
export function HotelIdentitySkeleton() {
  return (
    <div
      className="pt-6 pb-8 flex flex-col gap-4 animate-pulse"
      data-testid="hotel-identity-skeleton"
      aria-busy="true"
      aria-label="Cargando información del hotel"
    >
      {/* H1 placeholder */}
      <div className="h-10 w-64 bg-warm-cream rounded" />

      {/* Rating row placeholder */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 bg-warm-cream rounded-full" />
        <div className="h-4 w-10 bg-warm-cream rounded" />
        <div className="h-4 w-32 bg-warm-cream rounded" />
        <div className="h-4 w-4 bg-warm-cream rounded-full" />
        <div className="h-4 w-40 bg-warm-cream rounded" />
      </div>

      {/* Tags / pills row */}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-6 w-24 bg-warm-cream rounded-full" />
        ))}
      </div>

      {/* Description placeholder */}
      <div className="flex flex-col gap-2 max-w-2xl">
        <div className="h-4 w-full bg-warm-cream rounded" />
        <div className="h-4 w-full bg-warm-cream rounded" />
        <div className="h-4 w-3/4 bg-warm-cream rounded" />
      </div>
    </div>
  );
}

/**
 * ReviewsSectionSkeleton — Phase 14
 *
 * Mirrors ReviewsSection layout:
 *   - Header row: star icon + rating number + count label
 *   - 3 review card placeholders (1-col mobile / 2-col md / 3-col lg)
 *     Each card: avatar circle + name + date + stars row + comment lines
 *
 * Only shown on first load (isPending with no placeholderData yet).
 */
export function ReviewsSectionSkeleton() {
  return (
    <section
      className="scroll-mt-20 animate-pulse"
      data-testid="reviews-section-skeleton"
      aria-busy="true"
      aria-label="Cargando reseñas"
    >
      {/* Header: star + rating + count */}
      <div className="flex items-baseline gap-3 mb-6">
        <div className="w-6 h-6 rounded-full bg-warm-cream shrink-0" />
        <div className="h-9 w-16 bg-warm-cream rounded" />
        <div className="h-5 w-28 bg-warm-cream rounded" />
      </div>

      {/* Card grid: 1-col / 2-col md / 3-col lg */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-warm-line bg-warm-white p-5 flex flex-col gap-3"
          >
            {/* Avatar + name + date row */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-warm-cream shrink-0" />
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <div className="h-3.5 w-24 bg-warm-cream rounded" />
                <div className="h-3 w-16 bg-warm-cream rounded" />
              </div>
              {/* Stars placeholder */}
              <div className="flex items-center gap-0.5 shrink-0">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className="w-3.5 h-3.5 rounded-sm bg-warm-cream" />
                ))}
              </div>
            </div>

            {/* Comment lines */}
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-full bg-warm-cream rounded" />
              <div className="h-3 w-full bg-warm-cream rounded" />
              <div className="h-3 w-2/3 bg-warm-cream rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * RoomsSectionSkeleton
 *
 * Mirrors RoomsSection: h2 title + 4-card grid (md:grid-cols-2).
 * Each card: thumbnail placeholder + 3 text line placeholders.
 */
export function RoomsSectionSkeleton() {
  return (
    <section className="scroll-mt-20">
      {/* Section title placeholder */}
      <div className="h-8 w-40 bg-warm-cream rounded animate-pulse mb-6" />

      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 animate-pulse"
        data-testid="rooms-section-skeleton"
        aria-busy="true"
        aria-label="Cargando habitaciones"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-warm-line bg-warm-white p-4 flex gap-4"
          >
            {/* Thumbnail placeholder */}
            <div className="h-24 w-24 lg:h-28 lg:w-28 bg-warm-cream rounded-xl shrink-0" />

            {/* Text lines placeholder */}
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="h-5 w-32 bg-warm-cream rounded" />
              <div className="h-3 w-20 bg-warm-cream rounded" />
              <div className="h-4 w-full bg-warm-cream rounded" />
              <div className="h-5 w-16 bg-warm-cream rounded mt-auto" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
