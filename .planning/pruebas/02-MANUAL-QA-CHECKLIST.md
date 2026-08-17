# Phase 2: Inventory + Pricing — MANUAL QA CHECKLIST

**Phase:** 02
**Milestone:** v1.0 — MVP
**Date:** 2026-05-15
**Tester:** _____________

## Pre-conditions

- [ ] Phase 1 complete and approved
- [ ] Admin user logged in
- [ ] Cloudflare R2 bucket configured (for photos)

---

## Scenarios

### Scenario 1: Room Types CRUD
**Steps:**
1. Navigate to Room Types page
2. Click "Nuevo tipo de habitación"
3. Fill form: name, base price, amenities
4. Save
5. Edit room type
6. Deactivate room type

**Expected:**
- Room type created with correct data
- Base price stored in COP
- Amenities list saved
- Edit persists
- Deactivated room type hidden from availability

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 2: Rooms CRUD
**Steps:**
1. Navigate to Rooms page
2. Click "Nueva habitación"
3. Fill form: number, floor, type, notes
4. Save
5. Edit room
6. Set physicalStatus to OUT_OF_SERVICE

**Expected:**
- Room created with correct data
- Room number unique
- physicalStatus and cleaningStatus independent
- OUT_OF_SERVICE room excluded from availability

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 3: Dual Status Independence
**Steps:**
1. Open room detail
2. Set physicalStatus = AVAILABLE
3. Set cleaningStatus = DIRTY
4. Save
5. Verify both statuses saved independently

**Expected:**
- physicalStatus = AVAILABLE
- cleaningStatus = DIRTY
- Setting one does not affect the other
- Room shows in availability (physicalStatus)
- Room shows in housekeeping board (cleaningStatus)

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 4: Photo Upload
**Steps:**
1. Open room detail
2. Click "Agregar foto"
3. Select image file
4. Upload via presigned URL
5. Verify photo appears in gallery
6. Delete photo

**Expected:**
- Presigned URL generated
- Upload succeeds to R2
- Photo visible in gallery
- Photo served from CDN
- Delete removes from DB and R2

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 5: Rate Plans
**Steps:**
1. Navigate to Pricing page
2. Create rate plan: name, description
3. Add season: date range, multiplier (e.g., 1.5), minimum nights (e.g., 2)
4. Save
5. View rate plan details

**Expected:**
- Rate plan created
- Season with correct date range
- Multiplier applied correctly
- Minimum nights enforced

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 6: Pricing Breakdown
**Steps:**
1. Call PricingService.calculateBreakdown() for date range
2. Check response structure

**Expected:**
- Response includes:
  - base: original price per night
  - seasonModifier: multiplier applied
  - taxes: IVA calculation
  - total: final amount
- Breakdown is itemized, not single number
- All values in COP

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 7: Room Detail Drawer
**Steps:**
1. Click on room card
2. Verify drawer opens from right
3. Check tabs: Detalles, Reservas, Limpieza, Mantenimiento, Historial
4. Navigate between tabs

**Expected:**
- Drawer opens smoothly
- All 5 tabs visible
- Tab content loads correctly
- Responsive on mobile

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

## Regression Checks

- [ ] Phase 1 functionality still works
- [ ] Login still works
- [ ] Auth guards still enforce roles
- [ ] All API tests pass (12 tests)
- [ ] All web tests pass
- [ ] Pricing unit tests pass (8 tests)

---

## Sign-off

**Tester:** _________________________________
**Date:** _________________________________
**Verdict:** ☐ APPROVED ☐ REJECTED

**Blockers (if rejected):**
_________________________________
_________________________________
_________________________________
