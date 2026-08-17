---
phase: 10-public-portal
plan: 01
subsystem: frontend/public-portal
tags: [data, hooks, types, env-vars, foundation]
requirements: [PUB-07, PUB-12]

dependency-graph:
  requires: []
  provides:
    - apps/web/src/features/public-portal/data — hardcoded content importable by Wave 2
    - apps/web/src/features/public-portal/hooks — three hooks consumed by HotelHomePage
    - apps/web/src/features/public-portal/types.ts — shared TypeScript interfaces
  affects:
    - Wave 2 plans (10-02 through 10-06) — all consume data/* and hooks/*

tech-stack:
  added: []
  patterns:
    - URL-param-backed state (useSearchParams from react-router-dom v7)
    - Vite env var with ?? fallback pattern for hotel identity
    - data-theme force-light on mount / restore on unmount

key-files:
  created:
    - apps/web/src/features/public-portal/types.ts
    - apps/web/src/features/public-portal/data/hotel.ts
    - apps/web/src/features/public-portal/data/roomTypes.ts
    - apps/web/src/features/public-portal/data/reviews.ts
    - apps/web/src/features/public-portal/data/photos.ts
    - apps/web/src/features/public-portal/data/index.ts
    - apps/web/src/features/public-portal/hooks/useHotelInfo.ts
    - apps/web/src/features/public-portal/hooks/useReservationDraft.ts
    - apps/web/src/features/public-portal/hooks/useForceLightTheme.ts
    - apps/web/public/hotel-photos/.gitkeep
    - apps/web/.env.example
  modified: []

decisions:
  - "useHotelInfo reads VITE_HOTEL_NAME/VITE_HOTEL_ADDRESS with ?? fallback to Hotel Sumapaz / La Candelaria Bogota (Option B from research — zero API dependency, frontend-only v1.1 scope)"
  - "Photos hosted on Unsplash CDN (no local files in v1.1) — URLs point to photo-1555396273, photo-1566073771, photo-1631049307, photo-1414235077, photo-1504280390"
  - "URL param keys confirmed: checkIn/checkOut/adults — exact match with BookingResultsPage lines 90-92, zero downstream changes required"
  - "useForceLightTheme stores prev data-theme before removing; restores on unmount without touching localStorage"
  - "ROOM_TYPES[0] (Doble Estandar $280k) is getCheapestRoom() — used by widget default price display"

metrics:
  duration: "~25 min"
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 11
  files_modified: 0
---

# Phase 10 Plan 01: Data + Hooks + Types + .env.example Summary

Wave 1 foundation for Phase 10 public portal — hardcoded content modules + three React hooks using Vite env vars and URL params.

## What Was Built

All exports required by Wave 2 plans are in place. No UI components yet — this plan is pure data, types, and hooks.

### TypeScript Interfaces (`types.ts`)

```typescript
export interface HotelInfo     { hotelName, hotelAddress, tagline, description, rating, reviewCount, tags }
export interface RoomTypeCard  { id, name, capacity, pricePerNight, badge?, thumbnail, amenities }
export interface Review        { id, authorName, authorInitial, date, rating, comment }
export interface Photo         { url, alt }
```

### Data Modules (`data/`)

| File | Export | Key details |
|------|--------|-------------|
| `hotel.ts` | `HOTEL_INFO_FALLBACK: HotelInfo` | rating 4.84, 318 reviews, 4 tags |
| `roomTypes.ts` | `ROOM_TYPES: RoomTypeCard[]` + `getCheapestRoom()` | 4 types: Doble Estandar($280k) · Doble Deluxe($380k) · Familiar($520k) · Suite Andina($720k) |
| `reviews.ts` | `REVIEWS: Review[]` | 5 entries, Spanish names, Jan-May 2026 |
| `photos.ts` | `PHOTOS: Photo[]` | 5 Unsplash CDN URLs (1600px, q80) |
| `index.ts` | barrel re-export | `export * from './hotel'` × 4 |

### Hooks (`hooks/`)

**`useHotelInfo()`** — synchronous, no async. Returns full `HotelInfo` merging env vars over fallback constant.

```typescript
import.meta.env.VITE_HOTEL_NAME    // overrides hotelName if set
import.meta.env.VITE_HOTEL_ADDRESS // overrides hotelAddress if set
// all other fields (tagline, description, tags, rating, reviewCount) from HOTEL_INFO_FALLBACK
```

**`useReservationDraft()`** — URL-param-backed state. Exposes `{ draft, setDates, setAdults, commit, canCommit }`.

```
commit() → navigate('/booking/rooms?checkIn=X&checkOut=Y&adults=N')
```

URL param contract confirmed matches `BookingResultsPage.tsx` lines 90-92 exactly.

**`useForceLightTheme()`** — single `useEffect`, runs once on mount.

```
mount  → document.documentElement.removeAttribute('data-theme')
unmount → if (prev) setAttribute('data-theme', prev)
```

### `.env.example`

```
VITE_HOTEL_NAME=Hotel Sumapaz
VITE_HOTEL_ADDRESS=La Candelaria, Bogota
```

## Decisions Made

### Decision 1: Env-var hook (Option B) over API fetch

Research confirmed `useSystemConfig` does NOT exist in the codebase. CONTEXT.md stated it "already exists" — this was incorrect. Two options existed:

- Option A: Create `useQuery` hook calling `/api/config`
- **Option B (chosen):** Read `import.meta.env.VITE_HOTEL_NAME/ADDRESS` with fallback

Option B chosen because: (a) Phase 10 scope is frontend-only — no new backend dependencies, (b) single hotel deployment means env vars are set once at Railway deploy time, (c) zero loading states / no async complexity for a synchronous value.

### Decision 2: Unsplash CDN for photos (no local downloads)

Photos point to `https://images.unsplash.com/photo-{ID}?w=1600&q=80&auto=format&fit=crop`. No local files needed for v1.1. The `public/hotel-photos/.gitkeep` directory is staged for v1.2 when R2 integration lands.

### Decision 3: URL params over zustand for reservation draft

URL params persist on refresh, are shareable as links, and have zero store setup. The `useSearchParams` pattern from react-router-dom v7 is already used in the codebase. Zustand would add unnecessary indirection for what is effectively ephemeral navigation state.

## URL Param Contract Verification

`BookingResultsPage.tsx` lines 90-92 (confirmed):
```typescript
const checkIn  = searchParams.get('checkIn') ?? '';
const checkOut = searchParams.get('checkOut') ?? '';
const adults   = parseInt(searchParams.get('adults') ?? '2', 10);
```

`useReservationDraft.commit()` produces:
```
/booking/rooms?checkIn=${draft.checkIn}&checkOut=${draft.checkOut}&adults=${draft.adults}
```

Keys match exactly. Zero changes to `BookingResultsPage.tsx` required.

## Commits

| Hash | Description |
|------|-------------|
| `17bf439` | feat(10-01): create TypeScript types + hardcoded data modules for public portal |
| `888d8dc` | feat(10-01): create three public-portal hooks + .env.example |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files verified:
- apps/web/src/features/public-portal/types.ts — FOUND
- apps/web/src/features/public-portal/data/hotel.ts — FOUND
- apps/web/src/features/public-portal/data/roomTypes.ts — FOUND
- apps/web/src/features/public-portal/data/reviews.ts — FOUND
- apps/web/src/features/public-portal/data/photos.ts — FOUND
- apps/web/src/features/public-portal/data/index.ts — FOUND
- apps/web/src/features/public-portal/hooks/useHotelInfo.ts — FOUND
- apps/web/src/features/public-portal/hooks/useReservationDraft.ts — FOUND
- apps/web/src/features/public-portal/hooks/useForceLightTheme.ts — FOUND
- apps/web/public/hotel-photos/.gitkeep — FOUND
- apps/web/.env.example — FOUND

TypeScript: `pnpm tsc --noEmit` → exit 0
No hex colors: `rg "#[0-9a-fA-F]{3,6}"` → 0 matches

## Self-Check: PASSED
