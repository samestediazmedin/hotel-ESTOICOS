# Phase 5: Housekeeping — MANUAL QA CHECKLIST

**Phase:** 05
**Milestone:** v1.0 — MVP
**Date:** 2026-05-15
**Tester:** _____________

## Pre-conditions

- [ ] Phase 4 complete and approved
- [ ] Rooms with various cleaningStatus values
- [ ] Housekeeping staff user exists

---

## Scenarios

### Scenario 1: Kanban Board
**Steps:**
1. Login as HOUSEKEEPING
2. Navigate to Housekeeping page
3. Verify 4 columns visible
4. Check rooms in each column

**Expected:**
- 4 columns: Pendientes, En proceso, Listas hoy, Verificadas
- Rooms grouped by cleaningStatus:
  - DIRTY → Pendientes
  - IN_PROGRESS → En proceso
  - INSPECTION → Listas hoy
  - CLEAN → Verificadas
- Real-time updates without page reload

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 2: State Transitions
**Steps:**
1. Find room with status DIRTY
2. Transition to IN_PROGRESS
3. Transition to INSPECTION
4. Transition to CLEAN
5. Try invalid transition: DIRTY → CLEAN

**Expected:**
- Valid transitions succeed
- Invalid transition rejected with error
- Status updates in real-time on board
- Audit trail records transitions

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 3: Task Assignment
**Steps:**
1. Login as MANAGER
2. Click on room in kanban
3. Click "Asignar tarea"
4. Select housekeeping staff member
5. Set priority (Alta/Media/Baja)
6. Save

**Expected:**
- Task created and assigned
- Assignee sees task on their board
- Priority badge visible (Alta=terracotta, Media=mustard, Baja=olive)
- Task appears in correct column

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 4: Checkout → DIRTY
**Steps:**
1. Check out a guest (Phase 4)
2. Watch housekeeping board
3. Verify room appears in Pendientes column

**Expected:**
- Room cleaningStatus automatically transitions to DIRTY
- Transition via domain event (no direct cross-module call)
- Room immediately visible in Pendientes column
- Real-time broadcast to all connected clients

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 5: Room Status Modal
**Steps:**
1. Click on room card in kanban
2. Modal opens with room details
3. View current status
4. Change status from modal

**Expected:**
- Modal shows room details
- Current status highlighted
- Status change buttons visible
- Change reflects immediately on board

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 6: Real-time Updates
**Steps:**
1. Open housekeeping board in two browsers
2. In Browser 1: change room status
3. In Browser 2: verify update appears

**Expected:**
- Browser 2 receives update via Socket.io
- No page reload needed
- Update appears within 1 second
- Both browsers show same state

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

## Regression Checks

- [ ] Phase 4 functionality still works
- [ ] Check-in/out still works
- [ ] Night audit still runs
- [ ] Folio still viewable
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
