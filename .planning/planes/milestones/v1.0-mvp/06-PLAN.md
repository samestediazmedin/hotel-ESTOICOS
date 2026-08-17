# Phase 6: Reporting + Dashboard — PLAN

**Phase:** 06
**Milestone:** v1.0 — MVP
**Mode:** mvp
**UI hint:** yes (dashboard with KPI cards + occupancy chart)
**Goal:** Staff can see live hotel KPIs and generate date-range reports — all sourced from the `daily_snapshot` populated by night audit, never from raw reservation queries
**Depends on:** Phase 5
**Requirements:** RPT-01, RPT-02, RPT-03, RPT-04, RPT-05
**Completed:** 2026-05-15

## Success Criteria

1. Dashboard shows today's occupancy %, ADR, RevPAR, expected arrivals, expected departures, rooms in cleaning, and active service requests as KPI cards matching the design layout; all KPIs are read from `daily_snapshot` rows, not computed from raw reservations at request time
2. Dashboard shows a 7-day occupancy bar chart and a room status donut (occupied · reserved · cleaning · maintenance) sourced from snapshots
3. Staff can generate a filtered report by date range showing occupancy, revenue, arrivals, and departures
4. Reports can be exported to CSV and to PDF (via `@react-pdf/renderer`); exported files are correctly formatted and downloadable

## Plans

### Plan 06-01: Backend Reporting
**File:** `06-01-PLAN.md`
**Status:** DONE

**Tasks:**
1. W1 atomicity fix for snapshot writes
2. `writeDailySnapshot()` — real KPI computation:
   - Occupancy %
   - ADR (Average Daily Rate)
   - RevPAR (Revenue Per Available Room)
   - Expected arrivals/departures
   - Rooms in cleaning
   - Active service requests
3. `report_export_log` migration
4. ReportingModule:
   - DashboardService
   - 3 read endpoints (daily, weekly, monthly)

**Verification:**
- [ ] Snapshot computed correctly
- [ ] KPIs read from snapshot, not raw queries
- [ ] Export log records downloads

### Plan 06-02: Dashboard UI
**File:** `06-02-PLAN.md`
**Status:** DONE

**Tasks:**
1. 7 KPI cards layout matching design
2. Recharts BarChart — 7-day occupancy trend
3. Recharts PieChart — room status donut:
   - Occupied
   - Reserved
   - Cleaning
   - Maintenance
4. Wired to `/api/reports/*`
5. Auto-refresh on snapshot update

**Verification:**
- [ ] All 7 KPIs visible
- [ ] Charts render with correct data
- [ ] Data from snapshot endpoints
- [ ] Responsive layout

### Plan 06-03: Reports Page
**File:** `06-03-PLAN.md`
**Status:** DONE

**Tasks:**
1. Date-range reports page
2. CSV export:
   - BOM + semicolon separator
   - Spanish headers
3. PDF export via `@react-pdf/renderer`:
   - 31-day cap for performance
   - Formatted tables
4. Audit log for every export
5. RBAC: ADMIN/MANAGER only

**Verification:**
- [ ] Generate report by date range
- [ ] CSV export with correct format
- [ ] PDF export with correct format
- [ ] Audit log records export
- [ ] Housekeeping gets 403

## Files Created/Modified

- `apps/api/src/modules/reporting/` (new)
- `apps/web/src/features/dashboard/` (new)
- `apps/web/src/features/reports/` (new)
- `apps/api/prisma/migrations/` (modified — add daily_snapshot, report_export_log)

## Tests

- API: Snapshot computation tests, export tests
- Web: Dashboard tests, reports UI tests

## Sub-agent

`olaf`

## Commit

`[phase 6]`
