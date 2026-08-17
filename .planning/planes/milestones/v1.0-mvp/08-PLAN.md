# Phase 8: Concierge IA (Public) — PLAN

**Phase:** 08
**Milestone:** v1.0 — MVP
**Mode:** mvp
**UI hint:** yes (public chatbot on portal subdomain, mobile-first)
**Goal:** Public visitors can chat with a city concierge for restaurant, transport, and activity recommendations in Bogotá — without authentication, but with strong rate limiting, prompt-injection defense, and cost-bounded token usage
**Depends on:** Phase 7
**Requirements:** CON-01, CON-02, CON-03, CON-04, CON-05, CON-06, CON-07, CON-08, CON-09
**Completed:** 2026-05-16

## Success Criteria

1. A public visitor (no login) can open the Concierge chat at `/concierge` from mobile or desktop and receive streaming responses about Bogotá venues, transport, and plans
2. The assistant exposes 3-4 read-only tools backed by a curated Bogotá catalog stored as DB rows — no internet search, no external API in v1
3. Each response includes a venue card with name, type, rating, distance from hotel, optional photo, and action buttons
4. Rate limiting: max 20 messages per IP per hour; circuit breaker globally caps daily token spend; over-limit requests return a friendly message
5. Prompt-injection defenses active; all tool calls and user messages audit-logged; catalog admin available from internal screen

## Plans

### Plan 08-01: Backend Foundation
**File:** `08-01-PLAN.md`
**Status:** DONE

**Tasks:**
1. Prisma schema for Bogotá catalog:
   - venues (restaurants, transport, activities)
   - categories, ratings, distances
2. 4 read-only tools:
   - get_restaurants
   - get_transport
   - get_activities
   - get_events
3. TokenBudgetService:
   - Daily token cap
   - Per-IP tracking
   - Circuit breaker
4. Audit log for all tool calls and messages
5. Admin CRUD for catalog management
6. R2 photo presign for venue photos
7. CSV import for bulk catalog updates

**Verification:**
- [ ] Catalog stored in DB
- [ ] 4 tools return curated data
- [ ] Token budget enforced
- [ ] Audit log records everything
- [ ] Admin can manage catalog

### Plan 08-02: SSE Streaming Endpoint
**File:** `08-02-PLAN.md`
**Status:** DONE

**Tasks:**
1. SSE streaming endpoint for public chat
2. Trust proxy fix (X-Forwarded-For)
3. `IpThrottlerGuard`:
   - 20 messages per IP per hour
   - Friendly over-limit message
4. CSRF middleware for public endpoints
5. Pre-call budget check:
   - Reject if daily cap reached
   - Return friendly message

**Verification:**
- [ ] Public chat streams responses
- [ ] IP rate limiting works
- [ ] Budget cap enforced
- [ ] CSRF protection active
- [ ] Over-limit returns friendly message

### Plan 08-03: Public Chat UI
**File:** `08-03-PLAN.md`
**Status:** DONE

**Tasks:**
1. `/concierge` page (mobile-first)
2. ChatMessage component:
   - User messages (right-aligned)
   - Assistant messages (left-aligned)
3. VenueCard component:
   - Name, type, rating
   - Distance from hotel
   - Optional photo
   - Action buttons (directions, call, website)
4. PublicConciergeLayout:
   - Warm palette (from Phase 9 design tokens)
   - Mobile-optimized
5. Admin catalog screen:
   - List all venues
   - Add/edit/delete
   - Photo upload

**Verification:**
- [ ] Chat works on mobile
- [ ] Venue cards render correctly
- [ ] Action buttons functional
- [ ] Admin catalog management works
- [ ] Warm palette applied

## Files Created/Modified

- `apps/api/src/modules/concierge/` (new)
- `apps/web/src/features/concierge/` (new)
- `apps/web/src/features/admin/catalog/` (new)
- `apps/api/prisma/migrations/` (modified — add concierge_catalog, concierge_audit_log)

## Tests

- API: Tool tests, rate limit tests, budget tests
- Web: Chat UI tests, VenueCard tests

## Sub-agent

`olaf`

## Commit

`[phase 8]`
