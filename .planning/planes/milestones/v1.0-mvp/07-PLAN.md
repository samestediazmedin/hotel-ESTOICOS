# Phase 7: Staff AI Assistant — PLAN

**Phase:** 07
**Milestone:** v1.0 — MVP
**Mode:** mvp
**UI hint:** yes (chat panel with context + suggested actions sidebar)
**Goal:** Authenticated staff can query PMS data in natural language through a streaming chat panel — with read-only access enforced at the tool layer, a full audit trail of every tool call, and a context panel showing data sources and suggested actions
**Depends on:** Phase 6
**Research flag:** NestJS SSE `@Sse()` + Anthropic SDK AsyncIterable → RxJS Observable streaming pipeline — verify integration pattern end-to-end before coding
**Requirements:** AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, AI-09, AI-10, AI-11, AI-12
**Completed:** 2026-05-15

## Success Criteria

1. Authenticated staff can open the chat panel from any screen and receive streaming token-by-token responses via NestJS SSE; unauthenticated requests are rejected
2. The assistant correctly answers questions using all 7 read-only tools; no write operations exist in any tool definition
3. AI tool inputs are validated with Zod before any service call; the assistant never receives raw DB rows — only sanitized DTOs; free-text fields are sanitized before entering LLM context
4. Every AI tool call is logged to the audit table (user, tool, args, timestamp); the endpoint is rate-limited per user; conversation history is persisted server-side and retrievable per user
5. Chat UI matches the design: right-side context panel showing CONTEXTO ACTIVO · FUENTES CONSULTADAS · ACCIONES SUGERIDAS; messages render rich UI elements (tables, action buttons) when the tool returns structured data

## Plans

### Plan 07-01: Backend Foundation
**File:** `07-01-PLAN.md`
**Status:** DONE

**Tasks:**
1. OpenAI SDK integration (Kimi/Moonshot AI)
2. 7 read-only tools:
   - get_availability
   - get_occupancy_kpi
   - find_guest
   - get_reservation
   - get_checkins_today
   - get_checkouts_today
   - get_folio_summary
3. `AIToolCallLog` migration:
   - user, tool, args, timestamp, response
4. Conversation REST endpoints:
   - Create conversation
   - List conversations
   - Get conversation history

**Verification:**
- [ ] All 7 tools return correct data
- [ ] No write operations in tools
- [ ] Tool inputs validated with Zod
- [ ] Sanitized DTOs returned (not raw DB rows)
- [ ] Audit log records every call

### Plan 07-02: SSE Streaming
**File:** `07-02-PLAN.md`
**Status:** DONE

**Tasks:**
1. NestJS SSE `@Sse()` endpoint
2. Multi-turn conversation loop:
   - User message → LLM
   - LLM requests tool → execute → return result
   - LLM generates final response
3. `tool_calls` accumulator
4. Per-user `ThrottlerGuard`:
   - Rate limit per user
   - Different limits per role

**Verification:**
- [ ] Streaming tokens via SSE
- [ ] Multi-turn with tool calls
- [ ] Rate limiting per user
- [ ] Unauthenticated requests rejected

### Plan 07-03: Chat UI
**File:** `07-03-PLAN.md`
**Status:** DONE

**Tasks:**
1. ChatPanel component:
   - Message list
   - Input field
   - Send button
2. `fetch + ReadableStream` for SSE (not EventSource, for JWT headers)
3. Right-side context panel:
   - CONTEXTO ACTIVO
   - FUENTES CONSULTADAS
   - ACCIONES SUGERIDAS
4. Rich tool rendering:
   - Tables for structured data
   - Action buttons for quick operations
5. Conversation list sidebar

**Verification:**
- [ ] Chat panel opens from any screen
- [ ] Streaming responses visible
- [ ] Context panel shows data sources
- [ ] Rich rendering for tool results
- [ ] Conversation history persisted

## Files Created/Modified

- `apps/api/src/modules/ai-assistant/` (new)
- `apps/web/src/features/ai-chat/` (new)
- `apps/api/prisma/migrations/` (modified — add ai_tool_call_log, conversations)

## Tests

- API: Tool tests, SSE tests, rate limit tests
- Web: Chat UI tests, streaming tests

## Sub-agent

`olaf`

## Commit

`[phase 7]`
