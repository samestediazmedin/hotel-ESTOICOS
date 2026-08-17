---
phase: 12-public-data-api-frontend-wiring
plan: "03"
subsystem: frontend/public-portal
tags: [tanstack-query, hooks, api-client, types, public-portal]
dependency_graph:
  requires: [12-01]
  provides: [public-portal data layer for 12-04]
  affects: [apps/web/src/features/public-portal/hooks/, apps/web/src/features/public-portal/types.ts]
tech_stack:
  added: []
  patterns:
    - TanStack Query useQuery with placeholderData for graceful degradation
    - Axios API client object mirroring reporting.api.ts pattern
    - Field name mapping: backend name/address → frontend hotelName/hotelAddress
key_files:
  created:
    - apps/web/src/features/public-portal/public-portal.api.ts
    - apps/web/src/features/public-portal/hooks/useRoomTypes.ts
    - apps/web/src/features/public-portal/hooks/useHotelPhotos.ts
  modified:
    - apps/web/src/features/public-portal/hooks/useHotelInfo.ts
    - apps/web/src/features/public-portal/types.ts
    - apps/web/src/features/public-portal/data/hotel.ts
decisions:
  - "retry: 2 chosen over default retry: 3 — public portal reads cached data; 2 retries sufficient before placeholderData takes over"
  - "RoomTypeCard completely reshaped: removed thumbnail/amenities/pricePerNight; added photos[]/description/basePrice to match Phase 12-02 API payload"
  - "HOTEL_INFO_FALLBACK phone field set to '+57 (1) 555-0100' (matching existing PortalFooter hardcoded value)"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
---

# Phase 12 Plan 03: TanStack Query Hooks for Public Portal Data — Summary

TanStack Query data layer for the public portal: `public-portal.api.ts` client + 3 hooks (`useHotelInfo` rewrite, `useRoomTypes`, `useHotelPhotos`) each with `staleTime: 60_000`, `placeholderData` fallback, and `retry: 2`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create public-portal.api.ts + update types + demote data/hotel.ts | `6488135` | public-portal.api.ts (new), types.ts, data/hotel.ts |
| 2 | Rewrite useHotelInfo + create useRoomTypes + useHotelPhotos | `7753d83` | useHotelInfo.ts, useRoomTypes.ts (new), useHotelPhotos.ts (new) |

## Must-Haves Verification

| Criterion | Status |
|-----------|--------|
| useHotelInfo returns UseQueryResult<HotelInfo> with placeholderData always defined | PASS |
| useRoomTypes returns array of RoomTypeCard with capacity as number and badge: string \| null | PASS |
| useHotelPhotos returns array of Photo with displayOrder for server-side sort | PASS |
| All 3 hooks use queryKey ['public', '...'] | PASS |
| All 3 hooks have staleTime: 60_000 (matches backend Cache-Control max-age=60) | PASS |
| All 3 hooks have placeholderData fallback | PASS |
| lib/api.ts NOT modified (git diff empty) | PASS |
| HotelInfo type has optional phone field | PASS |
| RoomTypeCard.capacity type is number (was string) | PASS |

## TypeScript Errors in Consumers (Expected — Handed to 12-04)

`pnpm --filter web tsc --noEmit` exits with errors in consumers that are NOT in scope for this plan:

```
src/features/public-portal/HotelHomePage.tsx(27,30): error TS2339: Property 'hotelName' does not exist on type 'UseQueryResult<HotelInfo, Error>'
src/features/public-portal/HotelHomePage.tsx(39,30): error TS2322: Type 'UseQueryResult<HotelInfo, Error>' is not assignable to type 'HotelInfo'
src/features/public-portal/components/RoomsSection.tsx: thumbnail, amenities, pricePerNight missing from new RoomTypeCard shape
src/features/public-portal/components/ReservationWidget.tsx: pricePerNight missing from new RoomTypeCard shape
src/features/public-portal/data/roomTypes.ts: capacity string vs number (file deleted in 12-05)
```

These are **expected breaking changes** introduced by the `RoomTypeCard` interface reshape and `useHotelInfo` return type change. They are 12-04 territory (component wiring) and 12-05 territory (data module cleanup).

## Fallback Values

| Hook | Fallback Source | Entries |
|------|----------------|---------|
| useHotelInfo | `HOTEL_INFO_FALLBACK` imported from `data/hotel.ts` | Single HotelInfo object — string values preserved verbatim from v1.1 |
| useRoomTypes | `ROOM_TYPES_FALLBACK` in-file constant | 4 entries matching data/roomTypes.ts names/prices; photos:[] (fallback only) |
| useHotelPhotos | `HOTEL_PHOTOS_FALLBACK` in-file constant | 5 Unsplash URLs verbatim from data/photos.ts v1.1 |

## lib/api.ts Integrity Confirmation

`git diff apps/web/src/lib/api.ts` produces empty output. The existing axios instance with its Phase 10 EARLY EXIT refresh-loop fix is byte-identical to the state before this plan ran.

## Key Decisions

1. **retry: 2 over default retry: 3** — The public portal renders `placeholderData` on failure; 2 retries is sufficient before graceful degradation kicks in. Reduces unnecessary network noise on cold-start API.

2. **RoomTypeCard completely reshaped** — The existing interface (`thumbnail`, `amenities`, `pricePerNight`, `badge` as string literal union) was incompatible with the Phase 12-02 API payload (`photos[]`, `description`, `basePrice`, `badge: string | null`). A clean replacement was chosen over adding a parallel type, since 12-04 updates all consumers and 12-05 deletes the old data modules.

3. **`data/hotel.ts` preserved as fallback module** (not deleted) — The plan specifies it becomes fallback-only; deletion is deferred to 12-05 with the other data modules.

4. **Phone fallback value** — Set to `'+57 (1) 555-0100'` matching the existing hardcoded value in `PortalFooter.tsx`, ensuring zero visible change when API is unavailable.

## Deviations from Plan

None — plan executed exactly as written. Consumer TypeScript errors are documented above and explicitly anticipated by the plan's acceptance criteria.

## Self-Check: PASSED

Files exist:
- `apps/web/src/features/public-portal/public-portal.api.ts` — FOUND
- `apps/web/src/features/public-portal/hooks/useRoomTypes.ts` — FOUND
- `apps/web/src/features/public-portal/hooks/useHotelPhotos.ts` — FOUND

Commits exist:
- `6488135` — FOUND (feat(12-03): create public-portal.api.ts + update types + demote data/hotel.ts)
- `7753d83` — FOUND (feat(12-03): add useRoomTypes + useHotelPhotos; rewrite useHotelInfo to TanStack Query)

Hooks import no deleted data modules: confirmed (grep returns zero matches for `data/roomTypes` or `data/photos` imports in hooks/).
