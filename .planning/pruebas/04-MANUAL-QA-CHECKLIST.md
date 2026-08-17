# Phase 4: Operations — MANUAL QA CHECKLIST

**Phase:** 04
**Milestone:** v1.0 — MVP
**Date:** 2026-05-15
**Tester:** _____________

## Pre-conditions

- [ ] Phase 3 complete and approved
- [ ] Confirmed reservation exists
- [ ] Room is CLEAN or INSPECTION status

---

## Scenarios

### Scenario 1: Check-in
**Steps:**
1. Open reservation with status CONFIRMED
2. Click "Check-in"
3. Complete 5-step checklist:
   - Verify identity
   - Sign register
   - Deliver key
   - Confirm transfer/extras
   - Change room status
4. Submit

**Expected:**
- Folio opens atomically in same transaction
- Room physicalStatus becomes OCCUPIED
- Reservation status becomes CHECKED_IN
- Check-in refused if cleaningStatus not CLEAN/INSPECTION
- 5-step checklist UI renders correctly

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 2: Check-in Refused (Dirty Room)
**Steps:**
1. Set room cleaningStatus to DIRTY
2. Try check-in on reservation for that room

**Expected:**
- Check-in refused with error
- Error message indicates room not ready
- No folio created
- Room status unchanged

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 3: Night Audit
**Steps:**
1. Note current hotel_business_date
2. Run night audit manually (or wait for 04:00 cron)
3. Check folio for checked-in guest
4. Verify hotel_business_date advanced
5. Run night audit again

**Expected:**
- Folio shows room charge + IVA per night
- hotel_business_date advanced by 1 day
- NO_SHOW reservations marked (check_in_date < business_date, CONFIRMED)
- Second run is no-op (idempotent)
- Advisory lock prevents concurrent runs

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 4: Folio View
**Steps:**
1. Open checked-in reservation
2. View folio tab
3. Check line items

**Expected:**
- Room charge per night visible
- IVA tax line per night visible
- Running balance correct
- Append-only ledger (no deletions)
- All charges itemized

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 5: Check-out and PDF
**Steps:**
1. Open checked-in reservation (3-night stay)
2. Click "Check-out"
3. Verify folio summary
4. Click "Descargar PDF"
5. Open PDF

**Expected:**
- Folio shows 3 room charges + 3 tax lines
- Running balance = total amount
- Checkout writes immutable snapshot with SHA-256 checksum
- PDF generated with "ESTADO DE CUENTA" format
- COP currency formatting correct
- PDF downloadable

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 6: TRA Export
**Steps:**
1. Login as ADMIN
2. Navigate to TRA Export page
3. Select date range
4. Click "Exportar CSV"
5. Open CSV

**Expected:**
- CSV contains:
  - Full name
  - Document type/number
  - Nationality
  - Date of birth
  - Arrival date
  - Departure date
- Semicolon separator
- Spanish headers
- Audit log records export
- HOUSEKEEPING gets 403

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 7: Manual Charges
**Steps:**
1. Open folio for checked-in guest
2. Click "Agregar cargo"
3. Enter amount and description
4. Save

**Expected:**
- Charge added to folio
- New line item visible
- Running balance updated
- IVA applied if applicable

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

## Regression Checks

- [ ] Phase 3 functionality still works
- [ ] Reservations still creatable
- [ ] Guests still registerable
- [ ] Public booking still works
- [ ] All API tests pass (8 tests for TRA)
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
