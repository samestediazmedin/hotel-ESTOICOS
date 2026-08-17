---
phase: 12-public-data-api-frontend-wiring
plan: 01
subsystem: database/schema
tags: [prisma, migration, seed, postgresql, railway]
dependency_graph:
  requires: []
  provides: [SystemConfig.{tagline,description,phone,tags}, RoomType.isPublished, HotelPhoto model]
  affects: [12-02, 12-03, 12-04]
tech_stack:
  added: []
  patterns: [Prisma 7 adapter-pg instantiation in standalone seed, PrismaClient with PrismaPg adapter]
key_files:
  created:
    - apps/api/prisma/migrations/20260523000000_phase12_public_portal_data/migration.sql
    - apps/api/prisma/seed-phase12.ts
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/package.json
decisions:
  - "tags column: String[] (PostgreSQL native array) over Json — consistent with RoomType.amenities"
  - "isPublished column: camelCase in SQL matches Prisma default mapping (no @@map override needed)"
  - "Seed uses DIRECT_DATABASE_URL preferred over DATABASE_URL (bypasses PgBouncer, same as prisma.config.ts)"
  - "PrismaClient in standalone seed requires PrismaPg adapter — cannot instantiate with new PrismaClient()"
metrics:
  duration: ~25min
  completed: 2026-05-17
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 12 Plan 01: Prisma Migration + Seed for Public Portal Data Summary

Prisma schema extended + Railway migration applied + idempotent seed populated with Hotel Sumapaz public portal data verbatim from v1.1 hardcoded modules.

## What Was Done

### Task 1 — schema.prisma update

Added to `model SystemConfig`:
- `tagline String?` — nullable hotel tagline
- `description String?` — nullable hotel description  
- `phone String?` — nullable hotel phone
- `tags String[] @default([])` — PostgreSQL native array (same type as `RoomType.amenities`)

Added to `model RoomType`:
- `isPublished Boolean @default(true)` — public portal visibility flag; default true for backwards compat

New model `HotelPhoto`:
```prisma
model HotelPhoto {
  id           String   @id @default(cuid())
  url          String
  alt          String   @default("")
  displayOrder Int      @default(0)
  createdAt    DateTime @default(now())

  @@index([displayOrder])
  @@map("hotel_photos")
}
```

### Task 2 — Migration SQL

File: `apps/api/prisma/migrations/20260523000000_phase12_public_portal_data/migration.sql`

- 4 `ALTER TABLE "system_config"` — nullable columns + empty-array default for tags
- 1 `ALTER TABLE "room_types"` — `isPublished BOOLEAN NOT NULL DEFAULT true`
- `CREATE TABLE "hotel_photos"` — 5 columns + primary key
- `CREATE INDEX "hotel_photos_displayOrder_idx"` — sorted retrieval

Applied against Railway DB via `prisma migrate deploy`. Final status: `Database schema is up to date!`

### Task 3 — Idempotent Seed

File: `apps/api/prisma/seed-phase12.ts`

Idempotency strategy:
- `system_config`: `updateMany({ where: {} })` — always updates the single existing row
- `hotel_photos`: count check → createMany only if `count === 0`
- `room_types`: no-op (isPublished defaults via migration)

Seed values taken verbatim from frontend data modules:

**tagline**: `'Boutique en el corazón histórico de Bogotá'` (from `data/hotel.ts`)  
**description**: full colonial description (from `data/hotel.ts`)  
**phone**: `'+57 (1) 555-0100'` (from plan — not in hotel.ts)  
**tags**: `['Hotel boutique', '42 habitaciones', '4 pisos', 'Desayuno incluido']` (from `data/hotel.ts`)  
**5 photos**: Unsplash URLs verbatim from `data/photos.ts`, displayOrder 0..4

Seed executed twice — second run logged `hotel_photos already populated (5 rows) — skipping`. Idempotency confirmed.

## Verification Results

| Check | Result |
|-------|--------|
| `prisma generate` exits 0 | PASSED |
| `tsc --noEmit` (no seed errors) | PASSED |
| `migrate deploy` applied on Railway | PASSED — "All migrations have been successfully applied" |
| `seed:phase12` first run | PASSED — 1 system_config row + 5 hotel_photos seeded |
| `seed:phase12` second run | PASSED — "already populated (5 rows) — skipping" |
| `migrate status` final | PASSED — "Database schema is up to date!" |
| `HotelPhoto` model in generated client | PASSED — `export type * from './models/HotelPhoto'` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed PrismaClient standalone instantiation**

- **Found during:** Task 3 TypeScript verification
- **Issue:** Prisma 7 with `@prisma/adapter-pg` requires `PrismaClient` to be instantiated with `{ adapter }`. `new PrismaClient()` (no args) fails at TS type check with `TS2554: Expected 1 arguments, but got 0`. Plan's seed template used `new PrismaClient()` — valid for classic Prisma 5 but not for this project's Prisma 7 + adapter config.
- **Fix:** Added `PrismaPg` adapter instantiation in seed (mirrors `prisma.service.ts` pattern). Also added `dotenv/config` import and uses `DIRECT_DATABASE_URL` (consistent with `prisma.config.ts`).
- **Files modified:** `apps/api/prisma/seed-phase12.ts`
- **Commit:** `f890790`

**2. [Rule 3 - Blocking] Fixed import path for generated Prisma client**

- **Found during:** Task 3 TypeScript verification  
- **Issue:** Initial import was `'../src/generated/prisma'` (directory — no index.ts). Correct path is `'../src/generated/prisma/client'` (matching all other files in `src/` that use `'../generated/prisma/client'`).
- **Fix:** Updated import to `'../src/generated/prisma/client'`.
- **Files modified:** `apps/api/prisma/seed-phase12.ts`
- **Commit:** `f890790` (combined with fix above)

### Seed Data Difference from Plan Template

The plan's Task 3 action block had hardcoded template values (e.g., `tagline: 'Hospitalidad, operada con inteligencia'`) that did NOT match the actual `data/hotel.ts` file.

Actual values used (verbatim from frontend files as instructed):
- `tagline`: `'Boutique en el corazón histórico de Bogotá'` (not "Hospitalidad, operada con inteligencia")
- `description`: colonial building description (not the boutique-42-habitaciones version)
- Photo `alt` texts: from `photos.ts` (e.g., "Fachada colonial del hotel", not "Fachada del hotel")

This is not a deviation — the plan explicitly instructs to read frontend files verbatim and use those values.

## Decisions Made

1. **`tags` as `String[]` (not `Json`)** — PostgreSQL native array is cleaner, already used in `RoomType.amenities`, no JSON parsing overhead. CONTEXT.md said "JSON column" but RESEARCH Q3 confirmed `String[]` is correct for this project.

2. **`isPublished` column name** — camelCase in SQL (`"isPublished"`) matches Prisma's default column naming for non-`@map`-decorated fields. NestJS queries use `isPublished` directly.

3. **Seed instantiation pattern** — Standalone seeds must replicate `PrismaService` adapter configuration (PrismaPg with parsed URL). This is a project-wide pattern to document for future seeds.

## Self-Check: PASSED

Files verified:
- `apps/api/prisma/schema.prisma` — contains all 6 changes (tagline, description, phone, tags, isPublished, HotelPhoto)
- `apps/api/prisma/migrations/20260523000000_phase12_public_portal_data/migration.sql` — exists, correct SQL
- `apps/api/prisma/seed-phase12.ts` — exists, idempotent logic confirmed
- `apps/api/package.json` — `seed:phase12` script present

Commits verified:
- `8ce9b61` — schema update
- `3ba2f55` — migration SQL
- `a1ab034` — seed script (initial)
- `f890790` — seed fix (PrismaClient instantiation)
