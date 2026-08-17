# Phase 2: Inventory + Pricing — PLAN

**Phase:** 02
**Milestone:** v1.0 — MVP
**Mode:** mvp
**UI hint:** yes (room CRUD admin screens — drawer pattern from design)
**Goal:** Staff can fully manage rooms and pricing rules, and the pricing service returns itemized breakdowns that the folio will consume later
**Depends on:** Phase 1
**Requirements:** INV-01, INV-02, INV-03, INV-04, INV-05, PRC-01, PRC-02, PRC-03, PRC-04
**Completed:** 2026-05-15

## Success Criteria

1. Staff can create, edit, and deactivate a room with number, floor, notes, and room type; room types are configurable with base price and amenities list
2. Staff can upload room photos; photos are stored in Cloudflare R2 via presigned URLs and served correctly
3. Each room carries two independent status fields (`physicalStatus` and `cleaningStatus`); setting one does not affect the other; OUT_OF_SERVICE and ON_HOLD rooms are excluded from availability queries at the DB layer
4. Staff can define a rate plan with seasonal multipliers and minimum-nights rules; calling the pricing service for a date range returns an itemized breakdown (base, season modifier, taxes, total) — not a single number
5. Room detail uses the right-side drawer pattern from `design/DESIGN-SYSTEM.md` with tabs: Detalles · Reservas · Limpieza · Mantenimiento · Historial

## Plans

### Plan 02-01: Room Types and Rooms CRUD
**File:** `02-01-PLAN.md`
**Status:** DONE (2026-05-15, 12 tests, 3 tasks)

**Tasks:**
1. G3 session restore fix
2. RoomTypes CRUD — create, edit, deactivate
3. Rooms CRUD with dual independent status:
   - `physicalStatus`: AVAILABLE, OCCUPIED, OUT_OF_SERVICE, ON_HOLD
   - `cleaningStatus`: CLEAN, DIRTY, IN_PROGRESS, INSPECTION
4. `findAvailableRooms()` — excludes OUT_OF_SERVICE and ON_HOLD at DB layer
5. Room detail drawer with tabs

**Verification:**
- [ ] Create room type with base price and amenities
- [ ] Create room with number, floor, type
- [ ] Set physicalStatus independently of cleaningStatus
- [ ] OUT_OF_SERVICE rooms excluded from availability
- [ ] Room drawer opens with all tabs

### Plan 02-02: Photo Upload
**File:** `02-02-PLAN.md`
**Status:** DONE

**Tasks:**
1. Cloudflare R2 presigned URL generation
2. `RoomPhoto` Prisma migration
3. Photo upload UI component
4. Photo gallery in room detail
5. Photo deletion

**Verification:**
- [ ] Upload photo to room
- [ ] Photo appears in room gallery
- [ ] Photo served from R2 CDN
- [ ] Delete photo removes from DB and R2

### Plan 02-03: Rate Plans and Pricing
**File:** `02-03-PLAN.md`
**Status:** DONE (2026-05-15, 8 tests, 3 tasks)

**Tasks:**
1. RatePlan CRUD — name, description, rules
2. Season CRUD — date range, multiplier, minimum nights
3. `PricingService.calculateBreakdown()`:
   - Base price from room type
   - Season modifier applied
   - IVA tax calculation
   - Itemized breakdown returned
4. Pricing admin UI
5. 8 unit tests for pricing logic

**Verification:**
- [ ] Create rate plan with seasons
- [ ] Calculate price for date range
- [ ] Breakdown shows base, modifier, tax, total
- [ ] Season multiplier applies correctly
- [ ] Minimum nights enforced
- [ ] All 8 unit tests pass

## Files Created/Modified

- `apps/api/src/modules/inventory/` (new)
- `apps/api/src/modules/pricing/` (new)
- `apps/api/src/modules/photos/` (new)
- `apps/web/src/features/inventory/` (new)
- `apps/web/src/features/pricing/` (new)
- `apps/api/prisma/migrations/` (modified — add room_photos, rate_plans, seasons)

## Tests

- API: 12 tests (rooms), 8 tests (pricing)
- Web: Room CRUD tests, pricing UI tests

## Sub-agent

`olaf`

## Commit

`[phase 2]`
