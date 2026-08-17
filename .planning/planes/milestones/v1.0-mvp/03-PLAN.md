# Phase 3: Guests + Reservations + Public Booking Engine — PLAN

**Phase:** 03
**Milestone:** v1.0 — MVP
**Mode:** mvp
**UI hint:** yes (booking engine public + reservation wizard staff)
**Goal:** Guests can book online and staff can manage reservations — and the database constraint makes it physically impossible to overbook a room regardless of concurrent requests
**Depends on:** Phase 2
**Research flag:** btree_gist exclusion constraint raw SQL Prisma migration syntax — verify before coding
**Requirements:** GST-01, GST-02, GST-03, GST-04, GST-05, RES-01, RES-02, RES-03, RES-04, RES-05, RES-06, RES-07, PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06
**Completed:** 2026-05-15

## Success Criteria

1. Staff can register a guest with all mandatory fields (full name, document type/number, nationality, date of birth, contact); document number is encrypted at rest; housekeeping-role JWT cannot retrieve `document_number` from the API
2. Two concurrent HTTP requests attempting to book the same room for overlapping dates result in exactly one CONFIRMED reservation and one 409 Conflict response — verified with the `btree_gist` exclusion constraint present in the migration
3. Staff can create, modify (dates, room, guest), and cancel reservations; cancelled reservations retain their record with status CANCELLED
4. A public visitor can search availability by date range, see available rooms with photos and pricing, submit a booking form, and receive a confirmation email via Resend
5. Public booking endpoints reject requests without CSRF token and are rate-limited; the booking engine date picker uses `react-day-picker` v10 in `mode="range"`
6. Staff reservation creation uses the 4-step wizard from the design (Fechas y disponibilidad → Seleccionar habitación → Datos del huésped → Confirmar); calendar uses the room rack horizontal grid via `@schedule-x/react`

## Plans

### Plan 03-01: Guests Module
**File:** `03-01-PLAN.md`
**Status:** DONE

**Tasks:**
1. GuestsModule vertical slice
2. AES-256-GCM encryption for `document_number`
3. Two-DTO RBAC:
   - Full DTO for admin/manager/reception
   - Limited DTO for housekeeping (excludes document_number)
4. Guests UI at `/guests`
5. Guest registration form with all mandatory fields

**Verification:**
- [ ] Register guest with all fields
- [ ] Document number encrypted in DB
- [ ] Housekeeping gets limited DTO (no document_number)
- [ ] Admin gets full DTO

### Plan 03-02: Reservations Backend
**File:** `03-02-PLAN.md`
**Status:** DONE

**Tasks:**
1. `btree_gist` exclusion constraint migration:
   - Raw SQL in Prisma migration
   - Prevents overlapping reservations for same room
2. `23P01` → `ConflictException` mapping
3. `SELECT FOR UPDATE` on availability check
4. `AvailabilityService` SINGLE GUARD pattern
5. Reservation lifecycle: CONFIRMED → CHECKED_IN → CHECKED_OUT → CANCELLED

**Verification:**
- [ ] Concurrent booking test: 1 success, 1 conflict
- [ ] Exclusion constraint in migration
- [ ] 409 returned on conflict
- [ ] No overbooking possible

### Plan 03-03: Staff Reservation Wizard
**File:** `03-03-PLAN.md`
**Status:** DONE

**Tasks:**
1. 4-step wizard:
   - Step 1: Fechas y disponibilidad (date range + availability)
   - Step 2: Seleccionar habitación (room selection with photos)
   - Step 3: Datos del huésped (guest registration or search)
   - Step 4: Confirmar (summary + pricing breakdown)
2. CSS Grid RoomRackCalendar
3. ReservationDrawer for modify/cancel
4. `@schedule-x/react` for calendar view

**Verification:**
- [ ] Complete 4-step wizard
- [ ] RoomRackCalendar shows availability
- [ ] Modify reservation dates
- [ ] Cancel reservation (status → CANCELLED)

### Plan 03-04: Public Booking Engine
**File:** `03-04-PLAN.md`
**Status:** DONE

**Tasks:**
1. CSRF token generation and validation
2. `@nestjs/throttler` on public endpoints
3. Resend email integration (fire-and-forget)
4. `/booking` flow:
   - Search availability by date range
   - Show available rooms with photos and pricing
   - Booking form (guest details)
   - Confirmation email
5. `react-day-picker` v10 in `mode="range"`

**Verification:**
- [ ] Public visitor searches dates
- [ ] Available rooms shown with photos/pricing
- [ ] Submit booking form
- [ ] Receive confirmation email via Resend
- [ ] CSRF token required
- [ ] Rate limiting works

## Files Created/Modified

- `apps/api/src/modules/guests/` (new)
- `apps/api/src/modules/reservations/` (new)
- `apps/api/src/modules/public-booking/` (new)
- `apps/web/src/features/guests/` (new)
- `apps/web/src/features/reservations/` (new)
- `apps/web/src/features/public-booking/` (new)
- `apps/api/prisma/migrations/` (modified — add guests, reservations, btree_gist constraint)

## Tests

- API: Concurrent booking test, encryption test, RBAC test
- Web: Wizard flow tests, booking form tests
- E2E: Public booking flow

## Sub-agent

`olaf`

## Commit

`[phase 3]`
