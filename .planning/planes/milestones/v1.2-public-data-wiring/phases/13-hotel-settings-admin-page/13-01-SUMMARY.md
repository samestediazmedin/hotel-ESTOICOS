---
phase: 13-hotel-settings-admin-page
plan: 01
subsystem: backend
tags: [migration, prisma, system-config, audit-log, public-portal, nestjs]
dependency_graph:
  requires: []
  provides:
    - "PATCH /api/system-config (ADMIN-only partial update with audit log)"
    - "GET /api/system-config (ADMIN-only full config for pre-filling form)"
    - "system_config.address column (DB-backed, backfilled)"
    - "hotel_photos.key column (nullable, dual-shape URL resolution)"
    - "system_config_change_log table (audit trail)"
  affects:
    - "PublicPortalService.getHotelInfo() — address now DB-sourced"
    - "PublicPortalService.getHotelPhotos() — URL resolution via key when present"
    - "Phase 12 public portal endpoints — no regression (22/22 tests pass)"
tech_stack:
  added:
    - "dto/update-system-config.dto.ts (Zod schema, new file)"
    - "system_config_change_log (new Prisma model + migration table)"
  patterns:
    - "updateMany({where: {}, data}) for single-row config table"
    - "Dual-shape photo URL: p.key ? R2_URL/key : p.url (fallback for legacy rows)"
    - "Audit log outside transaction with try/catch — never blocks user-facing response"
key_files:
  created:
    - "apps/api/prisma/migrations/20260525000000_phase13_hotel_settings_admin/migration.sql"
    - "apps/api/src/system-config/dto/update-system-config.dto.ts"
  modified:
    - "apps/api/prisma/schema.prisma (SystemConfig.address, HotelPhoto.key, SystemConfigChangeLog model, User reverse relation)"
    - "apps/api/src/system-config/system-config.service.ts (update() method + serializeForAudit())"
    - "apps/api/src/system-config/system-config.controller.ts (GET admin + PATCH endpoints)"
    - "apps/api/src/modules/public-portal/public-portal.service.ts (address from DB, dual-shape URL)"
    - "apps/api/src/modules/public-portal/public-portal.service.spec.ts (fixture + test updates)"
decisions:
  - "Prisma Json type requires cast to Prisma.InputJsonValue for audit before/after blobs — Record<string, unknown> is rejected by Prisma 7 strict Json typing"
  - "Audit log write after update (outside transaction) — informational, wrapped in try/catch, never throws"
  - "updateMany({where: {}, data}) is the correct pattern for single-row system_config table — update() requires unique where, which the controller doesn't have"
  - "Dual-shape URL: undefined key is falsy — legacy fixture rows (no key field) fall through to p.url correctly without explicit null check"
metrics:
  duration: "10 minutes"
  completed: "2026-05-18"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 5
---

# Phase 13 Plan 01: Migration + SystemConfigService.update + PublicPortalService fixes

Prisma migration adding `system_config.address` + `hotel_photos.key` + audit log table; `SystemConfigService.update()` with diff-based audit log; PATCH `/api/system-config` behind `JwtAuthGuard + RolesGuard @Roles('ADMIN')`; `PublicPortalService` reads address from DB and resolves photo URLs via R2 key with fallback to legacy stored URL.

## What Was Built

### Task 1: Prisma migration + schema
Migration `20260525000000_phase13_hotel_settings_admin` applied to Railway PostgreSQL:
- `ALTER TABLE system_config ADD COLUMN address TEXT` + backfill `'La Candelaria, Bogotá'`
- `ALTER TABLE hotel_photos ADD COLUMN key TEXT` (nullable)
- `CREATE TABLE system_config_change_log` with FK to users + changedAt index
- `schema.prisma` updated: `SystemConfig.address`, `HotelPhoto.key`, new `SystemConfigChangeLog` model, `User.systemConfigChangeLogs` reverse relation

### Task 2: SystemConfigService.update + DTO + PATCH controller
- New `dto/update-system-config.dto.ts`: Zod schema for `{name, address, tagline, description, phone, tags}` (all optional)
- `SystemConfigService.update(dto, userId)`: captures current row → maps DTO to column names (name→hotelName) → `updateMany` → `findFirst` → writes audit log entry in try/catch
- `SystemConfigController`: added `GET /api/system-config` (ADMIN, returns DTO-shape) and `PATCH /api/system-config` (ADMIN, Zod-validates body, returns updated flat shape)
- Both routes guarded by `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')`

### Task 3: PublicPortalService fixes
- Removed `HOTEL_ADDRESS_PLACEHOLDER` constant entirely
- `getHotelInfo()`: `address: config?.address ?? ''` (DB-backed, fallback to empty string)
- `getHotelPhotos()`: dual-shape resolution — `p.key ? ${r2PublicUrl}/${p.key} : p.url`
- Updated spec: added `address` to mock fixture, updated test description, added `null address → ''` test

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prisma 7 rejects `Record<string, unknown>` for Json fields**
- **Found during:** Task 2 — first `tsc --noEmit` run
- **Issue:** `prisma.systemConfigChangeLog.create({ data: { before: Record<string, unknown> } })` — Prisma 7 has strict `InputJsonValue` typing that rejects `Record<string, unknown>` directly
- **Fix:** Cast `serializeForAudit()` return to `as Prisma.InputJsonValue`
- **Files modified:** `apps/api/src/system-config/system-config.service.ts`
- **Commit:** a61c0bd (included in Task 2 commit)

**2. [Rule 1 - Bug] `public-portal.service.spec.ts` test broken by Phase 13 address change**
- **Found during:** Task 3 — `vitest run src/modules/public-portal/` after service change
- **Issue:** Test fixture `mockSystemConfig` lacked `address` field; test expected hardcoded `'La Candelaria, Bogotá'` from `HOTEL_ADDRESS_PLACEHOLDER` constant (which no longer exists)
- **Fix:** Added `address: 'La Candelaria, Bogotá'` to mock fixture; updated test description to reflect DB-backed behavior; added new test for `null address → ''` fallback
- **Files modified:** `apps/api/src/modules/public-portal/public-portal.service.spec.ts`
- **Commit:** 486398d

## Verification Results

| Check | Result |
|-------|--------|
| `prisma migrate status` | Database schema is up to date |
| `tsc --noEmit` | Exit 0 — no errors |
| `vitest run src/system-config/` | 4/4 passed |
| `vitest run src/modules/public-portal/` | 18/18 passed (17 original + 1 new null-address test) |
| Total test suite | 22/22 passed |
| `rg HOTEL_ADDRESS_PLACEHOLDER apps/api/src` | 0 matches — constant fully removed |
| Migration applied | 20260525000000_phase13_hotel_settings_admin — All migrations applied |

## Commits

| Hash | Message |
|------|---------|
| 3ee38a8 | feat(13-01): migration — address + key + system_config_change_log table |
| a61c0bd | feat(13-01): SystemConfigService.update with audit log + PATCH /api/system-config |
| 486398d | refactor(13-01): PublicPortalService — DB-backed address + dual-shape photo URL |

## Self-Check: PASSED

All created/modified files verified:
- `apps/api/prisma/migrations/20260525000000_phase13_hotel_settings_admin/migration.sql` — exists, applied
- `apps/api/src/system-config/dto/update-system-config.dto.ts` — exists
- `apps/api/src/system-config/system-config.service.ts` — contains `async update(`
- `apps/api/src/system-config/system-config.controller.ts` — contains `@Patch()` and `@Roles('ADMIN')` x2
- `apps/api/src/modules/public-portal/public-portal.service.ts` — contains `config?.address ??` and `p.key ?`
- All 3 commits present in `git log`
