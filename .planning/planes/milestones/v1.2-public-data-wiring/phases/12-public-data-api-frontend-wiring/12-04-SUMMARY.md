---
phase: 12-public-data-api-frontend-wiring
plan: "04"
subsystem: frontend/public-portal
tags: [tanstack-query, skeletons, error-banner, wiring, public-portal]
dependency_graph:
  requires: [12-02, 12-03]
  provides: [fully-wired public portal UI for 12-05 cleanup]
  affects:
    - apps/web/src/features/public-portal/HotelHomePage.tsx
    - apps/web/src/features/public-portal/components/skeletons.tsx
    - apps/web/src/features/public-portal/components/RoomsSection.tsx
    - apps/web/src/features/public-portal/components/PortalFooter.tsx
    - apps/web/src/features/public-portal/components/HeroGallery.tsx
    - apps/web/src/features/public-portal/components/ReservationWidget.tsx
    - apps/web/src/features/public-portal/data/roomTypes.ts
    - apps/web/src/features/public-portal/HotelHomePage.test.tsx
tech_stack:
  added: []
  patterns:
    - "Strategy A (prop-drilling): HotelHomePage calls hooks, destructures data, passes to dumb section components"
    - "TanStack Query deduplication: hooks called in HotelHomePage + skeletons render inline — zero extra network requests"
    - "placeholderData guarantees data is always defined — no ternary needed for section render, only isPending check"
    - "Error banner placement: above 2-col grid inside <main>, not replacing content — fallback still renders below"
    - "QueryClientProvider in test wrapper: placeholderData makes tests fully synchronous without mocking"
key_files:
  created:
    - apps/web/src/features/public-portal/components/skeletons.tsx
  modified:
    - apps/web/src/features/public-portal/HotelHomePage.tsx
    - apps/web/src/features/public-portal/components/RoomsSection.tsx
    - apps/web/src/features/public-portal/components/PortalFooter.tsx
    - apps/web/src/features/public-portal/components/HeroGallery.tsx
    - apps/web/src/features/public-portal/components/ReservationWidget.tsx
    - apps/web/src/features/public-portal/data/roomTypes.ts
    - apps/web/src/features/public-portal/HotelHomePage.test.tsx
decisions:
  - "Strategy A chosen: HotelHomePage orchestrates, sections stay dumb — minimum blast radius, Phase 10 test structure preserved"
  - "Error banner positioned above 2-col grid inside <main> (not replacing content) — placeholderData renders below so portal never breaks completely"
  - "HeroGallerySkeleton: desktop and mobile grids both present (hidden lg:grid / grid lg:hidden) matching real HeroGallery breakpoints"
  - "RoomsSection: badge comparison changed from 'mejor-valor' string literal to 'Mejor valor' (Phase 12 API returns free string, not old union)"
  - "data/roomTypes.ts: fixed types to compile (deprecated placeholder; full deletion deferred to 12-05 as planned)"
  - "ReservationWidget: migrated getCheapestRoom() → useRoomTypes() + Math.min over basePrice array; price label shows 'Desde —' while loading"
  - "HotelHomePage.test.tsx: added QueryClientProvider wrapper; retry:false in test QueryClient; placeholderData makes all assertions synchronous"
metrics:
  duration_minutes: 20
  completed_date: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 7
---

# Phase 12 Plan 04: Skeletons + HotelHomePage Orchestration + Error Banner — Summary

Strategy A prop-drilling wiring: HotelHomePage orchestrates 3 TanStack Query hooks, renders skeleton/content conditionally, shows inline error banner with `invalidateQueries` retry. Section components stay dumb.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create skeletons.tsx — HeroGallery, HotelIdentity, RoomsSection | `3d62b44` | skeletons.tsx (new) |
| 2 | Wire HotelHomePage + adapt all section consumers | `2e6ce39` | HotelHomePage.tsx, RoomsSection.tsx, PortalFooter.tsx, HeroGallery.tsx, ReservationWidget.tsx, roomTypes.ts, HotelHomePage.test.tsx |

## Must-Haves Verification

| Criterion | Status |
|-----------|--------|
| HotelHomePage orchestrates 3 queries (useHotelInfo, useRoomTypes, useHotelPhotos) | PASS |
| HeroGallery renders HeroGallerySkeleton while photos are pending | PASS |
| HotelIdentity renders HotelIdentitySkeleton while info is pending | PASS |
| RoomsSection renders RoomsSectionSkeleton while rooms are pending | PASS |
| PortalFooter uses hotelInfo.phone with '+57 (1) 555-0100' fallback | PASS |
| RoomTypeCard renders capacity as `${capacity} personas` (number) | PASS |
| Error state renders inline banner with bg-terracotta-tint and Reintentar button | PASS |
| Reintentar button calls queryClient.invalidateQueries({ queryKey: ['public'] }) | PASS |
| Hardcoded '+57 (1) 555-0100' literal removed from PortalFooter (now behind ??) | PASS |
| pnpm --filter web tsc --noEmit exits 0 | PASS |
| pnpm --filter web vitest run — all 11 Phase 10 tests pass | PASS |

## Strategy Chosen

**Strategy A — prop-drilling.** HotelHomePage calls the 3 hooks, destructures `data`, and passes resolved arrays/objects as props to section components. Sections remain stateless/dumb. This was the recommended approach in the plan and proved correct:

- Zero blast radius to section component unit tests
- `isPending` check stays at the orchestration layer — clear separation
- `placeholderData` on all hooks means `data` is never `undefined`, so no null-guard verbosity in sections

## Skeleton Grid Values

The skeleton grid values exactly mirror `HeroGallery.tsx`'s inline `style` props:

| Skeleton | gridTemplateColumns | gridTemplateRows |
|----------|--------------------|-|
| HeroGallerySkeleton (desktop) | `1.4fr 1fr 1fr` | `220px 220px` |
| HeroGallerySkeleton (mobile) | `1.6fr 1fr` | `120px 120px` |
| RoomsSectionSkeleton | `md:grid-cols-2` (Tailwind) | fluid |

## Error Banner Placement

The error banner renders **above the 2-column content grid inside `<main>`**, not above the TopNav and not replacing any section. This means:

1. TopNav still renders (user can navigate away)
2. `placeholderData` renders in all sections below the banner
3. "Reintentar" invalidates `['public']` queryKey — covers all 3 portal queries in one call

## Phase 10 Tests — Zero Adjustments Needed to Assertions

The only change to `HotelHomePage.test.tsx` was wrapping the render with `QueryClientProvider`. No test assertions changed. The `placeholderData` fallbacks in all 3 hooks ensure sections render synchronously with fallback data — tests that look for hotel name, section IDs, and navigation labels all find them immediately without async `waitFor`.

## ReservationWidget Migration

`getCheapestRoom()` (returning the first hardcoded `ROOM_TYPES` entry) was replaced by:
```tsx
const roomsQuery = useRoomTypes();
const cheapestPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.basePrice)) : 0;
```
The `placeholderData` in `useRoomTypes` guarantees `rooms` always has 4 entries — so `cheapestPrice` is always `280000` on first render, identical behavior to the old hardcoded approach.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed data/roomTypes.ts type mismatch**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** `data/roomTypes.ts` still had `capacity: '2 personas'` (string) after `RoomTypeCard.capacity` was changed to `number` in 12-03. This caused 4 TypeScript errors blocking `tsc --noEmit`.
- **Fix:** Updated `data/roomTypes.ts` entries to use `capacity: 2` (number) and replaced `pricePerNight`/`thumbnail`/`amenities` with `basePrice`/`photos`/`description`. Added `@deprecated` JSDoc. Full deletion deferred to 12-05 as planned.
- **Files modified:** `apps/web/src/features/public-portal/data/roomTypes.ts`
- **Commit:** `2e6ce39`

**2. [Rule 2 - Missing functionality] Added QueryClientProvider to HotelHomePage.test.tsx**
- **Found during:** Task 2 (test regression check)
- **Issue:** `HotelHomePage` now calls `useQueryClient()` — tests crashed with "No QueryClient set" error.
- **Fix:** Wrapped `renderPage()` helper with `QueryClientProvider` using a per-test `QueryClient` with `retry: false`. Zero assertion changes — `placeholderData` keeps tests synchronous.
- **Files modified:** `apps/web/src/features/public-portal/HotelHomePage.test.tsx`
- **Commit:** `2e6ce39`

## Self-Check: PASSED

Files exist:
- `apps/web/src/features/public-portal/components/skeletons.tsx` — FOUND
- `apps/web/src/features/public-portal/HotelHomePage.tsx` — FOUND

Commits exist:
- `3d62b44` — FOUND (feat(12-04): create portal skeletons)
- `2e6ce39` — FOUND (refactor(12-04): wire HotelHomePage to TanStack Query hooks)

TypeScript: `pnpm --filter web exec tsc --noEmit` exits 0
Tests: 11/11 passing — 3 test files in `src/features/public-portal/`
