import { useQueryClient } from '@tanstack/react-query';
import { useConciergeStore } from '@/features/concierge/concierge.store';
import { useHotelInfo } from './hooks/useHotelInfo';
import { useRoomTypes } from './hooks/useRoomTypes';
import { useHotelPhotos } from './hooks/useHotelPhotos';
import { useOffers } from './hooks/useOffers';
import { useForceLightTheme } from './hooks/useForceLightTheme';
import { scrollToSection } from './utils/scrollToSection';
import { HOTEL_INFO_FALLBACK } from './data/hotel';
import { TopNav } from './components/TopNav';
import { HeroGallery } from './components/HeroGallery';
import { HotelIdentity } from './components/HotelIdentity';
import { PortalFooter } from './components/PortalFooter';
import {
  HeroGallerySkeleton,
  HotelIdentitySkeleton,
  RoomsSectionSkeleton,
} from './components/skeletons';
import {
  RoomsSection,
  ConciergeHeroBanner,
  OffersSection,
  LocationSection,
  ReviewsSection,
  ReservationWidget,
} from './components';

export function HotelHomePage() {
  useForceLightTheme();
  const queryClient = useQueryClient();

  // ─── Concierge drawer state (global via zustand — shared with PublicPortalShell FAB) ──

  const openConcierge = useConciergeStore((s) => s.openDrawer);

  // ─── Data fetching ───────────────────────────────────────────────────────

  // Phase 12 — TanStack Query hooks; TanStack deduplicates in-flight requests
  // so calling the same hook in child components adds zero network overhead.
  const infoQuery = useHotelInfo();
  const photosQuery = useHotelPhotos();
  const roomsQuery = useRoomTypes();
  const offersQuery = useOffers();

  // placeholderData guarantees data is always defined; ?? coercion is a TS safety net only
  const hotelInfo = infoQuery.data ?? HOTEL_INFO_FALLBACK;
  const photos = photosQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const offers = offersQuery.data ?? [];

  // 2026-05-28 — Ofertas section is conditional: hide when there are no active
  // offers so the homepage doesn't show an empty "Ofertas" block.
  const hasOffers = offers.length > 0;

  // Any query in error state → show inline banner (placeholderData still renders below)
  const anyError =
    infoQuery.isError ||
    photosQuery.isError ||
    roomsQuery.isError ||
    offersQuery.isError;

  const retryAll = () => {
    // Invalidate the entire 'public' query tree — covers all portal queries
    void queryClient.invalidateQueries({ queryKey: ['public'] });
  };

  return (
    <div className="hos min-h-screen bg-warm-white text-ink-1 font-body flex flex-col">
      <TopNav
        hotelName={hotelInfo.hotelName}
        onNavClick={scrollToSection}
        onConciergeClick={openConcierge}
        showOffers={hasOffers}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-12 pt-6 pb-24 lg:pb-12">
        {/* Error banner — renders above all content when any query fails */}
        {anyError && (
          <div
            role="alert"
            data-testid="portal-error-banner"
            className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-terracotta-tint border border-terracotta text-sm text-terracotta-deep"
          >
            <span className="flex-1">
              No pudimos cargar toda la información. Mostrando datos por defecto.
            </span>
            <button
              type="button"
              onClick={retryAll}
              className="underline font-medium hover:text-terracotta shrink-0"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Desktop: 2-col grid with sticky widget. Mobile: single column. */}
        <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-10">
          <div className="min-w-0 flex flex-col">
            {/* Hero + Identity */}
            <section id="inicio" className="scroll-mt-20">
              {photosQuery.isPending ? (
                <HeroGallerySkeleton />
              ) : (
                <HeroGallery photos={photos} />
              )}
              {infoQuery.isPending ? (
                <HotelIdentitySkeleton />
              ) : (
                <HotelIdentity hotelInfo={hotelInfo} />
              )}
            </section>

            {/* Above-the-fold concierge banner — primary entry point */}
            <ConciergeHeroBanner onOpenConcierge={openConcierge} />

            {/* Habitaciones */}
            <section id="habitaciones" className="scroll-mt-20 pt-8 border-t border-warm-line">
              {roomsQuery.isPending ? (
                <RoomsSectionSkeleton />
              ) : (
                <RoomsSection
                  rooms={rooms}
                  ivaContext={{
                    displayPricesWithIva: hotelInfo.displayPricesWithIva,
                    ivaRate: hotelInfo.ivaRate,
                  }}
                />
              )}
            </section>

            {/* Ofertas — only mounted when there is at least one active offer. */}
            {hasOffers && (
              <section id="ofertas" className="scroll-mt-20 pt-8 border-t border-warm-line">
                <OffersSection offers={offers} />
              </section>
            )}

            {/* Ubicación */}
            <section id="ubicacion" className="scroll-mt-20 pt-8 border-t border-warm-line">
              <LocationSection address={hotelInfo.hotelAddress} />
            </section>

            {/* Reseñas */}
            <section id="resenas" className="scroll-mt-20 pt-8 border-t border-warm-line">
              <ReviewsSection />
            </section>
          </div>

          {/* Desktop sticky reservation sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <ReservationWidget variant="desktop-sidebar" />
            </div>
          </aside>
        </div>
      </main>

      <PortalFooter hotelInfo={hotelInfo} />

      {/* Mobile fixed bottom bar */}
      <ReservationWidget variant="mobile-bar" />

      {/* ConciergeDrawer + ConciergeFab are now rendered by PublicPortalShell (wraps all public routes) */}
    </div>
  );
}
