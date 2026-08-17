# Phase 4: Operations — PLAN

**Phase:** 04
**Milestone:** v1.0 — MVP
**Mode:** mvp
**UI hint:** yes (check-in/out UI + folio view)
**Goal:** Staff can execute the complete hotel operational loop — check-in atomically opens a folio, nightly charges post automatically, and checkout generates an immutable PDF bill with correct IVA
**Depends on:** Phase 3
**Research flags:**
- Colombia IVA accommodation rules — legal review of threshold and exemptions before folio tax logic
- TRA current export format — verify Ministry of Commerce field schema before implementation
**Requirements:** OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, FOL-01, FOL-02, FOL-03, FOL-04, FOL-05, FOL-06, NA-01, NA-02, NA-03, NA-04, NA-05, NA-06, NA-07, TRA-01, TRA-02, TRA-03, CHG-01, CHG-02
**Completed:** 2026-05-15

## Success Criteria

1. Reception can perform check-in on a CONFIRMED reservation: the folio opens atomically in the same transaction, the room `physicalStatus` becomes OCCUPIED, and the system refuses check-in if `cleaningStatus` is not CLEAN or INSPECTION
2. After a guest is checked in and the night audit cron runs, the folio shows one room charge + applicable IVA line item per night; `hotel_business_date` advances by one day; reservations with `check_in_date < hotel_business_date` and status CONFIRMED are marked NO_SHOW
3. Night audit is idempotent — running it twice for the same business date is a no-op; if a day was skipped the system emits an alert and supports manual backfill
4. A 3-night stay folio after checkout shows 3 room charges + 3 tax lines with correct running balance; checkout writes an immutable snapshot with checksum; a downloadable PDF bill is generated
5. Admin or manager can trigger a TRA export filtered by date range; the CSV contains full name, document type/number, nationality, date of birth, arrival date, and departure date; housekeeping role cannot trigger the export
6. Check-in UI uses the inline checklist pattern from the design (verify identity · sign register · deliver key · confirm transfer/extras · change room status)

## Plans

### Plan 04-01: Check-in/Check-out
**File:** `04-01-PLAN.md`
**Status:** DONE

**Tasks:**
1. OperationsService:
   - Check-in: atomic transaction (folio open + room status update)
   - Check-out: folio close + room status update
2. FolioService:
   - Append-only ledger
   - SHA-256 snapshot on checkout
3. Inline 5-step checklist UI:
   - Verify identity
   - Sign register
   - Deliver key
   - Confirm transfer/extras
   - Change room status
4. Refuse check-in if cleaningStatus not CLEAN or INSPECTION

**Verification:**
- [ ] Check-in opens folio atomically
- [ ] Room physicalStatus becomes OCCUPIED
- [ ] Check-in refused if room not clean
- [ ] Check-out generates snapshot
- [ ] 5-step checklist UI renders

### Plan 04-02: Night Audit
**File:** `04-02-PLAN.md`
**Status:** DONE

**Tasks:**
1. Night audit cron at 04:00 Bogotá timezone
2. Idempotency:
   - Advisory lock
   - `night_audit_runs` table
3. NO_SHOW marking:
   - Reservations with check_in_date < hotel_business_date and status CONFIRMED
4. `advanceBusinessDate()` — advances by one day
5. Manual charges support (FOL-03/CHG-01..02)
6. `@nestjs/schedule` for cron

**Verification:**
- [ ] Cron runs at 04:00 Bogotá
- [ ] Idempotent — second run is no-op
- [ ] NO_SHOW reservations marked correctly
- [ ] Business date advances
- [ ] Skipped day alert emitted

### Plan 04-03: Folio PDF
**File:** `04-03-PLAN.md`
**Status:** DONE

**Tasks:**
1. `@react-pdf/renderer` server-side PDF generation
2. "ESTADO DE CUENTA" format
3. COP currency formatter
4. Line items:
   - Room charges per night
   - IVA tax lines
   - Running balance
5. Download PDF button in UI

**Verification:**
- [ ] 3-night stay shows 3 room charges + 3 tax lines
- [ ] Running balance correct
- [ ] PDF downloadable
- [ ] Format matches Colombian hotel standards

### Plan 04-04: TRA Colombia Export
**File:** `04-04-PLAN.md`
**Status:** DONE (2026-05-15, 8 tests, 3 tasks)

**Tasks:**
1. TRA CSV export (ADMIN/MANAGER only)
2. Fields:
   - Full name
   - Document type/number
   - Nationality
   - Date of birth
   - Arrival date
   - Departure date
3. `tra_export_log` audit table
4. `react-day-picker` v10 range UI for date selection
5. RBAC: housekeeping cannot trigger

**Verification:**
- [ ] Export CSV with correct fields
- [ ] Audit log records export
- [ ] Housekeeping gets 403
- [ ] Date range filter works
- [ ] 8 tests pass

## Files Created/Modified

- `apps/api/src/modules/operations/` (new)
- `apps/api/src/modules/folio/` (new)
- `apps/api/src/modules/night-audit/` (new)
- `apps/api/src/modules/tra-export/` (new)
- `apps/web/src/features/operations/` (new)
- `apps/web/src/features/folio/` (new)
- `apps/api/prisma/migrations/` (modified — add folio, night_audit_runs, tra_export_log)

## Tests

- API: 8 tests (TRA export), night audit tests, check-in tests
- Web: Check-in UI tests, folio view tests

## Sub-agent

`olaf`

## Commit

`[phase 4]`
