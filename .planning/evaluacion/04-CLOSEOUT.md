# Phase 4: Operations — CLOSEOUT

**Phase:** 04
**Milestone:** v1.0 — MVP
**Started:** 2026-05-15
**Completed:** 2026-05-15
**Status:** ✓ COMPLETE
**Trigger:** Reservations complete — need operational workflow (check-in/out, folio, night audit)

---

## Executive Summary

Complete hotel operational loop: check-in atomically opens folio, night audit posts nightly charges automatically, checkout generates immutable PDF bill with correct IVA, and TRA Colombia export available for compliance.

---

## Phase Requirements

- OPS-01: Check-in with atomic folio opening
- OPS-02: Check-out with immutable snapshot
- OPS-03: Room status update on check-in/out
- OPS-04: Cleaning status validation on check-in
- OPS-05: 5-step checklist UI
- FOL-01: Append-only folio ledger
- FOL-02: SHA-256 snapshot on checkout
- FOL-03: Room charges per night
- FOL-04: IVA tax calculation
- FOL-05: Running balance
- FOL-06: PDF bill generation
- NA-01: Night audit cron at 04:00 Bogotá
- NA-02: Idempotency (advisory lock + night_audit_runs)
- NA-03: NO_SHOW marking
- NA-04: Business date advancement
- NA-05: Skipped day alert
- NA-06: Manual backfill support
- NA-07: Manual charges support
- TRA-01: CSV export with required fields
- TRA-02: Date range filter
- TRA-03: RBAC (ADMIN/MANAGER only)
- CHG-01: Manual charge addition
- CHG-02: IVA on manual charges

---

## Plans Completed

| Plan | Description | Status |
|------|-------------|--------|
| 04-01-PLAN.md | Check-in/Check-out: OperationsService + FolioService + 5-step checklist UI | ✓ DONE |
| 04-02-PLAN.md | Night audit: cron + idempotency + NO_SHOW + ScheduleModule | ✓ DONE |
| 04-03-PLAN.md | Folio PDF: @react-pdf/renderer + "ESTADO DE CUENTA" + COP formatter | ✓ DONE |
| 04-04-PLAN.md | TRA Colombia CSV export + tra_export_log audit + react-day-picker v10 | ✓ DONE (8 tests, 3 tasks) |

---

## Verification Gates

| Gate | Result |
|------|--------|
| Check-in opens folio atomically | ✓ |
| Room physicalStatus becomes OCCUPIED | ✓ |
| Check-in refused if room not clean | ✓ |
| 5-step checklist UI renders | ✓ |
| Night audit runs at 04:00 Bogotá | ✓ |
| Idempotent (second run = no-op) | ✓ |
| NO_SHOW reservations marked | ✓ |
| Business date advances | ✓ |
| Folio shows room charge + IVA per night | ✓ |
| 3-night stay: 3 charges + 3 tax lines | ✓ |
| Checkout generates immutable snapshot | ✓ |
| PDF bill downloadable | ✓ |
| TRA CSV export with correct fields | ✓ |
| HOUSEKEEPING cannot trigger TRA export | ✓ |
| Manual charges add to folio | ✓ |

---

## Test Results

- API: 8 tests (TRA export), night audit tests, check-in tests — all pass
- Web: Check-in UI tests, folio view tests — all pass

---

## Files Created/Modified

- `apps/api/src/modules/operations/` (new)
- `apps/api/src/modules/folio/` (new)
- `apps/api/src/modules/night-audit/` (new)
- `apps/api/src/modules/tra-export/` (new)
- `apps/web/src/features/operations/` (new)
- `apps/web/src/features/folio/` (new)
- `apps/api/prisma/migrations/` (modified — add folio, night_audit_runs, tra_export_log)

---

## Carry-Forward

None. All operational requirements complete.

---

## Verdict

**APROBADO PARA CIERRE**. Complete hotel operational loop delivered. Check-in, night audit, checkout, and compliance export all functional.

**Ready to proceed to Phase 5.**
