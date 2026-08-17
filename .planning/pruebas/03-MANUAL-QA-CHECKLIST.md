# Phase 3: Guests + Reservations + Booking Engine — MANUAL QA CHECKLIST

**Phase:** 03
**Milestone:** v1.0 — MVP
**Date:** 2026-05-15
**Tester:** _____________

## Pre-conditions

- [ ] Phase 2 complete and approved
- [ ] Rooms and room types created
- [ ] Resend API key configured (for emails)

---

## Scenarios

### Scenario 1: Guest Registration
**Steps:**
1. Navigate to Guests page
2. Click "Nuevo huésped"
3. Fill mandatory fields:
   - Full name
   - Document type/number
   - Nationality
   - Date of birth
   - Contact (email/phone)
4. Save
5. Verify in DB: document_number encrypted

**Expected:**
- Guest created successfully
- Document number encrypted with AES-256-GCM
- All mandatory fields required
- Validation errors for missing fields

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 2: RBAC — Document Number
**Steps:**
1. Login as HOUSEKEEPING
2. GET /api/guests
3. Check response
4. Login as ADMIN
5. GET /api/guests
6. Check response

**Expected:**
- HOUSEKEEPING: no document_number in response
- ADMIN: full guest data including document_number
- Different DTOs returned based on role

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 3: Overbooking Prevention
**Steps:**
1. Find available room for dates 2026-06-01 to 2026-06-03
2. Send two concurrent booking requests for same room/dates
3. Check responses

**Expected:**
- One request succeeds (201, CONFIRMED)
- One request fails (409, Conflict)
- `btree_gist` exclusion constraint prevents overlap
- No double booking in DB

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 4: Reservation Lifecycle
**Steps:**
1. Create reservation (status = CONFIRMED)
2. Modify reservation dates
3. Modify reservation room
4. Cancel reservation

**Expected:**
- Create: status = CONFIRMED
- Modify dates: updated, no conflict
- Modify room: updated, availability checked
- Cancel: status = CANCELLED, record retained

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 5: Staff Reservation Wizard
**Steps:**
1. Navigate to Reservations page
2. Click "Nueva reserva"
3. Step 1: Select date range, see availability
4. Step 2: Select room from available list
5. Step 3: Select or register guest
6. Step 4: Confirm summary and pricing
7. Save

**Expected:**
- All 4 steps complete
- Availability shown correctly
- Room selection updates pricing
- Guest data pre-filled if existing
- Summary shows pricing breakdown
- Reservation created on confirm

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 6: Public Booking Engine
**Steps:**
1. Open `/booking` as public visitor (no login)
2. Select date range with react-day-picker
3. See available rooms with photos and pricing
4. Fill booking form (guest details)
5. Submit
6. Check email inbox

**Expected:**
- Available rooms shown for dates
- Photos and pricing visible
- Form validates inputs
- CSRF token included
- Rate limiting active
- Confirmation email received via Resend

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 7: Calendar View
**Steps:**
1. Navigate to Calendar page
2. Verify room rack horizontal grid
3. See reservation bars color-coded by status
4. Drag reservation to new date

**Expected:**
- `@schedule-x/react` calendar renders
- Rooms on Y-axis, dates on X-axis
- Reservation bars show status colors
- Drag-and-drop moves reservation
- Real-time updates

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

## Regression Checks

- [ ] Phase 2 functionality still works
- [ ] Room CRUD still works
- [ ] Pricing still calculates correctly
- [ ] Photo upload still works
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
