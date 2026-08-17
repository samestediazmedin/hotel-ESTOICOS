---
phase: 13-hotel-settings-admin-page
plan: 02
subsystem: backend
tags: [hotel-photos, r2, presign, admin, crud, vitest, nestjs]
dependency_graph:
  requires:
    - "13-01 — HotelPhoto.key column must exist in DB"
  provides:
    - "GET /api/admin/hotel-photos (ADMIN — full list with displayOrder ASC)"
    - "POST /api/admin/hotel-photos/presign (ADMIN — R2 presigned PUT URL, 300s TTL)"
    - "POST /api/admin/hotel-photos (ADMIN — confirm R2 upload + create DB row)"
    - "PATCH /api/admin/hotel-photos/reorder (ADMIN — atomic reindex via $transaction)"
    - "DELETE /api/admin/hotel-photos/:id (ADMIN — best-effort R2 delete + hard DB delete)"
    - "HotelPhotosModule registered in AppModule"
  affects:
    - "AppModule imports array (HotelPhotosModule added)"
    - "Plan 13-04 UI — consumes GET /api/admin/hotel-photos for gallery manager"
tech_stack:
  added:
    - "apps/api/src/modules/hotel-photos/ (new module — 6 files)"
  patterns:
    - "createR2Client reused from inventory/photos/r2.client (no duplication)"
    - "Zod inline-parse in controller (@Body() body: unknown — pattern from system-config)"
    - "Best-effort R2 delete: try/catch around DeleteObjectCommand, log warn, never throws"
    - "Idempotent confirmUpload: findFirst by key before create — same key returns same row"
    - "displayOrder = MAX + 1 via prisma.hotelPhoto.aggregate for append semantics"
    - "Dual-shape URL in listPhotos: p.key ? R2_URL/key : p.url (legacy fallback)"
    - "AWS SDK mock pattern: class-based mocks satisfy `new` constructor constraint"
key_files:
  created:
    - "apps/api/src/modules/hotel-photos/hotel-photos.module.ts"
    - "apps/api/src/modules/hotel-photos/hotel-photos.controller.ts"
    - "apps/api/src/modules/hotel-photos/hotel-photos.service.ts"
    - "apps/api/src/modules/hotel-photos/hotel-photos.service.spec.ts"
    - "apps/api/src/modules/hotel-photos/dto/presign-hotel-photo.dto.ts"
    - "apps/api/src/modules/hotel-photos/dto/confirm-hotel-photo.dto.ts"
    - "apps/api/src/modules/hotel-photos/dto/reorder-hotel-photos.dto.ts"
  modified:
    - "apps/api/src/app.module.ts (HotelPhotosModule added to imports)"
decisions:
  - "R2 logic duplicated in HotelPhotosService (not injected from PhotosService) — avoids InventoryRepository coupling per plan spec"
  - "Best-effort R2 delete: if R2 fails, log warn + delete DB row anyway — orphan cleanup deferred to v1.3"
  - "GET /api/admin/hotel-photos added (not in original task list but required by rule #8 in execution context)"
  - "spec: capturedData typed as undefined (not null) to satisfy TS2352 strict conversion check"
metrics:
  duration: "15 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 1
---

# Phase 13 Plan 02: HotelPhotos admin module (4 endpoints) Summary

New `hotel-photos` NestJS module with 5 ADMIN-only endpoints (GET list + presign + confirm + reorder + delete), full R2 integration via `createR2Client` reuse, idempotent confirm, atomic `$transaction` reorder, and 15 unit tests covering all happy paths and edge cases.

## What Was Built

### Task 1: HotelPhotosModule scaffold + DTOs + Controller + Service + AppModule

**Module structure** at `apps/api/src/modules/hotel-photos/`:
- `hotel-photos.module.ts` — imports `ConfigModule`, exports `HotelPhotosService`
- `hotel-photos.controller.ts` — 5 routes all behind `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN')`:
  - `GET /api/admin/hotel-photos` — list all photos ordered by `displayOrder` ASC
  - `POST /api/admin/hotel-photos/presign` — generate R2 presigned PUT URL (300s TTL)
  - `POST /api/admin/hotel-photos` — confirm upload (HeadObjectCommand + create row)
  - `PATCH /api/admin/hotel-photos/reorder` — atomic reindex
  - `DELETE /api/admin/hotel-photos/:id` — best-effort R2 + hard DB delete
- 3 Zod DTOs: `PresignHotelPhotoSchema`, `ConfirmHotelPhotoSchema`, `ReorderHotelPhotosSchema`
- `hotel-photos.service.ts` — 5 methods (`listPhotos`, `presignUpload`, `confirmUpload`, `reorderPhotos`, `deletePhoto`)

**Key implementation choices:**
- R2 env vars validated at constructor startup (fail-fast, same pattern as `PhotosService`)
- `createR2Client` imported from `inventory/photos/r2.client` — no duplication, no InventoryRepository coupling
- Confirm: `url = ''` stored in DB — URL derived at read time via `key` (Anti-Pattern #4 avoidance)
- Reorder: `prisma.$transaction(photoIds.map((id, i) => update({ where: {id}, data: {displayOrder: i} })))` — atomic
- Delete: `try/catch` around `DeleteObjectCommand` — R2 failure logs warn but never blocks DB delete

**AppModule registration:**
```
HotelPhotosModule added after ConciergeModule in imports array
```

### Task 2: Vitest spec — 15 tests

`hotel-photos.service.spec.ts` covers:

| Suite | Tests |
|-------|-------|
| `listPhotos` | R2-derived URL for new uploads; fallback to stored URL for legacy rows |
| `presignUpload` | Returns key with `hotel-photos/` prefix + expiresIn 300; sanitizes filename; throws on >5MB |
| `confirmUpload` | Creates row + returns derived URL; idempotent (same key → same row, no double-create); throws on bad key prefix; throws UnprocessableEntity on R2 HEAD fail; computes displayOrder = MAX+1 |
| `reorderPhotos` | Calls `$transaction` with N operations, each with correct index |
| `deletePhoto` | Throws NotFoundException on missing row; calls R2 then DB delete; still deletes DB when R2 fails (best-effort); skips R2 for legacy rows without key |

**Test infrastructure:** AWS SDK mocked via class-based `vi.mock` (PutObjectCommand, HeadObjectCommand, DeleteObjectCommand as classes satisfying `new`). `r2Client.send` patched inline on constructed service instance for test-specific rejection scenarios.

## Deviations from Plan

### Auto-added Features

**1. [Rule 2 - Missing functionality] GET /api/admin/hotel-photos route added**
- **Reason:** Execution context rule #8 explicitly required it: "admin needs this for gallery manager — 13-04 consumes it"
- **Implementation:** `listPhotos()` method on service; `@Get() @Roles('ADMIN')` on controller
- **Files modified:** `hotel-photos.controller.ts`, `hotel-photos.service.ts`

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript TS2352 in spec — null cast to Record<string, unknown>**
- **Found during:** `tsc --noEmit` after writing spec
- **Issue:** `let capturedData: Record<string, unknown> | null = null` — TS strict mode rejects cast from null to typed object without double cast
- **Fix:** Changed to `| undefined` + used `capturedData?.displayOrder` optional chaining
- **Files modified:** `hotel-photos.service.spec.ts`
- **Commit:** included in 62042c9

**2. [Rule 3 - Blocking] Module files committed by parallel 13-03 agent**
- **Context:** The 13-03 parallel agent ran simultaneously and committed all hotel-photos module files as part of its own commit `6e5bad0` (it staged `apps/api/` changes broadly). This is a known wave-2 coordination artifact — the files were written by this agent but committed by the parallel agent.
- **Impact:** None — files are correct and committed. No re-work needed.

## Verification Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | Exit 0 — no errors |
| `vitest run src/modules/hotel-photos/` | 15/15 passed |
| `vitest run src/modules/public-portal/` | 18/18 passed (regression) |
| `rg "@Controller('admin/hotel-photos')" hotel-photos.controller.ts` | 1 match |
| `rg "@Roles('ADMIN')" hotel-photos.controller.ts` | 5 matches (1 per route) |
| `rg "createR2Client" hotel-photos.service.ts` | 1 match (reuse confirmed) |
| `rg "HotelPhotosModule" app.module.ts` | 1 match (registered) |

## Commits

| Hash | Message |
|------|---------|
| 6e5bad0 | feat(13-03): add Textarea and AlertDialog shadcn primitives (includes hotel-photos module files — parallel agent staging overlap) |
| 62042c9 | feat(13-02): HotelPhotosService unit tests — 15 tests passing |

## Self-Check: PASSED

- `apps/api/src/modules/hotel-photos/hotel-photos.module.ts` — exists
- `apps/api/src/modules/hotel-photos/hotel-photos.controller.ts` — exists, contains `@Controller('admin/hotel-photos')`
- `apps/api/src/modules/hotel-photos/hotel-photos.service.ts` — exists, contains `createR2Client`, `hotel-photos/`
- `apps/api/src/modules/hotel-photos/hotel-photos.service.spec.ts` — exists, 15 tests pass
- `apps/api/src/modules/hotel-photos/dto/presign-hotel-photo.dto.ts` — exists
- `apps/api/src/modules/hotel-photos/dto/confirm-hotel-photo.dto.ts` — exists
- `apps/api/src/modules/hotel-photos/dto/reorder-hotel-photos.dto.ts` — exists
- `apps/api/src/app.module.ts` — contains `HotelPhotosModule`
- Commits 6e5bad0 and 62042c9 present in `git log`
