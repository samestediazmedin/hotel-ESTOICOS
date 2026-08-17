# Phase 22 — Concierge Hotel Knowledge

**Milestone:** v1.6 AI Agent Hardening
**Phase position:** 1 of 2 (parallel with Phase 23)
**Trigger:** User feedback 2026-05-23 — public concierge only knows Bogotá city, doesn't answer hotel-specific questions.
**Goal:** Extend public Concierge IA with 3 new read-only tools so it can answer guest questions about THE HOTEL itself.

---

## Why this matters

Today, a guest at `/concierge` asks:
- "¿Tienen restaurante el hotel?"
- "¿Cuál es la dirección y los horarios?"
- "¿Hay piscina o gimnasio?"
- "¿Qué tipos de habitación tienen y cuánto cuestan?"

The concierge doesn't know — it only has 4 Bogotá-venue tools. It either deflects or invents an answer. Bad UX, potential misinformation.

---

## New tools to add (3)

All in `apps/api/src/modules/concierge/tools/`. All read-only. All return sanitized DTOs (no internal IDs, no admin fields).

### 1. `get_hotel_info` — basic hotel data
- Reads `system_config`: hotelName, address, tagline, description, phone, tags, hotelTimezone
- Returns: `{ name, address, tagline?, description?, phone?, tags[], timezone }`
- NEVER returns: ivaRate, hotelBusinessDate, hotelLogoUrl internal paths

### 2. `get_hotel_amenities` — amenities aggregated across room types
- Reads `room_type.amenities[]` across all `isActive=true` types
- Deduplicates + sorts alphabetically
- Returns: `{ amenities: string[] }`
- Example: `["WiFi gratis", "Piscina", "Gimnasio", "Desayuno incluido", ...]`

### 3. `get_room_types_summary` — public summary of room types
- Reads `room_type` filtered by `isActive=true` AND `isPublished=true`
- Returns: `Array<{ id, name, capacity, basePriceCOP, description?, amenities[] }>`
- Sorted by `basePrice` ascending
- NEVER returns: internal cost fields, occupancy data, supplier info

---

## System prompt update

Update `CONCIERGE_SYSTEM_PROMPT` in `apps/api/src/modules/concierge/streaming/system-prompt.ts`:
- Add the 3 new tool names to the explicit list
- Add instruction: "Cuando el usuario pregunte sobre el HOTEL (servicios, dirección, habitaciones, precios), usá las herramientas get_hotel_info, get_hotel_amenities, get_room_types_summary"
- Keep the existing "NUNCA accedas a datos de reservas/huéspedes/sistema interno" guard
- Tighten boundary explicitly: "Si el usuario pide datos internos del hotel (empleados, ingresos, ocupación, reservas específicas), rechazá amablemente"

---

## What NOT to expose

The concierge MUST NEVER return (enforce via tool DTOs):
- Other guests' data (names, contact, document, history)
- Specific reservation details
- Financial data (revenue, ADR, RevPAR, paid status)
- Employee info (staff names, schedules, contact)
- Internal procedures or policies
- Audit logs
- Room cleaning status, housekeeping tasks
- Cost-side fields on room_type (only basePrice — the public sale price)

This is enforced at the **tool layer** (DTOs strip these fields) AND at the **system prompt layer** (instructions). Defense in depth.

---

## Files expected to change

- NEW `apps/api/src/modules/concierge/tools/get-hotel-info.tool.ts`
- NEW `apps/api/src/modules/concierge/tools/get-hotel-amenities.tool.ts`
- NEW `apps/api/src/modules/concierge/tools/get-room-types-summary.tool.ts`
- MODIFY `apps/api/src/modules/concierge/concierge-tool-registry.ts` — register the 3 new tools + add OpenAI tool definitions
- MODIFY `apps/api/src/modules/concierge/streaming/system-prompt.ts` — extend instructions
- MODIFY `apps/api/src/modules/concierge/concierge.module.ts` — inject new dep (probably reuse PrismaService from PublicPortalModule pattern)
- NEW test spec for each new tool

Possibly need a `HotelInfoRepository` (or reuse existing one from Phase 12 `public-portal/`) — investigate to avoid duplication.

---

## Constraints

- Reuse existing PrismaService — no new dependencies
- Tools are READ-ONLY (concierge has no write access by design — CON-04)
- Tool DTOs validated with Zod
- Tool args sanitized via existing `sanitizeConciergeInput()`
- Each tool emits audit log via existing pattern (already in ConciergeToolExecutorService)
- No `Co-Authored-By`. Conventional: `feat(concierge): add hotel-knowledge tools (get_hotel_info + get_hotel_amenities + get_room_types_summary)`
- ONE atomic commit
- 869 API tests must continue passing + 3-6 new tests for tools
- TS 0 errors

---

## Verification

- `cd apps/api && pnpm test -- --run` → 869 + new tests passing
- `cd apps/api && pnpm tsc --noEmit` → 0 errors
- Tool registry count assertion in onModuleInit updated (was 4 → now 7)
- System prompt mentions 7 tools explicitly in concierge prompt
- All new tools have Zod-validated input + sanitized output DTO
