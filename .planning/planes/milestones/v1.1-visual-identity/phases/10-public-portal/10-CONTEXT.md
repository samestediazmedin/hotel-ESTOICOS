# Phase 10: Public Portal — Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Source:** Auto-derived from Claude Design bundle (`.design-fetch/hotelos-ai/project/screens/portal.jsx`) + REQUIREMENTS.md (PUB-07..13)

<domain>
## Phase Boundary

Replace the current bare search-form-only public landing with a rich **Airbnb-style hotel landing page** that consumes the Phase 9 foundation. Includes:
- New `HotelHomePage` at route `/` (and `/booking` as alias)
- 6 in-page sections (anchor-scrolled, single route — no SPA route splitting): Hero/Identity · Habitaciones · Restaurante · Concierge · Ubicación · Reseñas
- Sticky reservation widget (desktop sidebar / mobile bottom bar)
- Restyle of `/concierge` public chat UI with warm palette

**Out of scope:**
- Backend changes — frontend `apps/web` only
- New booking logic — the existing `/booking/rooms` flow is preserved as the navigation target of the "Reservar" CTA
- Real review/rating system — reviews are hardcoded in the component (deferred to v2)
- Internal/staff screens — those belong to Phase 11
- New routes for "Restaurante" or "Ubicación" — both are anchor sections within `HotelHomePage`
- Hero image uploads / R2 integration — Phase 10 uses placeholder image URLs or static assets; real R2 hero gallery is post-v1.1
- i18n — Spanish only (matches v1.0 scope)

</domain>

<decisions>
## Implementation Decisions (locked by bundle + requirements)

### Route topology
- `/` (root) → renders `HotelHomePage` (NEW). Was previously a redirect to `/booking` showing a search form.
- `/booking` → alias for `/` (same `HotelHomePage` component) — preserves any existing inbound links.
- `/booking/rooms` → unchanged. The "Reservar" CTA in the reservation widget navigates here, preserving v1.0's room-results flow.
- `/booking/form/:roomId` → unchanged
- `/booking/confirmation/:bookingId` → unchanged
- `/concierge` → unchanged route; the inner UI (`ConciergePage.tsx` + `PublicConciergeLayout.tsx`) gets a visual restyle pass.

### Page structure — `HotelHomePage`
Single React component, single route. Six in-page sections in order:
1. **Top navigation bar** (sticky) — logo (`H` mark + "Hotel <i>Sumapaz</i>" in Instrument Serif), 5 anchor links (Inicio · Habitaciones · Restaurante · Concierge · Ubicación), star/grid icon buttons on right
2. **Hero photo gallery** — CSS Grid, 4 photos desktop (1 large left + 3 stacked right with "Ver las N fotos" overlay) / 3 photos mobile (2-col 2-row collapsed)
3. **Hotel identity block** — `<h1>Hotel <i>Sumapaz</i></h1>` (Instrument Serif italic on second word — bundle pattern), rating + reseñas count + location pills (`hos-pill` style: warm-paper bg, ink-2 text), tag list (Hotel boutique · 42 habitaciones · 4 pisos · Desayuno incluido), description paragraph
4. **Habitaciones section** (id="habitaciones") — 4 room cards (Doble Estándar · Doble Deluxe · Familiar · Suite). Each card: thumbnail, type name, capacity, price/noche, optional badge ("Más económica" / "Mejor valor"). Highlighted card uses `terracotta-tint` bg + 1.5px terracotta border. `Mejor valor` card has highlight=true. **Data source**: hardcoded for v1.1 (real `roomTypes` API integration is post-v1.1).
5. **Concierge section** (id="concierge") — preview/teaser card linking to `/concierge`. Shows mascot/icon + "Pregunta lo que necesites" + CTA button "Abrir Concierge IA"
6. **Restaurante section** (id="restaurante") — 2-column block: image left, "Restaurante Sumapaz" headline (Instrument Serif) + description + hours + CTA. Anchor-only, no real menu data.
7. **Ubicación section** (id="ubicacion") — embedded static map image (placeholder) + address (`system_config.address` if available, else hardcoded "La Candelaria, Bogotá") + nearby landmarks list
8. **Reseñas section** (id="resenas") — aggregated `4.84 ★` + `318 reseñas`, grid of 4-5 review cards (avatar circle + name + date + 5-star + comment text). All hardcoded in v1.1.
9. **Footer** — minimal: hotel name + address + phone + redes sociales

### Reservation widget
- **Desktop (≥1024px)**: sticky right sidebar starting from hero level (`position: sticky; top: 80px`), inside a 2-column grid where left=8/12 cols + right widget=4/12 cols
- **Mobile (<1024px)**: fixed bottom bar (`position: fixed; bottom: 0`), full-width, 64-72px tall, with date/guest summary + bold "Reservar" CTA on right
- **Content**: header "Llegada / Salida" inputs (`react-day-picker` v10 range picker triggered by click), guest counter (`-` / `+` with adultos · niños), price-per-night display (from selected room or first room default), "Reservar" button — primary terracotta — navigates to `/booking/rooms?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&adults=N`
- **State**: `useReservationDraft` hook stores draft in zustand or URL query params; pre-fills the form on `/booking/rooms` if widget already had values
- **No price calculation in v1.1** — show "Desde $280k / noche" using cheapest room (hardcoded for v1.1)

### Photo gallery
- **Desktop**: 4 photos in `grid-template-columns: 2fr 1fr 1fr` × 2 rows. First photo spans 2 rows on left, 3 thumbnails on right (top-right + bottom-right + middle-right with "+N" overlay)
- **Mobile**: 3 photos in `grid-template-columns: 1.6fr 1fr` × 2 rows. First photo spans 2 rows, 2 thumbnails right.
- **"Ver las N fotos" overlay**: positioned `bottom: 12px; right: 12px` on the last thumbnail, warm-white bg, rounded 8px, click opens a lightbox/modal (deferred to v1.2 — click handler is a no-op in v1.1 OR navigates to a `/fotos` placeholder route)
- **Image sources**: hardcoded URLs from Unsplash or local `apps/web/public/hotel-photos/` directory (4-5 placeholder JPGs of Bogotá-style boutique hotel). Real R2 integration is post-v1.1.

### Top navigation behavior
- **Sticky** at top (`position: sticky; top: 0; z-index: 50`)
- **5 anchor links**: clicking scrolls smoothly (`scrollIntoView({behavior: 'smooth'})`) to section by `id`. No route changes.
- **"Inicio"** scrolls to top of page (`window.scrollTo({top: 0, behavior: 'smooth'})`)
- **"Concierge"** is the only link that navigates to a different route (`/concierge`) instead of anchor-scrolling
- **Mobile (<768px)**: nav collapses to hamburger menu (drawer from right) OR a horizontal scroll bar with the same items. Pick whichever the bundle suggests — bundle's mobile nav (lines 23-32 of portal.jsx) is just logo + 2 icon buttons (star, grid). Adopt this: on mobile, nav shows only logo + icon buttons; anchor section navigation via scroll.

### Concierge restyle (PUB-13)
- **Files**: `apps/web/src/features/concierge/ConciergePage.tsx` + `apps/web/src/layouts/PublicConciergeLayout.tsx` + any child components (VenueCard, ChatBubble, etc.)
- **Background**: `var(--warm-paper)` page background
- **Message bubbles**: user bubble = `var(--terracotta)` bg + `var(--warm-white)` text; assistant bubble = `var(--warm-white)` bg + `var(--ink-1)` text + `var(--warm-line)` border
- **Send button**: terracotta variant (already exists in Phase 9's Button refactor)
- **VenueCard titles**: Instrument Serif (`.font-display` or `font-display` utility class)
- **No logic changes** — only visual restyle. The chat streaming, SSE wiring, RAG search all untouched.

### Responsive breakpoints
- **Mobile**: <768px
- **Tablet**: 768-1024px
- **Desktop**: ≥1024px
- **Test viewports**: 360px (Android), 768px (iPad portrait), 1280px (laptop) — must render without horizontal overflow at all three
- **CSS strategy**: Tailwind responsive prefixes (`md:`, `lg:`) — same React tree, CSS-driven

### Data sources (v1.1)
- **Hotel name**: `system_config.hotelName` via existing `useSystemConfig` hook (already exists in v1.0). Fall back to "Hotel Sumapaz" if undefined.
- **Address**: `system_config.address` if available, else hardcoded "La Candelaria, Bogotá"
- **Photos**: static URLs (Unsplash or `apps/web/public/`)
- **Room types**: hardcoded in component for v1.1 (4 types). Wire to real `useRoomTypes()` query in v1.2.
- **Reviews**: hardcoded in component (4-5 reviews with realistic Spanish names + dates + comments)
- **Rating**: hardcoded `4.84 · 318 reseñas`

### Verification commands
1. `cd apps/web && pnpm run typecheck` → exits 0
2. `rg "#[0-9a-fA-F]{3,6}" apps/web/src/features/public-booking/ apps/web/src/features/concierge/ --glob "*.tsx"` → zero hex matches (token utilities only)
3. Playwright/manual: `/` renders `HotelHomePage`, 6 sections visible at 1280px viewport
4. Playwright/manual: 360px viewport → reservation widget is fixed bottom bar, no horizontal overflow
5. Playwright/manual: clicking nav "Habitaciones" scrolls to id="habitaciones"
6. Vitest smoke: `HotelHomePage.test.tsx` renders without console errors, navigation has 5 items, all 6 section ids present in DOM

### Claude's Discretion
- Exact image URLs (Unsplash collection link vs local public/ folder)
- Whether mobile nav is hamburger drawer or simplified icon-only (bundle says icon-only on mobile)
- Lightbox vs `/fotos` no-op for "Ver las N fotos" click
- Exact wording of placeholder review comments (4-5 needed)
- Whether `useReservationDraft` uses zustand or URL params (URL params preferred — survives refresh, shareable)
- Footer content (minimal info, design Discretion)

</decisions>

<canonical_refs>
## Canonical References

### Design source (locked — bundle is verbatim source of truth)
- `.design-fetch/hotelos-ai/project/screens/portal.jsx` — 615 lines. Mobile section (lines 5-200), Desktop section (lines 200-615). Both must render the same content; only layout differs.
- `.design-fetch/hotelos-ai/project/tokens.jsx` — token reference; Phase 9 already plumbed these — use the existing utility classes
- `.design-fetch/hotelos-ai/chats/chat1.md` — design rationale (mobile-first reasoning, Airbnb comparison, why warm palette)
- `.planning/phases/09-design-system-foundation/09-01-SUMMARY.md` through `09-04-SUMMARY.md` — token vocabulary, primitive APIs, useTheme hook usage

### Project requirements
- `.planning/REQUIREMENTS.md` — PUB-07..13 (hero gallery, photo grid, nav, reservation widget, reseñas, responsive, concierge restyle)
- `.planning/ROADMAP.md` — Phase 10 section: 6 success criteria
- `.planning/PROJECT.md` — `system_config.hotelName` is read from existing API (already implemented in v1.0)

### Existing code (target files)
- `apps/web/src/router.tsx` — wire new route `/` → `HotelHomePage`, ensure `/booking` aliases. Currently `/` likely redirects to `/booking` showing search form.
- `apps/web/src/features/public-booking/BookingPage.tsx` — likely the current search-form page; either repurpose into `HotelHomePage` OR keep for `/booking/rooms` results and create new `HotelHomePage.tsx`
- `apps/web/src/features/public-booking/BookingResultsPage.tsx` — preserved (Reservar CTA target)
- `apps/web/src/features/concierge/ConciergePage.tsx` — restyle target (PUB-13)
- `apps/web/src/layouts/PublicConciergeLayout.tsx` — restyle target (PUB-13)
- `apps/web/src/hooks/useSystemConfig.ts` (or similar) — existing hook to read hotel name/address

### Phase 9 foundation (consume — do not modify)
- `apps/web/src/components/ui/button.tsx` — Button with `terracotta` variant
- `apps/web/src/components/ui/card.tsx` — Card primitive
- `apps/web/src/components/ui/input.tsx` — Input primitive
- `apps/web/src/components/ui/badge.tsx` — Badge primitive
- `apps/web/src/components/ui/status-pill.tsx` — not used in Phase 10 (internal screens only)
- `apps/web/src/components/ui/theme-toggle.tsx` — NOT mounted on public portal (theme toggle is staff-only; public portal is always light mode for v1.1)
- `apps/web/src/styles/globals.css` — token vocabulary

### Dependencies (already installed v1.0)
- `react-day-picker` v10 — confirmed in CLAUDE.md stack table
- `lucide-react` — icons (Calendar, Users, Minus, Plus, Star, MapPin, etc.)
- `class-variance-authority` + `tailwind-merge` + `clsx` — variant management
- `@tanstack/react-query` v5 — used by `useSystemConfig`

</canonical_refs>

<specifics>
## Specific Ideas

### Reservation widget URL params
Navigate to `/booking/rooms?checkIn=2026-06-14&checkOut=2026-06-18&guests=2` on "Reservar" click. `BookingResultsPage` reads params via `useSearchParams()` — confirm Phase 7/v1.0 implementation; if not, the planner adds the param-reader logic as a deviation note.

### `react-day-picker` v10 config
- `mode="range"`
- `numberOfMonths={2}` on desktop, `numberOfMonths={1}` on mobile (responsive prop derived from `useMediaQuery`)
- `disabled={{ before: new Date() }}` — can't book past dates
- `locale={es}` — Spanish day names
- Custom day cells styled with token utilities

### Hardcoded placeholder data files
Create `apps/web/src/features/public-portal/data/` directory:
- `hotel.ts` — `{ name, tagline, description, rating, reviewCount, address, tags: [...] }`
- `roomTypes.ts` — `RoomTypeCard[]` with 4 entries
- `reviews.ts` — `Review[]` with 5 entries
- `photos.ts` — `{ url, alt }[]` with 4-5 entries

This keeps all v1.1 hardcoded content in one place, easy to wire to API in v1.2.

### Hotel name display
Bundle uses "Hotel <i>Sumapaz</i>" (Sumapaz in italic). Apply via JSX:
```tsx
<h1 className="font-display text-4xl">
  Hotel <i className="italic">{hotelName.replace('Hotel ', '')}</i>
</h1>
```
If `hotelName` doesn't start with "Hotel ", just render verbatim italic.

### Anchor scroll utility
Single `scrollToSection(id: string)` helper in the page component:
```tsx
const scrollToSection = (id: string) => {
  if (id === 'inicio') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
```

### Photo placeholder strategy
Pre-download 5 Unsplash images of Bogotá boutique hotels to `apps/web/public/hotel-photos/` so the page works offline in dev:
- `fachada.jpg`, `lobby.jpg`, `suite.jpg`, `restaurante.jpg`, `terraza.jpg`
- ~50-100KB each, JPEG, max 1600px width

</specifics>

<deferred>
## Deferred Ideas

- **Real room types from API** — wire `useRoomTypes()` query in v1.2; v1.1 hardcoded
- **Photo gallery lightbox** — modal viewer with prev/next; v1.1 click is no-op or `/fotos` placeholder
- **Real review system** — DB schema, moderation, post-stay email; v1.1 hardcoded reviews
- **Restaurante menu page** — full menu rendering; v1.1 only anchor section with description + hours
- **Map embed (Leaflet/Google)** — v1.1 uses static image; v1.2 interactive
- **i18n (ES/EN toggle)** — v1.2 milestone
- **Public theme toggle** — `/` and `/concierge` are light-mode only for v1.1; dark mode is staff-only via Phase 11
- **R2 hero photos** — admin uploads; v1.1 uses static public/ files
- **Booking widget price calculation** — show real per-night price after date range + guest count; v1.1 shows "Desde $X / noche" from cheapest hardcoded room
- **A/B test infrastructure for landing variants** — out of v1.1 scope

</deferred>

---

*Phase: 10-public-portal*
*Context gathered: 2026-05-17 — auto-derived from Claude Design bundle*
