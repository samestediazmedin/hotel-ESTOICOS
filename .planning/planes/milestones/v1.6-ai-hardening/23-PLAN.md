# Phase 23: Staff AI Role-Based Tool Filtering — PLAN

**Phase:** 23
**Milestone:** v1.6 — AI Agent Hardening
**Mode:** feature
**Goal:** Staff AI enforces per-tool role allowlist so Housekeeping cannot see revenue, Reception cannot see cleaning assignments, etc.
**Trigger:** User feedback 2026-05-23 — "que a la vez maneje todo lo que necesita el administrador, o las de limpieza que dé la información solicitada según el rol"
**Depends on:** Phase 7 (Staff AI exists), Phase 19 (authz patterns established)
**Requirements:** AI-01 (extended), AI-07, AI-08, AI-09, AI-10, AI-11, AI-12

## Success Criteria

1. Per-tool role allowlist defines which roles can invoke each tool
2. OpenAI tools filter: LLM never sees forbidden tools in its tool definitions
3. Tool executor role gate: Even if LLM tries forbidden tool, executor rejects with ForbiddenException
4. Audit log captures rejected calls with `outputStatus: 'rejected'` + `errorMsg: 'role_not_allowed: {ROLE}'`
5. Role-aware system context message injected as second system message
6. New tools for Housekeeping: `get_room_cleaning_status`, `get_my_cleaning_assignments`

## Role Matrix

| Tool | ADMIN | MANAGER | RECEPTION | HOUSEKEEPING |
|------|-------|---------|-----------|--------------|
| get_availability | ✓ | ✓ | ✓ | ✗ |
| get_occupancy_kpi | ✓ | ✓ | ✗ | ✗ |
| find_guest | ✓ | ✓ | ✓ | ✗ |
| get_reservation | ✓ | ✓ | ✓ | ✗ |
| get_checkins_today | ✓ | ✓ | ✓ | ✗ |
| get_checkouts_today | ✓ | ✓ | ✓ | ✓ |
| get_folio_summary | ✓ | ✓ | ✓ | ✗ |
| **get_room_cleaning_status** | ✓ | ✓ | ✓ | ✓ |
| **get_my_cleaning_assignments** | ✓ | ✓ | ✗ | ✓ |

## Tasks

### Task 1: Extend ToolDef Interface
- Add `allowedRoles: Role[]` field to `ToolDef` interface
- Update all 7 existing tools with role allowlists
- Add 2 new tools with appropriate allowlists

### Task 2: OpenAI Tools Filter
- `getToolDefinitionsForRole(role: Role)` function
- Filter JSON Schema tool definitions by `allowedRoles`
- ADMIN: 9 tools, MANAGER: 9 tools, RECEPTION: 7 tools, HOUSEKEEPING: 3 tools
- Called before every OpenAI API request

### Task 3: Tool Executor Role Gate
- `ToolExecutorService` checks `allowedRoles` before running handler
- If role not allowed → throw `ForbiddenException`
- Never execute handler for forbidden role
- Log attempt with role + tool name

### Task 4: Audit Log Enhancement
- Rejected calls create audit entry:
  - `outputStatus: 'rejected'`
  - `errorMsg: 'role_not_allowed: {ROLE}'`
  - `toolName`, `args`, `userId`, `timestamp`
- Distinct from validation errors and execution errors
- Forensic clarity for privilege escalation attempts

### Task 5: Role-Aware System Context
- `buildRoleContextMessage(role)` function
- Switch on compile-time literals (NO user-input interpolation):
  - ADMIN: "Tienes acceso completo al PMS"
  - MANAGER: "Tienes acceso completo a operaciones y KPIs"
  - RECEPTION: "NO tienes acceso a KPIs financieros"
  - HOUSEKEEPING: "NO tienes acceso a información de huéspedes, reservas, finanzas o KPIs"
- Injected as SECOND `role: 'system'` message in OpenAI conversation
- Locked `SYSTEM_PROMPT` const preserved (AI-07)

### Task 6: New Housekeeping Tools
- `get_room_cleaning_status`:
  - Returns all rooms with cleaning status
  - All roles can access
- `get_my_cleaning_assignments`:
  - Returns tasks assigned to current user
  - HOUSEKEEPING only (shows their own assignments)
  - ADMIN/MANAGER can see all assignments

### Task 7: Tests
- Role gate tests (8 tests):
  - Each role can access allowed tools
  - Each role blocked from forbidden tools
  - Audit metadata correct on rejection
  - ADMIN can access all 9 tools
- getToolDefinitionsForRole tests (6 tests):
  - ADMIN = 9 tools
  - MANAGER = 9 tools
  - RECEPTION = 7 tools
  - HOUSEKEEPING = 3 tools
  - Registry parity (all tools have non-empty allowlist)
  - Non-empty allowlist validation
- New tool DTO shape tests (4 tests)

## Verification

- [ ] HOUSEKEEPING asks "What's today's revenue?" → blocked, audit logged
- [ ] HOUSEKEEPING asks "Show my cleaning tasks" → returns assignments
- [ ] RECEPTION asks "Show KPIs" → blocked
- [ ] RECEPTION asks "Find guest John Doe" → returns guest data
- [ ] MANAGER asks anything → all 9 tools available
- [ ] Audit log shows `role_not_allowed` entries
- [ ] All 14 new tests pass
- [ ] Existing AI assistant tests still pass

## Files Created/Modified

- `apps/api/src/modules/ai-assistant/tools/tool-def.interface.ts` (modified — add allowedRoles)
- `apps/api/src/modules/ai-assistant/tools/index.ts` (modified — add allowlists + 2 new tools)
- `apps/api/src/modules/ai-assistant/services/tool-executor.service.ts` (modified — add role gate)
- `apps/api/src/modules/ai-assistant/services/openai.service.ts` (modified — add getToolDefinitionsForRole)
- `apps/api/src/modules/ai-assistant/system-prompt.ts` (modified — add buildRoleContextMessage)
- `apps/api/src/modules/ai-assistant/tools/get_room_cleaning_status.ts` (new)
- `apps/api/src/modules/ai-assistant/tools/get_my_cleaning_assignments.ts` (new)
- `apps/api/src/modules/ai-assistant/__tests__/` (modified — add 14 tests)

## Tool Count

7 → 9 (ai-assistant module)

## Tests Added

14
- Tests 9-16: role gate (8 tests)
- Tests 17-22: getToolDefinitionsForRole (6 tests)

## Sub-agent

`mia`

## Commit

`e915b99`
