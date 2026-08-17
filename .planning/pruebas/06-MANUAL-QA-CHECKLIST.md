# Phase 6: Reporting + Dashboard — MANUAL QA CHECKLIST

**Phase:** 06
**Milestone:** v1.0 — MVP
**Date:** 2026-05-15
**Tester:** _____________

## Pre-conditions

- [ ] Phase 5 complete and approved
- [ ] Night audit has run at least once
- [ ] Daily snapshots exist in DB
- [ ] Reservations with various statuses

---

## Scenarios

### Scenario 1: Dashboard KPIs
**Steps:**
1. Login as any staff role
2. Navigate to Dashboard
3. Verify 7 KPI cards visible

**Expected:**
- Today's occupancy %
- ADR (Average Daily Rate)
- RevPAR (Revenue Per Available Room)
- Expected arrivals
- Expected departures
- Rooms in cleaning
- Active service requests
- All values read from `daily_snapshot`, not computed live

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 2: Dashboard Charts
**Steps:**
1. On Dashboard page
2. Verify 7-day occupancy bar chart
3. Verify room status donut chart

**Expected:**
- Bar chart: 7 days of occupancy %
- Donut chart: occupied, reserved, cleaning, maintenance segments
- Charts sourced from snapshots
- Responsive sizing
- Tooltips on hover

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 3: Reports Generation
**Steps:**
1. Login as ADMIN or MANAGER
2. Navigate to Reports page
3. Select date range
4. Click "Generar reporte"

**Expected:**
- Report shows:
  - Occupancy by day
  - Revenue by day
  - Arrivals count
  - Departures count
- Data from snapshots
- Date range filter works
- Loading state while generating

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 4: CSV Export
**Steps:**
1. Generate report
2. Click "Exportar CSV"
3. Open downloaded file

**Expected:**
- BOM (Byte Order Mark) present for Excel
- Semicolon separator
- Spanish headers
- All data rows present
- Dates formatted correctly
- Numbers formatted as numbers (not text)

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 5: PDF Export
**Steps:**
1. Generate report
2. Click "Exportar PDF"
3. Open downloaded file

**Expected:**
- PDF generated with `@react-pdf/renderer`
- Formatted tables
- Date range in header
- 31-day cap enforced (warning if exceeded)
- Downloadable and printable

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 6: Audit Log
**Steps:**
1. Export CSV
2. Export PDF
3. Check audit log

**Expected:**
- Each export recorded in `report_export_log`
- User ID, timestamp, format (CSV/PDF), date range
- Admin can view export history
- Non-admin cannot access audit log

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 7: RBAC
**Steps:**
1. Login as HOUSEKEEPING
2. Try to access Reports page
3. Try to export

**Expected:**
- Reports page not visible in sidebar (or 403)
- Export endpoints return 403
- ADMIN and MANAGER have full access

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

## Regression Checks

- [ ] Phase 5 functionality still works
- [ ] Housekeeping kanban still updates
- [ ] Check-in/out still works
- [ ] All API tests pass
- [ ] All web tests pass

---

## Sign-off

**Tester:** _________________________________
**Date:** _________________________________
**Verdict:** ☐ APPROVED ☐ REJECTED

**Blockers (if rejected):**
_________________________________
_________________________________
_________________________________
