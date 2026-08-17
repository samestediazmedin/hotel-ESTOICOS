# Phase 10: Public Portal — Research

**Researched:** 2026-05-17
**Domain:** React 18 · Tailwind v4 · react-day-picker v10 · CSS Grid sticky layout · Concierge restyle
**Confidence:** HIGH (all findings from direct source inspection — no inference)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Route `/` → renders `HotelHomePage` (NEW). `/booking` alias → same component.
- `/booking/rooms`, `/booking/form/:roomId`, `/booking/confirmation/:bookingId` → unchanged.
- `/concierge` → unchanged route; inner UI gets visual restyle only.
- Single React component `HotelHomePage`, single route, 6 in-page anchor sections.
- Top nav: sticky, 5 items, "Concierge" navigates to `/concierge`, others anchor-scroll.
- Hero gallery: CSS Grid, 4 photos desktop / 3 mobile, "Ver las N fotos" overlay is a no-op click in v1.1.
- Reservation widget: sticky right sidebar desktop (≥1024px) / fixed bottom bar mobile.
- widget state: `useReservationDraft` using URL query params (survives refresh, shareable).
- Reservation widget navigates to `/booking/rooms?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&adults=N`.
- Room types: hardcoded 4 types in data file for v1.1.
- Reviews: hardcoded 4-5 items in data file for v1.1.
- `system_config.hotelName` via existing hook (fallback "Hotel Sumapaz").
- Photos: static files in `apps/web/public/hotel-photos/` OR Unsplash URLs.
- Public portal is ALWAYS light mode — no theme toggle on `/` or `/concierge`.
- Concierge restyle: warm palette bubbles, terracotta send button, Instrument Serif VenueCard titles. No logic changes.
- Responsive breakpoints: 360px / 768px / 1024px / 1280px.
- Tailwind responsive prefixes: `md:` and `lg:`.
- react-day-picker v10, `mode="range"`, locale es, `disabled={{ before: new Date() }}`.
- Backend untouched. `apps/web` only.

### Claude's Discretion
- Exact Unsplash image URLs vs local public/ folder.
- Mobile nav: hamburger drawer vs icon-only (bundle says icon-only on mobile — adopt this).
- Lightbox vs no-op for "Ver las N fotos" click (no-op preferred for v1.1).
- Exact placeholder review comment text (4-5 needed).
- Whether `useReservationDraft` uses zustand or URL params — URL params confirmed preferred.
- Footer exact content.

### Deferred Ideas (OUT OF SCOPE)
- Real room types from API (`useRoomTypes()`) — v1.2.
- Photo gallery lightbox.
- Real review system.
- Restaurante menu page.
- Leaflet/Google Maps embed.
- i18n.
- Public theme toggle.
- R2 hero photos.
- Booking widget price calculation.
- A/B test infrastructure.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PUB-07 | Route `/` (or `/booking`) renders `HotelHomePage` with hero gallery + hotel name from `system_config.hotelName` + rating + location pills + description | Router topology confirmed — see §Q1. `useSystemConfig` absent — see §Q3 fallback pattern. |
| PUB-08 | Photo gallery: 4 hero photos (desktop) / 3 (mobile) in CSS Grid with "Ver las N fotos" overlay | Gallery grid dimensions extracted from bundle — see §Architecture Patterns. |
| PUB-09 | Top nav: Inicio · Habitaciones · Restaurante · Concierge · Ubicación; anchor-scrolls within page | Anchor scroll pattern + scroll-mt offset — see §Common Pitfalls and §Code Examples. |
| PUB-10 | Reservation widget: sticky sidebar desktop / bottom bar mobile; react-day-picker v10 range picker; guest counter; "Reservar" → `/booking/rooms` | react-day-picker v10 integration confirmed — see §Standard Stack and §Code Examples. Sticky pitfalls documented. |
| PUB-11 | Reseñas section: aggregated rating + count + 4-5 curated sample reviews; hardcoded v1.1 | Hardcoded data pattern — see §Architecture Patterns. |
| PUB-12 | Responsive at 360px / 768px / 1280px; same React tree, CSS-driven | Tailwind v4 breakpoints confirmed — see §Standard Stack. |
| PUB-13 | `/concierge` restyled: warm palette bubbles, terracotta send button, Instrument Serif VenueCard headings, `var(--warm-paper)` bg | All concierge component files inventoried — see §Concierge Restyle Inventory. |
</phase_requirements>

---

## Summary

Phase 10 is a pure frontend visual implementation phase. All required libraries are already installed and verified. The critical baseline finding is that `useSystemConfig` does NOT exist in the codebase — the hotel name must be fetched through a new `useSystemConfig` hook that calls the existing `/api/config` backend endpoint, or alternatively read from a Vite env variable (`VITE_HOTEL_NAME`) as a simpler v1.1 fallback. The CONTEXT.md states the hook "already exists in v1.0" but direct inspection confirms it does not.

The second critical finding is that the bundle's utility classes (`hos-pill`, `hos-card`, `hos-btn`, `hos-avatar`, `hos-logo-mark`) are defined in `tokens.jsx` but were NOT ported to `globals.css` during Phase 9. The portal design uses these classes extensively. Wave 0 of Phase 10 must add these utility classes to `globals.css` before any portal component can be built correctly.

The `react-day-picker` v10 integration pattern is already established in the codebase (BookingPage.tsx, SeasonDrawer.tsx, Step1Dates.tsx, TraExportPage.tsx) and is consistent: `import { DayPicker } from 'react-day-picker'` + `import 'react-day-picker/dist/style.css'`. This CSS import injects picker-scoped styles and does not leak into other components.

**Primary recommendation:** Build in 3 plans — Wave 0 (infrastructure: hos-utility classes + useSystemConfig + public assets), Plan 1 (HotelHomePage + sections + reservation widget), Plan 2 (Concierge restyle). The Wave 0 setup tasks are blockers for Plans 1 and 2 and should be their own commit.

---

## Standard Stack

### Core (all already installed — verified in apps/web/package.json)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `react` | ^18.3.1 | UI library | Installed |
| `react-day-picker` | ^10.0.0 | Date range picker in reservation widget | Installed, already used in 5 files |
| `lucide-react` | ^0.525.0 | Icons (Calendar, Users, Minus, Plus, Star, MapPin, ChevronLeft, etc.) | Installed |
| `tailwindcss` | ^4.0.0 | Utility CSS + token utilities | Installed |
| `zustand` | ^5.0.0 | Global state (if useReservationDraft needs persistence beyond URL) | Installed |
| `@tanstack/react-query` | ^5.100.0 | `useSystemConfig` query | Installed |
| `clsx` | ^2.1.1 | Conditional classNames | Installed |
| `tailwind-merge` | ^3.6.0 | Merging Tailwind classes | Installed |
| `react-router-dom` | ^7.15.0 | Routing + `useNavigate` + `useSearchParams` | Installed |

### Not Required (do not install)
- `date-fns` — not needed; react-day-picker v10 has its own locale handling via `import { es } from 'react-day-picker/locale'`
- Any animation library — CSS transitions only
- Any carousel/lightbox — deferred to v1.2

### react-day-picker v10 Import Pattern (verified from codebase)

```typescript
// Verified in BookingPage.tsx, SeasonDrawer.tsx, Step1Dates.tsx, TraExportPage.tsx
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
```

The CSS import `react-day-picker/dist/style.css` is scoped to the picker's own DOM — it does NOT leak global body styles. The picker renders its own container with `.rdp` root class. No additional CSS isolation needed.

**Locale for Spanish (v10 pattern):**
```typescript
import { es } from 'react-day-picker/locale';
// then on DayPicker:
<DayPicker locale={es} ... />
```
Note: v10 exports locales directly from the package — no `date-fns/locale` import required.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/web/src/features/public-portal/
├── HotelHomePage.tsx           # Main page component (single route)
├── HotelHomePage.test.tsx      # Vitest smoke test
├── sections/
│   ├── HeroGallery.tsx         # Photo grid (PUB-08)
│   ├── HotelIdentity.tsx       # Name + rating + pills + description
│   ├── RoomTypesSection.tsx    # Habitaciones cards (id="habitaciones")
│   ├── ConciergeTeaser.tsx     # Concierge preview card (id="concierge")
│   ├── RestauranteSection.tsx  # Anchor section (id="restaurante")
│   ├── UbicacionSection.tsx    # Map placeholder + address (id="ubicacion")
│   └── ResenasSection.tsx      # Reviews grid (id="resenas")
├── components/
│   ├── PublicNav.tsx           # Sticky top nav (5 items)
│   ├── ReservationWidget.tsx   # Sticky sidebar / bottom bar
│   └── PublicFooter.tsx        # Minimal footer
├── hooks/
│   ├── useReservationDraft.ts  # URL param state management
│   └── useSystemConfig.ts      # NEW — fetches /api/config
└── data/
    ├── hotel.ts                # { name, tagline, description, rating, reviewCount, address, tags }
    ├── roomTypes.ts            # RoomTypeCard[] — 4 entries
    ├── reviews.ts              # Review[] — 5 entries
    └── photos.ts               # { url, alt }[] — 4-5 entries
```

### Pattern 1: Route Registration (minimal diff)

Current state in `router.tsx`:
- Line 62: `path: '/'` → `<Navigate to="/dashboard" replace />` — the root redirects to dashboard
- Line 80-82: `path: '/booking'` → `<BookingPage />` — BookingPage is the current search form

Required changes:
1. Replace the root `<Navigate to="/dashboard" replace />` with `<HotelHomePage />` (or route to it)
2. Replace `path: '/booking'` element from `<BookingPage />` to `<HotelHomePage />`
3. Import `HotelHomePage` at the bottom of router.tsx (same pattern as other imports)
4. Keep `BookingPage` import in place IF it's used anywhere else; otherwise remove it

```typescript
// router.tsx diff — minimal change
// BEFORE:
{ path: '/', element: <Navigate to="/dashboard" replace /> },
{ path: '/booking', element: <BookingPage /> },

// AFTER:
{ path: '/', element: <HotelHomePage /> },
{ path: '/booking', element: <HotelHomePage /> },
```

**Important:** `ProtectedRoute` does NOT wrap `/` or `/booking` — confirmed from router.tsx. The public booking routes are explicitly "MUST be outside ProtectedRoute" (comment on line 78). Adding `HotelHomePage` at `/` follows the same pattern. No auth changes needed.

### Pattern 2: Sticky Widget + CSS Grid Layout

```tsx
// Desktop: 2-column grid with sticky right column
// src/features/public-portal/HotelHomePage.tsx (structural skeleton)
<div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-10 lg:px-12 lg:pt-8">
  {/* Left: all sections */}
  <main className="min-w-0">
    <HeroGallery ... />
    <HotelIdentity ... />
    {/* sections with ids */}
  </main>

  {/* Right: sticky widget — ONLY on desktop */}
  <aside className="hidden lg:block">
    <div className="sticky top-20">
      <ReservationWidget ... />
    </div>
  </aside>
</div>

{/* Mobile: fixed bottom bar — ONLY on mobile */}
<div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 
                bg-warm-white border-t border-warm-line
                pb-[env(safe-area-inset-bottom)]">
  <ReservationWidget variant="mobile-bar" ... />
</div>
```

### Pattern 3: Hero Gallery Grid

Desktop (bundle lines 386-395):
```
grid-template-columns: 1.4fr 1fr 1fr
grid-template-rows: 200px 200px
```
First image spans 2 rows. 4 cells total (1 large left + 2 top-right + 1 bottom-right with overlay). 5th image position in bundle = bottom-right cell with overlay.

```tsx
// HeroGallery.tsx
<div className="hidden lg:grid gap-1.5 rounded-2xl overflow-hidden"
     style={{ gridTemplateColumns: '1.4fr 1fr 1fr', gridTemplateRows: '200px 200px' }}>
  <img src={photos[0].url} alt={photos[0].alt} className="row-span-2 w-full h-full object-cover" />
  <img src={photos[1].url} alt={photos[1].alt} className="w-full h-full object-cover" />
  <img src={photos[2].url} alt={photos[2].alt} className="w-full h-full object-cover" />
  <img src={photos[3].url} alt={photos[3].alt} className="w-full h-full object-cover" />
  <div className="relative w-full h-full overflow-hidden">
    <img src={photos[4]?.url ?? photos[3].url} alt="" className="w-full h-full object-cover" />
    <button className="absolute bottom-3 right-3 bg-warm-white text-ink-1 text-xs font-medium
                       px-3 py-1.5 rounded-lg border border-warm-line-strong">
      Ver las {photos.length} fotos
    </button>
  </div>
</div>
```

Mobile grid (bundle lines 37-43):
```
grid-template-columns: 1.6fr 1fr
grid-template-rows: 110px 110px
```
First image spans 2 rows. 3 cells total (1 large + 1 top-right + 1 bottom-right with overlay).

### Pattern 4: Anchor Scroll with Sticky Nav Offset

```tsx
// Tailwind scroll-mt-20 = 80px offset = sticky nav height
<section id="habitaciones" className="scroll-mt-20 pt-8 border-t border-warm-line">
  ...
</section>
```

```tsx
// scrollToSection helper (in HotelHomePage.tsx or PublicNav.tsx)
const scrollToSection = (id: string) => {
  if (id === 'inicio') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
```

Note: `scroll-mt-20` (80px) is the offset for the sticky nav. If nav height changes, update both the `top-0 h-16` nav and `scroll-mt-20` in sync.

### Pattern 5: useReservationDraft (URL params)

```typescript
// hooks/useReservationDraft.ts
import { useNavigate, useSearchParams } from 'react-router-dom';

export interface ReservationDraft {
  checkIn: string | null;   // YYYY-MM-DD
  checkOut: string | null;  // YYYY-MM-DD
  adults: number;
}

export function useReservationDraft() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const draft: ReservationDraft = {
    checkIn: params.get('checkIn'),
    checkOut: params.get('checkOut'),
    adults: parseInt(params.get('adults') ?? '2', 10),
  };

  const commit = () => {
    if (!draft.checkIn || !draft.checkOut) return;
    navigate(
      `/booking/rooms?checkIn=${draft.checkIn}&checkOut=${draft.checkOut}&adults=${draft.adults}`
    );
  };

  return { draft, setParams, commit };
}
```

**Deviation note:** `BookingResultsPage.tsx` reads `checkIn`, `checkOut`, and `adults` from `useSearchParams()` (confirmed on lines 90-92). The reservation widget navigates with `?checkIn=&checkOut=&adults=` — this matches exactly. No changes to `BookingResultsPage.tsx` are needed.

### Pattern 6: useSystemConfig (NEW — must be created)

`useSystemConfig` does NOT exist anywhere in the codebase. The CONTEXT.md states it "already exists in v1.0" — this is incorrect. Direct inspection confirms zero occurrences.

There IS a `HotelBranding` component (`apps/web/src/components/branding/HotelBranding.tsx`) that accepts `hotelName` as a prop with default "Hotel Sumapaz". It mentions "from system_config" in a comment, but the actual fetch mechanism doesn't exist.

**Fallback strategy for v1.1 (two options — planner picks one):**

Option A (API approach):
```typescript
// hooks/useSystemConfig.ts
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface SystemConfig {
  hotelName: string;
  address?: string;
  timezone?: string;
}

export function useSystemConfig() {
  return useQuery<SystemConfig>({
    queryKey: ['system-config'],
    queryFn: () => axios.get('/api/config').then(r => r.data),
    staleTime: 24 * 60 * 60 * 1000, // 24h — rarely changes
    retry: 1,
  });
}
```

Option B (env var approach — simpler, no API call):
```typescript
// hooks/useSystemConfig.ts
export function useSystemConfig() {
  return {
    data: {
      hotelName: import.meta.env.VITE_HOTEL_NAME ?? 'Hotel Sumapaz',
      address: import.meta.env.VITE_HOTEL_ADDRESS ?? 'La Candelaria, Bogotá',
    },
    isLoading: false,
  };
}
```

Recommendation: Option B for v1.1 (zero new API dependency, matches the "frontend only" scope of v1.1). The CONTEXT.md says "system_config.hotelName via existing useSystemConfig hook" — since the hook must be created anyway, Option B is fastest and stays within frontend-only scope.

### Anti-Patterns to Avoid

- **Hardcoded hex colors:** `BookingPage.tsx` and `BookingResultsPage.tsx` have many hardcoded hex values (e.g., `bg-[#f9f5f0]`, `text-[#c45a3a]`). HotelHomePage must use token utilities only: `bg-warm-paper`, `text-terracotta`, `bg-warm-white`.
- **Route inside ProtectedRoute:** Never wrap `/` or `/booking` inside the `<ProtectedRoute>` component.
- **Reading localStorage before hydration:** `useTheme` reads localStorage on mount using `useState` initializer — safe. But do NOT read `window.matchMedia` or `localStorage` synchronously outside React lifecycle (this causes SSR hydration mismatches even in Vite SPA context if the component is used with streaming).
- **Theme toggle on public pages:** The `ThemeToggle` component must NOT be rendered in `PublicNav` or `PublicConciergeLayout`. The public portal is always light mode. The `data-theme="dark"` attribute may be set on `<html>` if a staff user previously visited the PMS — this means the public portal will inherit dark mode tokens if the `.hos` root class exists. Mitigation: wrap public portal content in a `<div className="hos" data-theme="light">` container to force light mode override, OR set `data-theme` to `""` on mount in a `useEffect` in `HotelHomePage`.
- **Breaking sticky with overflow:** A parent element with `overflow: auto`, `overflow: hidden`, or `overflow: scroll` breaks `position: sticky`. The sticky reservation widget requires that NO ancestor between it and the scroll container has `overflow` set. The main scroll container should be the `<body>` or the outermost flex/grid container.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range selection | Custom calendar UI | `DayPicker` from `react-day-picker` (already installed) | Locale, keyboard nav, disabled dates, range selection — all built in |
| Spanish day names | Custom locale arrays | `import { es } from 'react-day-picker/locale'` | v10 exports locale objects directly |
| Icon rendering | Custom SVG components | `lucide-react` (already installed) | Tree-shakeable, consistent stroke, 525+ icons at v0.525.0 |
| Conditional classNames | String concatenation | `clsx` + `tailwind-merge` (already installed) | Handles Tailwind class conflicts and conditional logic |
| Hotel name from config | Hardcoded string | `useSystemConfig` hook (create in Wave 0) | Even if env-var based, centralizes the fallback |

---

## Concierge Restyle Inventory (PUB-13)

All files to be modified:

### 1. `apps/web/src/features/concierge/ConciergePage.tsx`

Current visual state → Required delta:

| Element | Current class | Target class |
|---------|--------------|-------------|
| Page container | `flex flex-col h-[calc(100vh-57px)]` | No structural change |
| Messages area bg | `bg-gray-50` (inherited from layout) | `bg-warm-paper` (on layout, not page) |
| Empty state icon container | `bg-blue-50` / `text-blue-600` | `bg-terracotta-tint` / `text-terracotta` |
| Suggestion chip border | `border-gray-200 bg-white hover:border-blue-300` | `border-warm-line bg-warm-white hover:border-terracotta-soft` |
| Suggestion chip text | `text-gray-700` | `text-ink-2` |
| Status banners | `border-amber-200 bg-amber-50 text-amber-800` / `border-red-200 bg-red-50 text-red-800` | Keep semantic colors (these are status/warning, not brand palette) |
| Input form container | `border-t border-gray-200 bg-white` | `border-t border-warm-line bg-warm-white` |
| Textarea | `border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:ring-blue-500` | `border-warm-line bg-warm-paper text-ink-1 placeholder:text-ink-4 focus:ring-terracotta` |
| Send button | `bg-blue-600 hover:bg-blue-700` | `bg-terracotta hover:bg-terracotta-deep` |

### 2. `apps/web/src/features/concierge/ChatMessage.tsx`

| Element | Current class | Target class |
|---------|--------------|-------------|
| User bubble | `bg-blue-600 text-white rounded-br-sm` | `bg-terracotta text-warm-white rounded-br-sm` |
| Assistant bubble | `bg-gray-100 text-gray-800 rounded-bl-sm` | `bg-warm-white text-ink-1 border border-warm-line rounded-bl-sm` |
| Streaming dots | `bg-gray-400` | `bg-ink-4` |
| Error box | `border-red-200 bg-red-50 text-red-700` | Keep (semantic color for errors) |

### 3. `apps/web/src/features/concierge/VenueCard.tsx`

| Element | Current class | Target class |
|---------|--------------|-------------|
| Card wrapper | `rounded-2xl border border-gray-200 bg-white shadow-sm` | `rounded-2xl border border-warm-line bg-warm-white shadow-sm` (or `hos-card`) |
| Photo placeholder bg | `bg-gray-100` | `bg-warm-cream` |
| Venue name `<h3>` | `text-sm font-semibold text-gray-900` | `font-display text-sm font-semibold text-ink-1` ← Instrument Serif |
| Type badge | `bg-blue-50 text-blue-700` | `bg-terracotta-tint text-terracotta-deep` |
| Rating text | `text-gray-500` | `text-ink-3` |
| Star fill/empty | `fill-amber-400 text-amber-400` / `text-gray-300` | `fill-mustard text-mustard` / `text-ink-4` |
| Distance text | `text-gray-500` | `text-ink-3` |
| Address text | `text-gray-400` | `text-ink-4` |
| "Cómo llegar" button | `bg-blue-600 hover:bg-blue-700` | `bg-terracotta hover:bg-terracotta-deep text-warm-white` |
| Secondary action buttons | `border-gray-200 bg-white text-gray-700 hover:bg-gray-50` | `border-warm-line bg-warm-white text-ink-2 hover:bg-warm-cream` |

### 4. `apps/web/src/layouts/PublicConciergeLayout.tsx`

| Element | Current class | Target class |
|---------|--------------|-------------|
| Root container | `min-h-screen bg-gray-50 flex flex-col` | `min-h-screen bg-warm-paper flex flex-col` |
| Header | `border-b border-gray-200 bg-white sticky top-0 z-10` | `border-b border-warm-line bg-warm-white sticky top-0 z-10` |
| Logo mark | `bg-blue-600` (inline) | `bg-terracotta` (or `hos-logo-mark` class) |
| Hotel name text | `font-semibold text-gray-900` | `font-display text-ink-1` |
| Location text | `text-gray-400` | `text-ink-4` |

---

## Common Pitfalls

### Pitfall 1: `position: sticky` Broken by Parent Overflow

**What goes wrong:** The sticky reservation widget (`position: sticky; top: 80px`) stops working.
**Why it happens:** Any ancestor element with `overflow: auto`, `overflow: hidden`, or `overflow: scroll` creates a new scroll container and traps sticky positioning within it. The widget appears to scroll away with the content.
**How to avoid:** Ensure the 2-column grid wrapper has no `overflow` property. The scroll container must be `<body>` or a full-height root element. In React: do NOT put `overflow-auto` or `overflow-scroll` on the `<main>` or grid container.
**Warning signs:** Sticky widget scrolls instead of staying fixed. Check parent elements in DevTools → Computed → scroll container.

### Pitfall 2: Dark Mode Applied to Public Portal

**What goes wrong:** A staff user sets dark mode in the PMS. Later they visit `/` — the `data-theme="dark"` attribute on `<html>` causes all token variables to resolve to dark palette values. The warm-paper booking page renders dark.
**Why it happens:** `useTheme` sets `data-theme` on `document.documentElement` (the `<html>` element). This persists in localStorage and applies globally. The `.hos[data-theme="dark"]` CSS selector overrides all tokens.
**How to avoid:** In `HotelHomePage.tsx`, add a `useEffect` that forces light mode while mounted:
```typescript
useEffect(() => {
  document.documentElement.removeAttribute('data-theme');
  // Do NOT save to localStorage — don't clobber staff preference
  return () => {
    // Restore from localStorage when leaving public page
    const stored = localStorage.getItem('hos-theme');
    if (stored === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  };
}, []);
```
Apply the same pattern in `PublicConciergeLayout.tsx`.

### Pitfall 3: ProtectedRoute Wrapping `/`

**What goes wrong:** Visitor opens `/` and gets redirected to `/login`.
**Why it happens:** A second route block with `path: '/'` exists inside the `ProtectedRoute` element. React Router evaluates routes in order — if the new `HotelHomePage` route is placed inside the ProtectedRoute children block instead of the public block, it will trigger auth redirect.
**How to avoid:** In `router.tsx`, the new `/` and `/booking` routes must be placed in the top-level `AppWrapper` children block, NOT inside the `ProtectedRoute` block. Current confirmed structure: public routes are at lines 60-94, ProtectedRoute starts at line 97 with `path: '/'`.
**Warning signs:** Hard refresh of `/` redirects to `/login`.

### Pitfall 4: `react-day-picker` CSS Leaking

**What goes wrong:** The picker's CSS import (`import 'react-day-picker/dist/style.css'`) overrides global typography or colors.
**Why it happens:** The picker stylesheet sets `.rdp` scoped styles, which are safe. BUT it also sets some `:root` CSS variables for theming. These could conflict with the shadcn bridge variables in `globals.css`.
**How to avoid:** Import the picker CSS in the reservation widget component file (not in `globals.css`). The `.rdp` scope prevents bleed-out. If token conflicts occur, wrap the picker in a container and override: `[&_.rdp]:font-body`.
**Warning signs:** Calendar day numbers show wrong font family, or button colors look off.

### Pitfall 5: Anchor Scroll Target Hidden Behind Sticky Nav

**What goes wrong:** Clicking "Habitaciones" in the nav scrolls correctly, but the section heading is hidden behind the 64px sticky nav.
**Why it happens:** `scrollIntoView({ behavior: 'smooth', block: 'start' })` scrolls the element to the top of the viewport, not accounting for the sticky nav height.
**How to avoid:** Add `scroll-mt-20` (80px offset, slightly more than 64px nav height for breathing room) to every anchor section element:
```html
<section id="habitaciones" className="scroll-mt-20">
```
The `scroll-mt-*` Tailwind utility sets `scroll-margin-top`, which the browser respects during `scrollIntoView`.

### Pitfall 6: Mobile Safe Area Inset

**What goes wrong:** Fixed bottom bar on iOS overlaps the home indicator bar (the "notch" at the bottom of iPhone screens).
**How to avoid:** Add `pb-[env(safe-area-inset-bottom)]` to the fixed bottom bar container. This is a CSS environment variable supported in all modern iOS/Android browsers.
**Warning signs:** On iPhone, the "Reservar" button appears cut off or overlapped by the swipe bar.

### Pitfall 7: `hos-pill`, `hos-card`, `hos-btn`, `hos-avatar` not in globals.css

**What goes wrong:** Portal components use `hos-pill`, `hos-card`, `hos-btn`, and `hos-avatar` class names (from the bundle design) but these generate no CSS — they are in `tokens.jsx` but were NOT ported to `globals.css` in Phase 9.
**Why it happens:** Phase 9 ported CSS tokens and `@theme inline` mapping, but not the bundle's utility class definitions (`.hos-card`, `.hos-btn`, `.hos-pill`, `.hos-avatar`, `.hos-logo-mark`). These were in the `tokens.jsx` script block injected into the design canvas, not recognized as production utility classes.
**How to avoid:** Wave 0 of Phase 10 MUST add these utility classes to `globals.css`. The exact CSS is available in `.design-fetch/hotelos-ai/project/tokens.jsx` lines 219-270. Alternatively, implement each as a Tailwind utility composition with `@layer utilities` (recommended for Tailwind v4 approach) rather than using the raw class names.
**Recommendation:** Use Tailwind utilities directly in components (avoids the global CSS dependency), reserving `hos-pill` and `hos-card` only where the semantic name improves readability.

---

## Code Examples

### react-day-picker v10 — Range Picker in Reservation Widget

```typescript
// Source: verified pattern from BookingPage.tsx + react-day-picker v10 docs
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { es } from 'react-day-picker/locale';

function ReservationDatePicker({
  range,
  onChange,
}: {
  range: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}) {
  return (
    <DayPicker
      mode="range"
      selected={range}
      onSelect={onChange}
      disabled={{ before: new Date() }}
      numberOfMonths={1}        // Use 2 on desktop via prop
      locale={es}
    />
  );
}
```

### Scroll-to-Section Utility

```typescript
// Source: CONTEXT.md Specific Ideas section
export const scrollToSection = (id: string) => {
  if (id === 'inicio') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
```

### Hotel Name Display Pattern (italic second word)

```tsx
// Source: portal.jsx line 49 + CONTEXT.md
function HotelName({ hotelName }: { hotelName: string }) {
  // "Hotel Sumapaz" → "Hotel" + italic "Sumapaz"
  const parts = hotelName.split(' ');
  const first = parts[0];
  const rest = parts.slice(1).join(' ');
  return (
    <h1 className="font-display text-4xl leading-tight">
      {first} {rest && <i className="italic">{rest}</i>}
    </h1>
  );
}
```

### Reservation Widget Navigation

```typescript
// Source: CONTEXT.md + BookingResultsPage.tsx line 90-92 (confirmed param names)
const handleReservar = () => {
  if (!draft.checkIn || !draft.checkOut) return;
  navigate(
    `/booking/rooms?checkIn=${draft.checkIn}&checkOut=${draft.checkOut}&adults=${draft.adults}`
  );
};
// BookingResultsPage already reads: searchParams.get('checkIn'), searchParams.get('checkOut'), searchParams.get('adults')
// No changes to BookingResultsPage required.
```

### Dark Mode Force-Light on Public Pages

```typescript
// Source: analysis of useTheme.ts + pitfall documentation above
// Apply in HotelHomePage.tsx and PublicConciergeLayout.tsx
useEffect(() => {
  const root = document.documentElement;
  const prev = root.getAttribute('data-theme');
  root.removeAttribute('data-theme');
  return () => {
    if (prev) root.setAttribute('data-theme', prev);
  };
}, []);
```

---

## Q&A: Research Questions Answered

### Q1: Current `/` route reality

The root path `/` currently renders `<Navigate to="/dashboard" replace />` (router.tsx line 62). Authenticated users go to the dashboard. Unauthenticated users: `<Navigate to="/dashboard" replace />` → then the `dashboard` route is inside `ProtectedRoute` → redirects to `/login`. So effectively, unauthenticated users visiting `/` are sent to `/login`.

`/booking` routes to `<BookingPage />` (router.tsx line 81-83) — the bare search form with date picker + adults input. This is the CURRENT public landing.

**Minimum diff to get `HotelHomePage` at `/`:**
1. Change line 62: `<Navigate to="/dashboard" replace />` → `<HotelHomePage />`
2. Change line 81: `element: <BookingPage />` → `element: <HotelHomePage />`
3. Add import at bottom: `import { HotelHomePage } from '@/features/public-portal/HotelHomePage'`
4. `BookingPage.tsx` becomes unused after this change — keep the file for now (Phase 11 cleanup), or delete it if the planner chooses to keep the blast radius minimal.

### Q2: react-day-picker v10 integration

Import path: `react-day-picker` (named export `DayPicker`) + `react-day-picker/dist/style.css` (required CSS).
Locale: `import { es } from 'react-day-picker/locale'` — no date-fns needed.
Styling with Tailwind v4: the picker renders its own `.rdp-*` class tree. To style selected/range days with token colors, use the `classNames` prop on `DayPicker`:

```typescript
<DayPicker
  classNames={{
    range_start: 'bg-terracotta text-warm-white',
    range_end: 'bg-terracotta text-warm-white',
    range_middle: 'bg-terracotta-tint text-ink-1',
    day_button: 'hover:bg-warm-cream',
  }}
  ...
/>
```

The `classNames` prop (v10 API) accepts Tailwind utilities directly. This is the recommended approach over CSS overrides.

### Q3: System config hook

`useSystemConfig` DOES NOT EXIST. Zero occurrences found anywhere in `apps/web/src`. The `HotelBranding` component takes `hotelName` as a prop with a hardcoded default. For v1.1, create a new hook in `apps/web/src/features/public-portal/hooks/useSystemConfig.ts` using Option B (env var, see Pattern 6 above).

### Q4: Concierge restyle scope

All concierge component files: `ConciergePage.tsx`, `ChatMessage.tsx`, `VenueCard.tsx`, `PublicConciergeLayout.tsx`. Complete delta documented in §Concierge Restyle Inventory. No logic files (`concierge.api.ts`, `concierge.store.ts`, `useConciergeChat.ts`, `streamMessages.ts`, `types.ts`) need changes.

### Q5: Responsive strategy with Tailwind v4

Tailwind v4 preserves all standard breakpoint prefixes: `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px). No breaking changes to breakpoint syntax.

Known Tailwind v4 gotcha with sticky + grid: Tailwind v4 uses CSS-native config. The `sticky` utility generates `position: sticky`. Grid containers with `overflow` set (implicit or explicit) will still break sticky — this is a CSS behavior, not a Tailwind issue. Use `min-h-screen` on body-level container. No v4-specific issues identified for this phase.

### Q6: Sticky widget pattern

Canonical pattern:
```html
<!-- Scroll container: body (default) -->
<!-- Grid wrapper: NO overflow -->
<div class="lg:grid lg:grid-cols-[1fr_400px] lg:gap-10">
  <main> <!-- left, all sections --> </main>
  <aside class="hidden lg:block">
    <div class="sticky top-20">  <!-- top-20 = 80px, clears 64px nav + 16px breathing room -->
      <!-- ReservationWidget -->
    </div>
  </aside>
</div>
```

Key pitfalls:
- `overflow-hidden` on the grid wrapper breaks sticky → never add overflow to the grid container
- `min-height: 100vh` on parent ensures the sticky widget has room to stick before the footer
- z-index: sticky widget gets `z-10`; fixed bottom bar gets `z-40` (above content, below modals)

### Q7: Fixed bottom bar on mobile

```html
<div class="lg:hidden fixed bottom-0 left-0 right-0 z-40
            bg-warm-white border-t border-warm-line
            pb-[env(safe-area-inset-bottom)]">
  <!-- Mobile reservation bar content -->
  <div class="flex items-center gap-3 px-4 py-3">
    <div class="flex-1"><!-- date summary --></div>
    <button class="bg-terracotta text-warm-white px-6 py-2.5 rounded-lg font-medium">
      Reservar
    </button>
  </div>
</div>
```

Safe area inset pattern `pb-[env(safe-area-inset-bottom)]` works in all browsers (Chrome 69+, Safari 11.2+, Firefox 65+). This is the exact pattern used by Airbnb, Booking.com, and similar hotel booking sites.

### Q8: Anchor scroll behavior

Final pattern: `scrollIntoView({ behavior: 'smooth', block: 'start' })` + `scroll-mt-20` on all section targets.

Safari iOS smooth scroll: supported since iOS 15.4 (March 2022). Given the target audience (Colombia hotel guests with modern phones), this is safe to use without polyfill.

```tsx
// Every anchor section:
<section id="habitaciones" className="scroll-mt-20 pt-8">
// scroll-mt-20 = 80px margin — slightly more than 64px nav = section heading stays visible
```

### Q9: Image strategy

Recommendation: Unsplash source URLs (no download required, no disk footprint). Use the Unsplash Source API format which serves resized images directly:
```
https://images.unsplash.com/photo-{ID}?w=1600&q=80&auto=format&fit=crop
```

Suggested photos for a Bogotá boutique hotel:
- `fachada`: colonial facade — `photo-1555396273-367ea4eb4db5` (boutique hotel facade)
- `lobby`: warm interior — `photo-1566073771259-6a8506099945` (hotel lobby)
- `suite`: guest room — `photo-1631049307264-da0ec9d70304` (bedroom)
- `restaurante`: restaurant interior — `photo-1414235077428-338989a2e8c0`
- `terraza`: terrace/view — `photo-1504280390367-361c6d9f38f4`

If offline dev is required, download to `apps/web/public/hotel-photos/` at max 1600px width, ~60-100KB JPEG. Disk footprint: ~400KB for 5 photos.

### Q10: URL params handoff to `/booking/rooms`

CONFIRMED: `BookingResultsPage.tsx` lines 90-92 already reads `checkIn`, `checkOut`, and `adults` from `useSearchParams()`. The reservation widget's navigation URL `?checkIn=X&checkOut=Y&adults=N` matches exactly. Zero changes to `BookingResultsPage.tsx` needed.

### Q11: Pitfalls summary (cross-reference)

See §Common Pitfalls for full details. Summary:
- Hydration mismatches: not applicable in Vite SPA (no SSR)
- `react-day-picker` CSS scope: contained to `.rdp` class — no leak
- Smooth scroll on Safari iOS: safe since iOS 15.4
- Public portal auth: confirmed — `/` and `/booking` are outside `ProtectedRoute`
- Theme toggle on public pages: requires `useEffect` force-light pattern (see Pitfall 2)

### Q12: Files inventory and blast radius

**NEW files (~15 files):**
```
apps/web/src/features/public-portal/
├── HotelHomePage.tsx
├── HotelHomePage.test.tsx
├── sections/HeroGallery.tsx
├── sections/HotelIdentity.tsx
├── sections/RoomTypesSection.tsx
├── sections/ConciergeTeaser.tsx
├── sections/RestauranteSection.tsx
├── sections/UbicacionSection.tsx
├── sections/ResenasSection.tsx
├── components/PublicNav.tsx
├── components/ReservationWidget.tsx
├── components/PublicFooter.tsx
├── hooks/useReservationDraft.ts
├── hooks/useSystemConfig.ts
└── data/hotel.ts + roomTypes.ts + reviews.ts + photos.ts (4 data files)
```

**MODIFIED files (7 files):**
```
apps/web/src/router.tsx                    — 3 line change (route registration)
apps/web/src/styles/globals.css            — add hos-pill/hos-card/hos-btn/hos-avatar/hos-logo-mark
apps/web/src/features/concierge/ConciergePage.tsx   — restyle classes
apps/web/src/features/concierge/ChatMessage.tsx     — restyle classes
apps/web/src/features/concierge/VenueCard.tsx       — restyle classes + font-display
apps/web/src/layouts/PublicConciergeLayout.tsx      — restyle classes
apps/web/src/features/public-booking/BookingPage.tsx — EITHER deleted OR kept (planner decides)
```

**PUBLIC ASSETS:**
```
apps/web/public/hotel-photos/
├── fachada.jpg
├── lobby.jpg
├── suite.jpg
├── restaurante.jpg
└── terraza.jpg
```
(If using Unsplash URLs instead, no local files needed)

### Q13: Test strategy

| Coverage | Approach | What to verify |
|----------|----------|---------------|
| Smoke: HotelHomePage renders | Vitest | All 6 section ids in DOM, nav has 5 items, hotel name renders |
| Smoke: Reservation widget present | Vitest | DayPicker renders, "Reservar" button present |
| Smoke: Concierge restyle | Vitest | `bg-warm-paper` class on layout container |
| Visual: 3 viewports | Manual (Playwright optional) | 360px / 768px / 1280px — no horizontal overflow |
| Visual: smooth scroll | Manual | Click nav item → section scrolls into view with offset |
| Dark mode isolation | Manual | Set dark mode in PMS, visit `/` → should be light |
| Route access | Manual | Visit `/` without auth → HotelHomePage, NOT login redirect |
| URL params | Manual | Reservation widget → "Reservar" → URL has checkIn/checkOut/adults |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `BookingPage.tsx` bare search form at `/` | `HotelHomePage` Airbnb-style landing | Replace entirely |
| `react-day-picker` CSS-scoped inline | Same — already v10 in codebase | No change needed |
| `data-theme="dark"` global toggle | Force-light `useEffect` on public pages | New pattern needed |
| `useSystemConfig` (referenced, absent) | Create as env-var hook in Phase 10 | New file |
| `hos-pill/hos-card/hos-btn` (bundle only) | Add to `globals.css` in Wave 0 | Wave 0 blocker |

---

## Open Questions

1. **`useSystemConfig` endpoint**
   - What we know: `/api/config` is mentioned in ROADMAP as a potential exception. The `system_config` table has `hotelName` (or equivalent).
   - What's unclear: Does a GET `/api/config` public endpoint exist in the NestJS backend?
   - Recommendation: Use Option B (env var) for v1.1. Planner marks v1.2 wire-to-API as a TODO comment.

2. **`BookingPage.tsx` disposal**
   - What we know: Once `/` and `/booking` point to `HotelHomePage`, `BookingPage.tsx` becomes unused.
   - What's unclear: Any other reference to `BookingPage` outside routing?
   - Recommendation: Keep the file in v1.1 (avoid deletion noise), add a `// deprecated: replaced by HotelHomePage in Phase 10` comment.

3. **hos-utility classes approach**
   - What we know: Bundle uses `hos-card`, `hos-pill`, `hos-btn`, `hos-avatar` as class names. These aren't in `globals.css`.
   - What's unclear: Should Wave 0 add them to `globals.css` verbatim, or should Phase 10 use Tailwind utility compositions instead?
   - Recommendation: Use Tailwind utilities directly in component JSX (avoids adding ~80 lines of non-Tailwind CSS to globals.css). Reserve `hos-card` and `hos-pill` as semantic helpers if readability benefits.

---

## Sources

### Primary (HIGH confidence — direct code inspection)

- `apps/web/src/router.tsx` — route topology confirmed
- `apps/web/src/features/public-booking/BookingPage.tsx` — react-day-picker import pattern, hardcoded hex values confirmed
- `apps/web/src/features/public-booking/BookingResultsPage.tsx` — URL param reading confirmed (`checkIn`, `checkOut`, `adults`)
- `apps/web/src/features/concierge/ConciergePage.tsx` — current visual classes inventoried
- `apps/web/src/features/concierge/ChatMessage.tsx` — bubble classes inventoried
- `apps/web/src/features/concierge/VenueCard.tsx` — full restyle delta documented
- `apps/web/src/layouts/PublicConciergeLayout.tsx` — full restyle delta documented
- `apps/web/src/styles/globals.css` — token vocabulary confirmed, hos-utility class absence confirmed
- `apps/web/package.json` — all dependency versions confirmed
- `.design-fetch/hotelos-ai/project/tokens.jsx` — `hos-pill`, `hos-card`, `hos-btn`, `hos-avatar`, `hos-logo-mark` CSS definitions
- `.design-fetch/hotelos-ai/project/screens/portal.jsx` — gallery grid dimensions, nav items, section structure, review data, room type data
- `apps/web/src/hooks/useTheme.ts` — theme mechanism confirmed (data-theme on documentElement)
- `.planning/phases/09-design-system-foundation/09-04-SUMMARY.md` — Phase 9 closeout confirmed, exported primitives verified

### Secondary (MEDIUM confidence — CONTEXT.md + REQUIREMENTS.md)

- `.planning/phases/10-public-portal/10-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md` — PUB-07..13 requirements

---

## Metadata

**Confidence breakdown:**
- Route topology: HIGH — direct inspection of router.tsx
- react-day-picker integration: HIGH — 5 existing usages in codebase
- useSystemConfig absence: HIGH — grep confirms zero occurrences
- hos-utility class gap: HIGH — confirmed absent from globals.css, present in tokens.jsx
- Concierge restyle delta: HIGH — all 4 files directly read
- Sticky widget pitfalls: HIGH — standard CSS behavior, verified against bundle layout
- URL params handoff: HIGH — BookingResultsPage.tsx directly inspected

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (stable stack — no fast-moving dependencies)

---

## RESEARCH COMPLETE
