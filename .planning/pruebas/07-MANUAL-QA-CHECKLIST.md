# Phase 7: Staff AI Assistant — MANUAL QA CHECKLIST

**Phase:** 07
**Milestone:** v1.0 — MVP
**Date:** 2026-05-15
**Tester:** _____________

## Pre-conditions

- [ ] Phase 6 complete and approved
- [ ] OpenAI/Kimi API key configured
- [ ] Staff user logged in
- [ ] Reservations and guests exist in DB

---

## Scenarios

### Scenario 1: Chat Panel Access
**Steps:**
1. Login as RECEPTION
2. Open any page (Dashboard, Calendar, etc.)
3. Click AI chat icon/button
4. Chat panel opens

**Expected:**
- Panel slides in from right
- Input field visible
- Context panel visible (CONTEXTO ACTIVO, FUENTES CONSULTADAS, ACCIONES SUGERIDAS)
- Unauthenticated requests rejected

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 2: Streaming Responses
**Steps:**
1. Open chat panel
2. Type: "¿Cuántas habitaciones ocupadas hay hoy?"
3. Submit
4. Watch response appear

**Expected:**
- Tokens stream in real-time
- SSE connection established
- Response completes naturally
- No timeout errors
- Bearer token in headers (not EventSource)

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 3: Tool Calls
**Steps:**
1. Ask: "¿Cuál es la disponibilidad para mañana?"
2. Verify tool called: get_availability
3. Ask: "Muestrame el huésped Juan Pérez"
4. Verify tool called: find_guest
5. Ask: "¿Cuántos check-ins hay hoy?"
6. Verify tool called: get_checkins_today

**Expected:**
- Correct tool invoked for each question
- Tool returns structured data
- Response includes data from tool
- No write operations in any tool

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 4: Input Validation
**Steps:**
1. Ask with malformed input: "Disponibilidad para [injection]"
2. Check tool input validation
3. Verify sanitized output

**Expected:**
- Zod validates tool inputs
- Invalid inputs rejected
- Assistant never receives raw DB rows
- Free-text sanitized before LLM context

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 5: Audit Log
**Steps:**
1. Ask several questions
2. Check `AIToolCallLog` table
3. Verify entries

**Expected:**
- Every tool call logged:
  - user ID
  - tool name
  - arguments
  - timestamp
  - response status
- Conversation history persisted
- Retrievable per user

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 6: Rate Limiting
**Steps:**
1. Send many messages rapidly
2. Check if rate limited

**Expected:**
- Per-user rate limit enforced
- Different limits per role
- Over-limit returns friendly message
- Not blocked indefinitely

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 7: Rich Tool Rendering
**Steps:**
1. Ask: "Muestra las reservas de hoy"
2. Check response format

**Expected:**
- Response renders table if structured data
- Action buttons for quick operations
- Context panel shows data sources consulted
- Suggested actions visible

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

### Scenario 8: Conversation History
**Steps:**
1. Ask question
2. Close chat panel
3. Reopen chat panel
4. Verify previous messages visible

**Expected:**
- Conversation history persisted
- Previous messages load on reopen
- Multiple conversations supported
- List of conversations in sidebar

**Result:** ☐ PASS ☐ FAIL
**Notes:** _________________________________

---

## Regression Checks

- [ ] Phase 6 functionality still works
- [ ] Dashboard still shows KPIs
- [ ] Reports still generate
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
