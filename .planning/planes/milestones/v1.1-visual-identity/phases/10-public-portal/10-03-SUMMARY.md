---
phase: 10-public-portal
plan: 03
subsystem: frontend/public-portal
tags: [sections, rooms, reviews, concierge, restaurante, ubicacion, token-utilities]
requirements: [PUB-07, PUB-11, PUB-12]

dependency-graph:
  requires:
    - apps/web/src/features/public-portal/types.ts (10-01)
    - apps/web/src/features/public-portal/data/roomTypes.ts (10-01)
    - apps/web/src/features/public-portal/data/reviews.ts (10-01)
    - apps/web/src/components/ui/button.tsx (Phase 9)
  provides:
    - apps/web/src/features/public-portal/components/RoomsSection.tsx
    - apps/web/src/features/public-portal/components/ReviewsSection.tsx
    - apps/web/src/features/public-portal/components/ConciergeTeaser.tsx
    - apps/web/src/features/public-portal/components/RestaurantSection.tsx
    - apps/web/src/features/public-portal/components/LocationSection.tsx
  affects:
    - 10-02 (HotelHomePage barrel import) — these 5 exports complete the section set

tech-stack:
  added: []
  patterns:
    - Token-utility-only composition (no hex, no Tailwind palette colors)
    - Button asChild + react-router-dom Link for terracotta CTA navigation
    - section id + scroll-mt-20 for sticky-nav anchor compatibility

key-files:
  created:
    - apps/web/src/features/public-portal/components/RoomsSection.tsx
    - apps/web/src/features/public-portal/components/ReviewsSection.tsx
    - apps/web/src/features/public-portal/components/ConciergeTeaser.tsx
    - apps/web/src/features/public-portal/components/RestaurantSection.tsx
    - apps/web/src/features/public-portal/components/LocationSection.tsx
  modified: []

decisions:
  - "ConciergeTeaser CTA uses Button asChild + Link to=/concierge (react-router-dom) — not an anchor scroll — navigates away from HotelHomePage to the chat route"
  - "Ubicación uses static map placeholder (warm-cream bg + MapPin icon) — Leaflet/Google Maps interactive embed deferred to v1.2"
  - "Badge pills are inline span compositions with token utilities — Badge primitive not used (avoids over-coupling for two small pills)"
  - "No component touches HotelHomePage.tsx or components/index.ts — those are 10-02 territory"

metrics:
  duration: "~20 min"
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 0
---

# Phase 10 Plan 03: 5 Section Components Summary

Five presentational section components for HotelHomePage — token-utility-only, no hex, no palette colors, each with proper section IDs and scroll-mt-20 for sticky nav.

## What Was Built

### Component Prop Signatures

| Component | Props | Notes |
|-----------|-------|-------|
| `RoomsSection` | `{ rooms: RoomTypeCard[] }` | Data-driven; maps over rooms array |
| `ReviewsSection` | `{ reviews: Review[]; rating: number; reviewCount: number }` | Aggregated header + card grid |
| `ConciergeTeaser` | none | Fully self-contained; Link to /concierge |
| `RestaurantSection` | none | Fully self-contained; hardcoded hours + Unsplash image |
| `LocationSection` | `{ address: string }` | Address rendered in map placeholder |

### RoomsSection

- Grid `grid-cols-1 md:grid-cols-2` — 4 cards from props
- Highlight logic: `room.badge === 'mejor-valor'` → `border-[1.5px] border-terracotta bg-terracotta-tint`
- Badge pills: terracotta-soft/terracotta-deep for "Mejor valor", mustard/ink-1 for "Más económica"
- Prices: `font-mono` — `${(pricePerNight / 1000).toFixed(0)}k` → `$280k`

### ReviewsSection

- Aggregated header: `Star fill-mustard` + `font-display text-3xl` rating + review count
- Review cards: avatar circle (bg-warm-cream + initials), name, date, star row, comment
- All stars use `fill-mustard text-mustard`

### ConciergeTeaser

- `bg-warm-cream` card, `MessageCircle` icon in `bg-terracotta-tint` container
- `Button asChild variant="terracotta"` wrapping `<Link to="/concierge">Abrir Concierge IA</Link>`
- Phase 9 Button confirmed to support `asChild` via Radix Slot

### RestaurantSection

- `grid-cols-1 lg:grid-cols-2` — Unsplash image left, text block right
- Hours: Desayuno 7:00–10:30, Almuerzo 12:30–15:00, Cena 19:00–22:30
- Heading: `<i className="italic">Sumapaz</i>` pattern from bundle

### LocationSection

- Static map placeholder: `bg-warm-cream border border-warm-line h-64 lg:h-72`
- `MapPin` terracotta icon + address prop + "Mapa interactivo · v1.2" label
- LANDMARKS array (4 entries): Plaza de Bolívar, Museo del Oro, Cerro de Monserrate, Aeropuerto El Dorado
- Distances use `font-mono text-ink-3`

## Decisions Made

### Decision 1: ConciergeTeaser CTA → react-router-dom Link

CTA uses `<Link to="/concierge">` wrapped in `Button asChild`. This navigates away from HotelHomePage entirely (not an anchor scroll). Matches the bundle's intent — concierge is a distinct chat experience, not an in-page section.

### Decision 2: Ubicación — static placeholder, Leaflet/Google deferred

Static placeholder (warm-cream div + MapPin icon) used for v1.1. Interactive map (Leaflet, Google Maps embed, or static maps API) deferred to v1.2. The placeholder shows the address from props and a "Mapa interactivo · v1.2" label as a clear upgrade signal.

### Decision 3: Badge pills as inline span compositions

Used inline `<span className="...">` with token utilities instead of the shadcn Badge primitive. The Badge primitive's default variant doesn't map cleanly to the terracotta-soft + terracotta-deep combination needed. Inline composition is more direct and avoids variant overriding.

### Decision 4: No component touches 10-02 territory

None of the 5 files import or reference `HotelHomePage.tsx` or `components/index.ts`. The barrel (10-02) will import these components by name. File ownership confirmed disjoint from wave 2 siblings.

## Commits

| Hash | Description |
|------|-------------|
| `d023eb3` | feat(10-03): create RoomsSection + ReviewsSection |
| `5469d24` | feat(10-03): create ConciergeTeaser |
| `b0c4961` | feat(10-03): create RestaurantSection |
| `d6672fb` | feat(10-03): create LocationSection |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files verified:
- apps/web/src/features/public-portal/components/RoomsSection.tsx — FOUND
- apps/web/src/features/public-portal/components/ReviewsSection.tsx — FOUND
- apps/web/src/features/public-portal/components/ConciergeTeaser.tsx — FOUND
- apps/web/src/features/public-portal/components/RestaurantSection.tsx — FOUND
- apps/web/src/features/public-portal/components/LocationSection.tsx — FOUND

TypeScript: `pnpm tsc --noEmit` → exit 0
No hex colors: `rg "#[0-9a-fA-F]{3,6}" components/` → 0 matches
No hos-* classes: `rg "hos-(card|pill|btn|avatar)" components/` → 0 matches

## Self-Check: PASSED
