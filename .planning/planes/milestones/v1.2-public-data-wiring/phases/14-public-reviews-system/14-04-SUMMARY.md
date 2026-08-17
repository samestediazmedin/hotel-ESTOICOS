---
phase: 14-public-reviews-system
plan: "04"
subsystem: frontend
tags: [reviews, tanstack-query, skeleton, public-portal, react]
dependency_graph:
  requires:
    - apps/web/src/features/public-portal/public-portal.api.ts
    - apps/web/src/features/public-portal/types.ts
    - apps/web/src/features/public-portal/hooks/useHotelInfo.ts (pattern reference)
    - apps/web/src/features/public-portal/components/skeletons.tsx
    - 14-01-SUMMARY.md (GET /api/public/reviews endpoint shape confirmed)
  provides:
    - hooks/useReviews.ts (TanStack Query, keepPreviousData, queryKey ['public','reviews',{page,limit}])
    - ReviewsSection.tsx (self-contained, pagination, empty state, skeleton)
    - ReviewsSectionSkeleton (header + 3 card placeholders)
    - fetchPublicReviews in public-portal.api.ts
  affects:
    - apps/web/src/features/public-portal/HotelHomePage.tsx (REVIEWS import removed, ReviewsSection prop-less)
    - apps/web/src/features/public-portal/types.ts (ApiReview + PublicReviewsResponse added)
    - apps/web/src/features/public-portal/data/index.ts (reviews re-export removed)
tech_stack:
  added:
    - keepPreviousData from @tanstack/react-query (smooth pagination)
  patterns:
    - Self-contained section component — query lives inside component, no prop drilling
    - Derive display fields from API shape (initial from guestName, date from publishedAt via toLocaleDateString)
    - Skeleton only on isPending && !data (keepPreviousData keeps data defined on page transitions)
key_files:
  created:
    - apps/web/src/features/public-portal/hooks/useReviews.ts (35 lines)
  modified:
    - apps/web/src/features/public-portal/components/ReviewsSection.tsx (rewritten — 90 lines)
    - apps/web/src/features/public-portal/components/skeletons.tsx (ReviewsSectionSkeleton added — +65 lines)
    - apps/web/src/features/public-portal/public-portal.api.ts (fetchPublicReviews added)
    - apps/web/src/features/public-portal/types.ts (ApiReview + PublicReviewsResponse added)
    - apps/web/src/features/public-portal/HotelHomePage.tsx (REVIEWS import removed, ReviewsSection prop-less)
    - apps/web/src/features/public-portal/data/index.ts (reviews re-export removed)
  deleted:
    - apps/web/src/features/public-portal/data/reviews.ts (5 hardcoded reviews — replaced by API)
decisions:
  - "ReviewsSection is now self-contained — query + page state live inside the component, no props required. Eliminates prop drilling from HotelHomePage and keeps ReviewsSection encapsulated."
  - "keepPreviousData (not a static fallback) chosen for reviews — pagination means there is no meaningful static fallback for page 2+; keepPreviousData shows old page while next loads, preventing flash."
  - "ApiReview shape differs from existing Review type — added ApiReview + PublicReviewsResponse to types.ts; display fields (authorInitial, date) derived inline in ReviewCard rather than stored in Review type."
  - "Skeleton shown only when isPending && !data — keepPreviousData means data is defined on page transitions, so skeleton never flashes between pages."
  - "data/reviews.ts deleted in same commit as ReviewsSection rewire — avoids orphan file that would compile but be unused."
metrics:
  duration_minutes: 20
  completed_date: "2026-05-18"
  tasks_completed: 8
  files_created: 1
  files_modified: 6
  files_deleted: 1
---

# Phase 14 Plan 04: ReviewsSection Rewire + Skeleton Summary

One-liner: ReviewsSection rewritten as self-contained TanStack Query component (useReviews hook, keepPreviousData pagination, empty state, ReviewsSectionSkeleton) — hardcoded data/reviews.ts deleted atomically.

## What Was Built

### Task 1 — Type Extensions (types.ts)

Added two new interfaces to match the backend endpoint shape from Plan 14-01:

- `ApiReview` — raw shape from `GET /api/public/reviews`: `{id, guestName, rating, comment, stayDate, publishedAt}`
- `PublicReviewsResponse` — paginated envelope: `{reviews, total, averageRating, pages}`

The existing `Review` interface was left intact (used by other consumers if any) but is no longer consumed by ReviewsSection directly.

### Task 2 — API Extension (public-portal.api.ts)

Added `fetchPublicReviews(page, limit)` to `publicPortalApi`:
- `GET /api/public/reviews?page&limit`
- Returns `Promise<PublicReviewsResponse>`
- Defaults: page=1, limit=10

### Task 3 — useReviews hook

`hooks/useReviews.ts`:
- `queryKey: ['public', 'reviews', { page, limit }]`
- `staleTime: 60_000` — mirrors backend Cache-Control: public, max-age=60
- `placeholderData: keepPreviousData` — smooth pagination, no flash between pages
- `retry: 2`
- Returns `UseQueryResult<PublicReviewsResponse, Error>`

### Task 4 — ReviewsSectionSkeleton (skeletons.tsx)

Added before `RoomsSectionSkeleton` to maintain logical section order:
- Header placeholder: star circle + wide bar + count bar
- 3 card placeholders in 1/2/3-col grid — each has avatar circle, name/date lines, 5 star squares, 3 comment lines
- All using `bg-warm-cream animate-pulse` tokens — no hex, no palette colors

### Task 5 — ReviewsSection rewrite

Self-contained component, zero props:
- `useState(1)` for `page`
- `useReviews({ page, limit: 10 })`
- Skeleton: only when `isPending && !data` (first load — keepPreviousData means `data` is defined on subsequent pages)
- Empty state: terracotta-tint card with "Aún no hay reseñas publicadas" when `total === 0`
- Card grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — added lg breakpoint vs old 2-col
- "Ver más reseñas" Button (outline variant) visible when `page < pages`, disabled while `isFetching`
- `ReviewCard` subcomponent derives `authorInitial` from `guestName.charAt(0)` and `dateLabel` from `publishedAt` via `toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })`

### Task 6 — HotelHomePage cleanup

- Removed `import { REVIEWS } from './data'`
- Changed `<ReviewsSection reviews={REVIEWS} rating={...} reviewCount={...} />` → `<ReviewsSection />`
- No skeleton wrapper needed in HotelHomePage — ReviewsSection handles its own skeleton internally

### Task 7 — data/index.ts cleanup

Removed `export * from './reviews'` line. Added Phase 14 comment documenting the removal.

### Task 8 — Delete data/reviews.ts

File deleted atomically in the same commit as the ReviewsSection rewire — no orphan window.

## Test Results

```
Test Files  3 passed (3)
     Tests  11 passed (11)
  Duration  3.36s
```

All 11 existing tests pass. No test mocks needed updating — the existing test files (`useForceLightTheme.test.tsx`, `useReservationDraft.test.tsx`, plus one more) do not reference ReviewsSection or data/reviews.ts.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: `apps/web/src/features/public-portal/hooks/useReviews.ts`
- FOUND: `apps/web/src/features/public-portal/components/ReviewsSection.tsx`
- FOUND: `apps/web/src/features/public-portal/components/skeletons.tsx` (ReviewsSectionSkeleton added)
- FOUND: `apps/web/src/features/public-portal/public-portal.api.ts` (fetchPublicReviews added)
- FOUND: `apps/web/src/features/public-portal/types.ts` (ApiReview + PublicReviewsResponse)
- FOUND: `apps/web/src/features/public-portal/HotelHomePage.tsx` (REVIEWS removed, prop-less ReviewsSection)
- CONFIRMED DELETED: `apps/web/src/features/public-portal/data/reviews.ts`

Commit verified:
- FOUND: `112edd4` refactor(14-04): rewire ReviewsSection to TanStack Query + delete hardcoded reviews data + add ReviewsSectionSkeleton

Verification:
- `npx tsc --noEmit` → exit 0 (no output)
- `npx vitest run src/features/public-portal/` → 3 files, 11 tests, all passed
