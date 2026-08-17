# Phase 22: Concierge Hotel Knowledge — PLAN

**Phase:** 22
**Milestone:** v1.6 — AI Agent Hardening
**Mode:** feature
**Goal:** Public Concierge knows the hotel itself (info, amenities, room types) in addition to Bogotá city knowledge.
**Trigger:** User feedback 2026-05-23 — "crear el agente del concierge, que sepa todo lo del hotel que debe saber el huésped"
**Depends on:** Phase 8 (Concierge IA exists), Phase 12 (public API exposes hotel data)
**Requirements:** CON-01 (extended), CON-02 (extended), CON-08

## Success Criteria

1. Concierge can answer questions about hotel name, address, phone, description, timezone
2. Concierge can list hotel amenities deduplicated across all active room types
3. Concierge can describe room types with capacity, base price, amenities (published only)
4. System prompt rewritten with explicit tool routing: hotel queries → new tools, city queries → existing tools
5. Tightened "Límites de información" — NEVER reveal reservations, employees, financials, occupancy, other guests
6. System prompt remains locked const, NEVER templated from user input (preserves CON-08)

## Tasks

### Task 1: Hotel Info Tool
- `apps/api/src/modules/concierge/tools/get_hotel_info.ts`
- Query `system_config` table
- Return: `{ name, address, tagline?, description?, phone?, tags[], timezone }`
- Strip internal fields: `ivaRate`, `hotelBusinessDate`, internal logo paths
- Tool definition with Zod schema for LLM

### Task 2: Hotel Amenities Tool
- `apps/api/src/modules/concierge/tools/get_hotel_amenities.ts`
- Query all `isActive=true` room types
- Deduplicate amenities array
- Sort using Spanish locale (`es`)
- Return: `{ amenities: string[] }`

### Task 3: Room Types Summary Tool
- `apps/api/src/modules/concierge/tools/get_room_types_summary.ts`
- Query `isActive=true AND isPublished=true` room types
- Sort ASC by `basePrice`
- Return: `[{ id, name, capacity, basePriceCOP, description, amenities }]`
- Exclude internal fields

### Task 4: System Prompt Rewrite
- Expand from 11 → 47 lines
- Explicit tool list (7 tools total: 4 city + 3 hotel)
- Routing logic section:
  - "When user asks about hotel → use get_hotel_info, get_hotel_amenities, get_room_types_summary"
  - "When user asks about city → use get_restaurants, get_transport, get_activities, get_events"
- "Límites de información" block with NEVER statements
- Locked const, no template literals with user input

### Task 5: Tool Registry Update
- Update `apps/api/src/modules/concierge/tools/index.ts`
- Register 3 new tools
- Tool count: 4 → 7

### Task 6: Tests
- 3 tests per tool (9 total):
  - Tool returns correct shape
  - Tool filters inactive/unpublished data
  - Tool strips internal fields
- Update existing concierge tests to account for new tools

## Verification

- [ ] Ask "What's the hotel address?" → uses get_hotel_info
- [ ] Ask "What amenities do you have?" → uses get_hotel_amenities
- [ ] Ask "Show me room types" → uses get_room_types_summary
- [ ] Ask "Restaurant in Chapinero" → uses existing city tools
- [ ] Ask "How many guests are checked in?" → refuses (boundary test)
- [ ] All 9 new tests pass
- [ ] Existing concierge tests still pass

## Files Created/Modified

- `apps/api/src/modules/concierge/tools/get_hotel_info.ts` (new)
- `apps/api/src/modules/concierge/tools/get_hotel_amenities.ts` (new)
- `apps/api/src/modules/concierge/tools/get_room_types_summary.ts` (new)
- `apps/api/src/modules/concierge/tools/index.ts` (modified — register new tools)
- `apps/api/src/modules/concierge/system-prompt.ts` (modified — expand to 47 lines)
- `apps/api/src/modules/concierge/__tests__/` (modified — add 9 tests)

## Tool Count

4 → 7 (concierge module)

## Tests Added

9 (3 per tool)

## Sub-agent

`olaf`

## Commit

`751baa6`
