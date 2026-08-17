# Phase 5: Housekeeping — PLAN

**Phase:** 05
**Milestone:** v1.0 — MVP
**Mode:** mvp
**UI hint:** yes (housekeeping kanban board)
**Goal:** Housekeeping staff see a live kanban board of room cleaning states, manager can assign tasks, and every state transition broadcasts instantly to all connected PMS screens
**Depends on:** Phase 4
**Requirements:** HK-01, HK-02, HK-03, HK-04, HK-05, HK-06
**Completed:** 2026-05-15

## Success Criteria

1. Housekeeping staff sees a 4-column kanban board (Pendientes · En proceso · Listas hoy · Verificadas) grouping rooms by `cleaningStatus`; the board updates in real time without page reload when any room changes state
2. Valid cleaning state transitions (DIRTY → IN_PROGRESS → INSPECTION → CLEAN) succeed; invalid transitions (e.g., DIRTY → CLEAN directly) are rejected with an error
3. Manager can assign a housekeeping task to a specific staff member with priority (Alta · Media · Baja); that staff member sees the assignment on their board
4. When a guest checks out, the room `cleaningStatus` automatically transitions to DIRTY via domain event (no direct cross-module call); this transition is immediately visible on the housekeeping board

## Plans

### Plan 05-01: State Machine and Tasks
**File:** `05-01-PLAN.md`
**Status:** DONE

**Tasks:**
1. Cleaning state machine:
   - DIRTY → IN_PROGRESS → INSPECTION → CLEAN (valid)
   - Any other transition rejected
2. HousekeepingTask CRUD:
   - Create task for room
   - Assign to staff member
   - Set priority (Alta/Media/Baja)
3. `@nestjs/event-emitter` listener:
   - On checkout → transition room to DIRTY
   - No direct cross-module call

**Verification:**
- [ ] Valid transitions succeed
- [ ] Invalid transitions rejected with error
- [ ] Checkout event transitions room to DIRTY
- [ ] Task created and assigned

### Plan 05-02: Socket.io Gateway
**File:** `05-02-PLAN.md`
**Status:** DONE

**Tasks:**
1. Socket.io gateway with `@nestjs/websockets` + `@nestjs/platform-socket.io`
2. JWT handshake auth on connection
3. `room:statusUpdate` broadcast:
   - Emitted on any room status change
   - Broadcast to all connected clients
4. Room subscription by room ID

**Verification:**
- [ ] Connect with JWT
- [ ] Receive status updates in real-time
- [ ] Multiple clients receive same update
- [ ] Unauthorized connection rejected

### Plan 05-03: Kanban UI
**File:** `05-03-PLAN.md`
**Status:** DONE

**Tasks:**
1. 4-column kanban board:
   - Pendientes (DIRTY)
   - En proceso (IN_PROGRESS)
   - Listas hoy (INSPECTION)
   - Verificadas (CLEAN)
2. `socket.io-client` integration
3. RoomStatusModal on click:
   - Show room details
   - Allow status change
4. TaskAssignmentDrawer (MANAGER/ADMIN only):
   - Assign task to staff
   - Set priority

**Verification:**
- [ ] Board shows rooms in correct columns
- [ ] Real-time updates without reload
- [ ] Click room opens modal
- [ ] Manager can assign tasks
- [ ] Priority badges visible

## Files Created/Modified

- `apps/api/src/modules/housekeeping/` (new)
- `apps/api/src/modules/websocket/` (new)
- `apps/web/src/features/housekeeping/` (new)
- `apps/web/src/lib/socket.ts` (new)

## Tests

- API: State machine tests, event emitter tests
- Web: Kanban UI tests, socket tests

## Sub-agent

`olaf`

## Commit

`[phase 5]`
