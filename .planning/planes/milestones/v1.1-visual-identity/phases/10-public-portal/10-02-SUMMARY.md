---
phase: 10-public-portal
plan: 02
subsystem: frontend/public-portal
tags: [shell, router, nav, hero-gallery, hotel-identity, footer, barrel, rename]
requirements: [PUB-07, PUB-08, PUB-09, PUB-12]

dependency-graph:
  requires:
    - apps/web/src/features/public-portal/data (10-01) — PHOTOS, ROOM_TYPES, REVIEWS, HOTEL_INFO_FALLBACK
    - apps/web/src/features/public-portal/hooks (10-01) — useHotelInfo, useForceLightTheme
    - apps/web/src/features/public-portal/components/RoomsSection.tsx (10-03)
    - apps/web/src/features/public-portal/components/ConciergeTeaser.tsx (10-03)
    - apps/web/src/features/public-portal/components/RestaurantSection.tsx (10-03)
    - apps/web/src/features/public-portal/components/LocationSection.tsx (10-03)
    - apps/web/src/features/public-portal/components/ReviewsSection.tsx (10-03)
    - apps/web/src/features/public-portal/components/ReservationWidget.tsx (10-04)
  provides:
    - apps/web/src/features/public-portal/HotelHomePage.tsx — root public landing component
    - apps/web/src/features/public-portal/components/TopNav.tsx — sticky nav with 5 anchor links
    - apps/web/src/features/public-portal/components/HeroGallery.tsx — CSS Grid 4-photo desktop / 3-photo mobile
    - apps/web/src/features/public-portal/components/HotelIdentity.tsx — H1 + rating + pills + description
    - apps/web/src/features/public-portal/components/PortalFooter.tsx — minimal footer
    - apps/web/src/features/public-portal/utils/scrollToSection.ts — anchor scroll helper
    - apps/web/src/features/public-portal/components/index.ts — authoritative barrel for all 10 components
    - apps/web/src/features/public-portal/index.ts — feature barrel exporting HotelHomePage
    - apps/web/src/router.tsx — updated; / and /booking render HotelHomePage
    - apps/web/src/features/public-booking/LegacyBookingPage.tsx — preserved for rollback
  affects:
    - 10-06 (Concierge restyle) — no structural impact; only HotelHomePage topology defined here

tech-stack:
  added: []
  patterns:
    - CSS Grid dual-layout (hidden lg:grid / grid lg:hidden) — single React tree, CSS-driven (PUB-12)
    - sticky top-0 z-40 TopNav + scroll-mt-20 on all anchor sections (clears 64px nav + 16px breathing room)
    - useForceLightTheme() as first hook call in public component body — prevents staff dark mode leak
    - lg:grid-cols-[1fr_400px] 2-column layout with sticky top-20 sidebar (NO overflow on grid wrapper)
    - Feature barrel pattern: components/index.ts (10-02 owns) + public-portal/index.ts (HotelHomePage + re-exports)
    - git mv for rename: preserves blame + history on LegacyBookingPage

key-files:
  created:
    - apps/web/src/features/public-portal/utils/scrollToSection.ts
    - apps/web/src/features/public-portal/components/TopNav.tsx
    - apps/web/src/features/public-portal/components/HeroGallery.tsx
    - apps/web/src/features/public-portal/components/HotelIdentity.tsx
    - apps/web/src/features/public-portal/components/PortalFooter.tsx
    - apps/web/src/features/public-portal/HotelHomePage.tsx
    - apps/web/src/features/public-portal/components/index.ts
    - apps/web/src/features/public-portal/index.ts
  modified:
    - apps/web/src/router.tsx — / and /booking now render HotelHomePage; BookingPage import removed; HotelHomePage import added
    - apps/web/src/features/public-booking/LegacyBookingPage.tsx — renamed from BookingPage.tsx; export renamed; @deprecated JSDoc added

decisions:
  - "components/index.ts owned by 10-02 (authoritative barrel writer) — 10-03/10-04 create only their component files, never touch the barrel"
  - "BookingPage.tsx preserved as LegacyBookingPage.tsx via git mv — blame history intact, not routed, @deprecated JSDoc with v1.2 removal note"
  - "HotelHomePage uses hos class on root div (CSS var scope) — essential since it mounts OUTSIDE StaffLayout which normally provides the scope"
  - "No overflow-* on lg:grid wrapper — prevents sticky ReservationWidget from breaking (Research Pitfall 1)"
  - "TopNav uses z-40 (not z-50) — consistent with existing overlay z-index ladder; sticky widget uses z-10; mobile fixed bar uses z-40 from ReservationWidget"

metrics:
  duration: "~4 min"
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 9
  files_modified: 2
---

# Phase 10 Plan 02: HotelHomePage shell + TopNav + HeroGallery + HotelIdentity + Footer + router + LegacyBookingPage rename Summary

HotelHomePage Airbnb-style landing shell at `/` and `/booking` with sticky TopNav (5 anchor links), CSS Grid hero gallery (desktop 4-cell / mobile 3-cell), hotel identity block, all 6 anchor sections, sticky reservation sidebar, and feature barrel.

## What Was Built

### Router diff (exact 3 element changes + 1 import added + 1 import removed)

| Line | Before | After |
|------|--------|-------|
| ~62 | `element: <Navigate to="/dashboard" replace />` | `element: <HotelHomePage />` |
| ~81 | `element: <BookingPage />` | `element: <HotelHomePage />` |
| import | `import { BookingPage } from '@/features/public-booking/BookingPage'` | REMOVED |
| import | (new) | `import { HotelHomePage } from '@/features/public-portal'` |

`Navigate` import kept — still used by the `*` wildcard route at the bottom.

### HotelHomePage structure (6 sections + sticky sidebar + mobile bar)

```
<div className="hos min-h-screen bg-warm-white font-body flex flex-col">
  <TopNav />  ← sticky top-0 z-40
  <main className="... max-w-7xl">
    <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-10">  ← NO overflow
      <div className="min-w-0 flex flex-col">
        <section id="inicio" className="scroll-mt-20">            HeroGallery + HotelIdentity
        <section id="habitaciones" className="scroll-mt-20 ...">  RoomsSection
        <section id="concierge" className="scroll-mt-20 ...">     ConciergeTeaser
        <section id="restaurante" className="scroll-mt-20 ...">   RestaurantSection
        <section id="ubicacion" className="scroll-mt-20 ...">     LocationSection
        <section id="resenas" className="scroll-mt-20 ...">       ReviewsSection
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-20">
          <ReservationWidget variant="desktop-sidebar" />
        </div>
      </aside>
    </div>
  </main>
  <PortalFooter />
  <ReservationWidget variant="mobile-bar" />  ← outside grid, renders fixed bottom
</div>
```

Key: `useForceLightTheme()` is the FIRST hook call inside the function body. The `hos` class on the root div ensures CSS variables are scoped even when mounted outside StaffLayout.

### scrollToSection util

```typescript
export function scrollToSection(id: string): void {
  if (id === 'inicio') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

ANCHOR_IDS tuple: `['inicio', 'habitaciones', 'restaurante', 'concierge', 'ubicacion']` (5 items).

### TopNav

- Sticky `top-0 z-40 bg-warm-white/95 backdrop-blur border-b border-warm-line`
- Logo: terracotta H circle + Instrument Serif hotel name (italic on second word)
- 5 nav buttons (`hidden md:flex`) — Concierge calls `onConciergeClick()` (navigates to `/concierge`); others call `onNavClick(id)`
- Mobile: logo + 2 icon buttons (Star, Grid3x3) — nav hidden via `hidden md:flex` already on the nav list

### HeroGallery

CSS-driven dual layout from single JSX tree:

| Breakpoint | Class | Grid | Cells |
|------------|-------|------|-------|
| Desktop (≥1024px) | `hidden lg:grid` | `1.4fr 1fr 1fr` × `220px 220px` | 5 cells (4 images + overlay) |
| Mobile (<1024px) | `grid lg:hidden` | `1.6fr 1fr` × `120px 120px` | 3 cells (2 images + overlay) |

"Ver las N fotos" overlay: `absolute bottom-3 right-3 bg-warm-white text-ink-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-warm-line`. Click is no-op in v1.1 (deferred per CONTEXT).

### HotelIdentity

- H1 `font-display text-3xl lg:text-4xl` — splits hotelName on first space, renders rest in `<i className="italic">`
- Rating row: `Star fill-mustard` + `font-mono` rating + review count + `MapPin text-terracotta` + address
- Tags: inline `<span className="px-3 py-1 rounded-full bg-warm-paper text-ink-2 text-xs border border-warm-line">` — no global hos-pill class

### PortalFooter

Minimal `bg-warm-cream` footer with hotel name (`font-display`), address, phone, copyright. No social icons in v1.1.

### BookingPage → LegacyBookingPage rename

- `git mv` preserves full git blame history
- Export renamed: `BookingPage` → `LegacyBookingPage`
- JSDoc added: `@deprecated`, rollback instructions, v1.2 removal schedule
- NOT mounted in router.tsx — zero routes point to it
- Available for one-commit rollback if needed

### Wave-2 file ownership convention

**10-02 owns `components/index.ts`** — the authoritative barrel. 10-03 and 10-04 create only their own component `.tsx` files; they do not write to the barrel. 10-02 runs after 10-03 and 10-04 (via `depends_on`) so all 10 component files exist when the barrel is written.

`components/index.ts` exports all 10 components:
1. TopNav (10-02)
2. HeroGallery (10-02)
3. HotelIdentity (10-02)
4. PortalFooter (10-02)
5. RoomsSection (10-03)
6. ConciergeTeaser (10-03)
7. RestaurantSection (10-03)
8. LocationSection (10-03)
9. ReviewsSection (10-03)
10. ReservationWidget (10-04)

## Decisions Made

### Decision 1: 10-02 owns components/index.ts (wave-2 ownership convention)

Barrel written only when all sibling component files are confirmed present. This eliminates any race condition between 10-03/10-04 and the barrel writer. 10-02 depends_on both, so it runs last in wave 2.

### Decision 2: hos class on HotelHomePage root div

HotelHomePage mounts outside StaffLayout. StaffLayout normally provides the `.hos` CSS variable scope. Without `.hos` on the root, token utilities (bg-warm-paper, text-ink-1, etc.) resolve to browser defaults. Adding `className="hos ..."` on the root div closes this gap cleanly.

### Decision 3: No overflow on the 2-column grid wrapper

Research Pitfall 1 documented: `overflow: auto/hidden/scroll` on any ancestor of a sticky element creates a new scroll container and breaks `position: sticky`. The grid wrapper `lg:grid-cols-[1fr_400px]` has no overflow class — scroll container remains `<body>`.

### Decision 4: LegacyBookingPage preserved, not deleted

Rollback path for the router change: re-add `import { LegacyBookingPage } from '@/features/public-booking/LegacyBookingPage'` and change the routes back. One commit. The file stays in v1.1 as a safety net; v1.2 cleanup phase removes it.

## Commits

| Hash | Description |
|------|-------------|
| `177fc36` | feat(10-02): create scrollToSection util + TopNav + HeroGallery + HotelIdentity + PortalFooter |
| `f61bbf3` | refactor(10-02): rename BookingPage to LegacyBookingPage |
| `8b08750` | feat(10-02): compose HotelHomePage shell + feature barrel + wire router |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files verified:
- apps/web/src/features/public-portal/HotelHomePage.tsx — FOUND
- apps/web/src/features/public-portal/components/TopNav.tsx — FOUND
- apps/web/src/features/public-portal/components/HeroGallery.tsx — FOUND
- apps/web/src/features/public-portal/components/HotelIdentity.tsx — FOUND
- apps/web/src/features/public-portal/components/PortalFooter.tsx — FOUND
- apps/web/src/features/public-portal/utils/scrollToSection.ts — FOUND
- apps/web/src/features/public-portal/components/index.ts — FOUND
- apps/web/src/features/public-portal/index.ts — FOUND
- apps/web/src/features/public-booking/LegacyBookingPage.tsx — FOUND
- apps/web/src/features/public-booking/BookingPage.tsx — CONFIRMED ABSENT

Commits verified:
- 177fc36 — FOUND (Task 1: 5 shell components)
- f61bbf3 — FOUND (rename BookingPage → LegacyBookingPage)
- 8b08750 — FOUND (HotelHomePage + barrel + router)

TypeScript: `pnpm tsc --noEmit` → exit 0
No hex colors: `rg "#[0-9a-fA-F]{3,6}" apps/web/src/features/public-portal/` → 0 matches
useForceLightTheme first in body: confirmed
6 section ids in HotelHomePage: confirmed
hos class on root container: confirmed
LegacyBookingPage exports LegacyBookingPage: confirmed
Router has HotelHomePage at / and /booking: confirmed

## Self-Check: PASSED
