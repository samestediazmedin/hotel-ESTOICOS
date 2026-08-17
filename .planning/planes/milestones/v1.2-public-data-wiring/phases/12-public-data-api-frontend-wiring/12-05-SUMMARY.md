---
phase: 12-public-data-api-frontend-wiring
plan: "05"
subsystem: frontend/public-portal
tags: [cleanup, dead-code, regression-gate, public-portal]
dependency_graph:
  requires: [12-04]
  provides: [clean codebase — no dead data modules, Phase 12 closeout]
  affects:
    - apps/web/src/features/public-portal/data/roomTypes.ts (DELETED)
    - apps/web/src/features/public-portal/data/photos.ts (DELETED)
    - apps/web/src/features/public-booking/LegacyBookingPage.tsx (DELETED)
    - apps/web/src/features/public-portal/data/index.ts (updated — stripped roomTypes + photos)
tech_stack:
  added: []
  patterns:
    - "git rm for tracked file deletion — preserves history"
    - "Barrel update: keep hotel + reviews, strip deleted modules"
key_files:
  created: []
  modified:
    - apps/web/src/features/public-portal/data/index.ts
  deleted:
    - apps/web/src/features/public-portal/data/roomTypes.ts
    - apps/web/src/features/public-portal/data/photos.ts
    - apps/web/src/features/public-booking/LegacyBookingPage.tsx
decisions:
  - "data/index.ts was updated (not deleted) — HotelHomePage.tsx imports REVIEWS from it; reviews.ts is Phase 14 scope and must survive"
  - "public-booking/ directory kept — contains BookingFormPage, BookingResultsPage, BookingConfirmationPage, public-booking.api.ts"
  - "Hex sanity check passed — zero raw hex colors in public-portal feature after Phase 12 changes"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-18"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 1
  files_deleted: 3
---

# Phase 12 Plan 05: Delete Legacy Data Modules + Regression Gate (PDA-08) — Summary

Pure deletion plan: 3 dead hardcoded data files and 1 orphaned component removed after 12-04 confirmed zero external consumers. Full regression suite (tsc + vitest) passes green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Pre-flight import audit | (no commit — audit only) | — |
| 2 | Delete files + update data/index.ts barrel | `fb88532` | roomTypes.ts (del), photos.ts (del), LegacyBookingPage.tsx (del), index.ts (mod) |
| 3 | Full regression gate — tsc + vitest + hex sanity | (no new commit — gate passed on fb88532) | — |

## Pre-Flight Audit Results (Task 1)

All 6 audits passed. Safe-to-delete confirmed:

| Audit | Command | Result |
|-------|---------|--------|
| 1. Importers of data/roomTypes | `rg "from.*data/roomTypes" apps/web/src` | ZERO matches |
| 2. Importers of data/photos | `rg "from.*data/photos" apps/web/src` | ZERO matches |
| 3. Importers of data barrel | `rg "from.*\/data['\"]" apps/web/src` | 1 match: HotelHomePage.tsx — imports `REVIEWS` only (safe) |
| 4. LegacyBookingPage imports | `rg "LegacyBookingPage" apps/web/src` | Only self-declaration in the file being deleted |
| 5. ROOM_TYPES / PHOTOS named exports | `rg "(ROOM_TYPES\|PHOTOS)" apps/web/src` | Only inside the files being deleted |
| 6. Test dir references | `rg "(roomTypes\|photos)" src/features/public-portal/__tests__` | No matches (no __tests__ dir) |

Notable finding: `HotelHomePage.tsx` imports `{ REVIEWS }` from `'./data'` — this is `reviews.ts` scope (Phase 14), unrelated to the deleted modules. The barrel was updated to keep `hotel` and `reviews` exports.

## Deletion Confirmation

Files deleted via `git rm` (history preserved):

```
D  apps/web/src/features/public-booking/LegacyBookingPage.tsx
D  apps/web/src/features/public-portal/data/photos.ts
D  apps/web/src/features/public-portal/data/roomTypes.ts
```

`data/index.ts` final content after cleanup:
```typescript
export * from './hotel';
export * from './reviews';
// Phase 12: roomTypes and photos modules removed — data now comes from
// useRoomTypes() and useHotelPhotos() hooks against the public API.
```

`data/hotel.ts` preserved — still used as `HOTEL_INFO_FALLBACK` in `useHotelInfo` placeholderData.
`data/reviews.ts` preserved — Phase 14 scope; `REVIEWS` still consumed by ReviewsSection via HotelHomePage.

## Regression Suite Results (Task 3)

All automated gates: PASSED.

| Gate | Command | Result |
|------|---------|--------|
| Backend tsc | `pnpm --filter api exec tsc --noEmit` | Exit 0 |
| Frontend tsc | `pnpm --filter web exec tsc --noEmit` | Exit 0 |
| Frontend vitest (Phase 10 regression) | `pnpm --filter web exec vitest run src/features/public-portal/` | 11/11 tests, 3 files — PASS |
| Backend vitest (Phase 12 service) | `pnpm --filter api exec vitest run src/modules/public-portal/` | 17/17 tests, 1 file — PASS |
| Hex token sanity | `rg "#[0-9a-fA-F]{3,6}" apps/web/src/features/public-portal` | ZERO matches |

## Manual QA Checklist (Pending — Requires Running Servers)

The following steps require `pnpm --filter api dev` + `pnpm --filter web dev` running locally:

```bash
# 1. Start servers
pnpm --filter api dev   # → http://localhost:3011
pnpm --filter web dev   # → http://localhost:5173

# 2. Public endpoints — expect 200 + Cache-Control: public, max-age=60
curl -i http://localhost:3011/api/public/hotel-info
curl -i http://localhost:3011/api/public/room-types
curl -i http://localhost:3011/api/public/hotel-photos

# 3. Browser — http://localhost:5173/booking
#    - Hero gallery renders with real photos (not Unsplash fallback)
#    - HotelIdentity: name + tagline + 4 tag pills from DB
#    - RoomsSection: 4 cards, first badge = "Más económica" (API-computed)
#    - PortalFooter: phone number from DB

# 4. Vertical-slice demo
#    - Open /rooms as admin → edit Doble Estándar basePrice → 295000 → save
#    - Refresh /booking after 60s → confirm new price visible in RoomsSection card
```

Expected Phase 12 acceptance criteria:
- 3 endpoints return 200 without Authorization header
- Admin price edit reflects in portal within 60s (TanStack Query staleTime = 60s)
- Skeleton briefly visible on first load, then real data
- Error banner appears if API unreachable (test by stopping API server)

## Must-Haves Verification

| Criterion | Status |
|-----------|--------|
| `data/roomTypes.ts` does not exist | PASS |
| `data/photos.ts` does not exist | PASS |
| `LegacyBookingPage.tsx` does not exist | PASS |
| `data/index.ts` has no roomTypes or photos re-exports | PASS |
| Zero imports of deleted modules remain (rg) | PASS |
| `pnpm --filter web exec tsc --noEmit` exits 0 | PASS |
| `pnpm --filter api exec tsc --noEmit` exits 0 | PASS |
| All Phase 10 Vitest tests still pass (11/11) | PASS |
| Backend Phase 12 service tests pass (17/17) | PASS |
| Zero raw hex colors in public-portal feature | PASS |

## Deviations from Plan

None — plan executed exactly as written. The `data/index.ts` barrel update was anticipated and executed per plan instructions (keep `hotel` + `reviews`, strip deleted modules).

## Phase 12 Closeout Note

All 5 plans completed:
- 12-01: Public portal controller + 3 endpoints (hotel-info, room-types, hotel-photos)
- 12-02: Backend service + Vitest tests (17 tests covering all 3 endpoints)
- 12-03: TanStack Query hooks (useHotelInfo, useRoomTypes, useHotelPhotos) with placeholderData
- 12-04: HotelHomePage orchestration + skeletons + error banner (11 Phase 10 tests preserved)
- 12-05: Dead code removal + full regression gate

Phase 12 is ready for `/gsd-verify-work` or merge. Manual QA checklist above provides the verification script for the end-to-end vertical slice.

## Self-Check: PASSED

Files confirmed deleted:
- `apps/web/src/features/public-portal/data/roomTypes.ts` — MISSING (correct — deleted)
- `apps/web/src/features/public-portal/data/photos.ts` — MISSING (correct — deleted)
- `apps/web/src/features/public-booking/LegacyBookingPage.tsx` — MISSING (correct — deleted)

Files confirmed present:
- `apps/web/src/features/public-portal/data/hotel.ts` — FOUND
- `apps/web/src/features/public-portal/data/reviews.ts` — FOUND
- `apps/web/src/features/public-portal/data/index.ts` — FOUND (updated)

Commit exists:
- `fb88532` — FOUND (chore(12-05): delete legacy data modules + clean barrel)
