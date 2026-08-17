# Phase 23 — Staff AI Role-Based Tool Filtering

**Milestone:** v1.6 AI Agent Hardening
**Phase position:** 2 of 2 (parallel with Phase 22)
**Trigger:** User feedback 2026-05-23 — staff AI exposes all 7 tools regardless of role. A housekeeping user can query financial KPIs, which violates separation of duties.
**Goal:** Per-tool role allowlist + role-specific tools for Housekeeping + role-aware system prompt.

---

## Current state (problem)

`apps/api/src/modules/ai-assistant/tool-registry.ts` exposes all 7 tools to every authenticated staff user regardless of role. Today a HOUSEKEEPING user can:
- Query revenue (`get_occupancy_kpi`) — financial leak
- View any guest's data (`find_guest`)
- View any reservation (`get_reservation`)
- View folio totals (`get_folio_summary`)

This violates GST-05 spirit (different roles see different fields) at the AI tool layer.

---

## Target role matrix

| Tool | ADMIN | MANAGER | RECEPTION | HOUSEKEEPING |
|------|-------|---------|-----------|--------------|
| `get_availability` | ✓ | ✓ | ✓ | ✗ |
| `get_occupancy_kpi` | ✓ | ✓ | ✗ | ✗ |
| `find_guest` | ✓ | ✓ | ✓ | ✗ |
| `get_reservation` | ✓ | ✓ | ✓ | ✗ |
| `get_checkins_today` | ✓ | ✓ | ✓ | ✗ |
| `get_checkouts_today` | ✓ | ✓ | ✓ | ✓ (sees which rooms freed up) |
| `get_folio_summary` | ✓ | ✓ | ✓ | ✗ |
| **NEW** `get_room_cleaning_status` | ✓ | ✓ | ✓ | ✓ |
| **NEW** `get_my_cleaning_assignments` | ✓ | ✓ | ✗ | ✓ |

---

## Implementation

### 1. Extend `ToolDef` with `allowedRoles`

```ts
export interface ToolDef<TInput = unknown, TOutput = unknown> {
  schema: z.ZodType<TInput>;
  handler: (input: TInput, userCtx: UserContext, deps: ToolDeps) => Promise<TOutput>;
  allowedRoles: ReadonlyArray<'ADMIN' | 'MANAGER' | 'RECEPTION' | 'HOUSEKEEPING'>;
}
```

### 2. Role gate in `ToolExecutorService`

Before invoking a tool handler, check `userCtx.role` against `tool.allowedRoles`. If not allowed:
- Throw `ForbiddenException` with message `Tool '${name}' not available for role '${role}'`
- Audit log records the rejection (still emitted, for forensics)
- OpenAI sees the rejection as a tool error message → reply naturally without leaking the rule

### 3. Filter OpenAI `tools` parameter per role

When building the chat completion request, filter `OPENAI_TOOL_DEFINITIONS` to only those allowed for the calling user's role. This way the LLM never even attempts to call a tool the user doesn't have — saves tokens AND reduces attack surface (no opportunity for prompt injection to "trick" the AI into a forbidden call).

### 4. Add 2 NEW tools for Housekeeping

#### `get_room_cleaning_status`
- Input: optional `roomNumber: string` (filter to specific room) OR none (returns all)
- Output: `Array<{ roomNumber, floor, physicalStatus, cleaningStatus, lastUpdated }>`
- Read-only. Sourced from `room.cleaningStatus + room.physicalStatus`.

#### `get_my_cleaning_assignments`
- Input: none (uses `userCtx.id` server-side)
- Output: `Array<{ taskId, roomNumber, floor, priority, notes?, businessDate, completedAt? }>`
- Reads `housekeeping_task` WHERE `assignedToId = userCtx.id` AND (completedAt IS NULL OR completed today)

### 5. Role-aware system prompt

Inject role-specific context into `SYSTEM_PROMPT` (or use a second message). Example dynamic snippet:
- ADMIN/MANAGER: "Tienes acceso completo al PMS."
- RECEPTION: "Te enfocas en reservas, check-ins/outs, y consultas de huéspedes. NO tienes acceso a KPIs financieros."
- HOUSEKEEPING: "Te enfocas EXCLUSIVAMENTE en estado de habitaciones y tus tareas asignadas. NO tienes acceso a información de huéspedes, reservas, finanzas, o KPIs."

Approach: keep the locked `SYSTEM_PROMPT` const + ALSO inject a second system message with `role: 'system'` containing the role context. This way the locked prompt never gets templated with user input (preserves AI-07 security).

---

## Files expected to change

- MODIFY `apps/api/src/modules/ai-assistant/tool-registry.ts` — add `allowedRoles` to each tool def + 2 new tool entries
- NEW `apps/api/src/modules/ai-assistant/tools/get-room-cleaning-status.tool.ts`
- NEW `apps/api/src/modules/ai-assistant/tools/get-my-cleaning-assignments.tool.ts`
- MODIFY `apps/api/src/modules/ai-assistant/tool-executor.service.ts` — role gate at top of executeTool()
- MODIFY `apps/api/src/modules/ai-assistant/ai-assistant.service.ts` — filter OPENAI_TOOL_DEFINITIONS by role + inject role-aware second system message
- MODIFY `apps/api/src/modules/ai-assistant/ai-assistant.module.ts` — inject RoomsService or InventoryRepository + HousekeepingService for new tools
- MODIFY `apps/api/src/modules/ai-assistant/streaming/system-prompt.ts` — extend with role-context builder function
- NEW spec files for the 2 new tools
- EXTEND `apps/api/src/modules/ai-assistant/tool-executor.service.spec.ts` — add role gate tests

---

## Tests required

- Role gate: HOUSEKEEPING tries to call `get_occupancy_kpi` → 403 + audit
- Role gate: RECEPTION tries to call `get_my_cleaning_assignments` (not in their allowlist) → 403
- ADMIN can call any tool
- New tool: `get_room_cleaning_status` returns rooms grouped properly
- New tool: `get_my_cleaning_assignments` returns only the calling user's tasks
- OpenAI tools filter: ADMIN gets 9 tools in request, HOUSEKEEPING gets 3
- Audit log: rejected tool calls produce an audit entry with rejection reason

---

## Constraints

- Tool count assertion in onModuleInit must increment 7 → 9
- Existing 7 tests for tool execution must continue passing
- No `Co-Authored-By`. Conventional: `feat(ai-staff): add role-based tool filtering + housekeeping tools (RBAC hardening)`
- ONE atomic commit
- 869 API tests must continue passing + 6-10 new tests
- TS 0 errors

---

## Verification

- `cd apps/api && pnpm test -- --run` → 869 + new tests passing
- `cd apps/api && pnpm tsc --noEmit` → 0 errors
- Authz matrix spec from Phase 19 may need updating IF new endpoints surface (none expected — RBAC is at tool layer, not HTTP layer)
- Manual: simulate a HOUSEKEEPING JWT and verify `/api/ai-assistant/chat` filters tools correctly (deferred to user QA)
