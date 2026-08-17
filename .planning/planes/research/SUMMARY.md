# Project Research Summary

**Project:** HotelOS AI — Single-Tenant Hotel PMS + Booking Engine + AI Assistant
**Domain:** Hotel Property Management System (hospitality software)
**Researched:** 2026-05-13
**Confidence:** HIGH

---

## Executive Summary

HotelOS AI is a single-tenant hotel operating system covering staff operations (PMS), public-facing reservations (booking engine), and an AI conversational layer over PMS data. Expert implementations of this class of product follow Domain-Driven Design with strict bounded contexts: each operational area (inventory, pricing, reservations, operations, housekeeping, reporting, AI) is isolated behind service interfaces and communicates via domain events or read-only facades. The recommended architecture is a NestJS monolith with clean/hexagonal module boundaries on Railway, with React 18 as the frontend and PostgreSQL as the single data store. This is the correct shape for a single-hotel deployment — complexity is proportional to scope, and the team decision to avoid multi-tenancy, payment gateways, and OTA integrations in v1 is validated by research as the right call.

Three features from the initial v1 list are missing and are non-negotiable for a working hotel: the **guest folio** (append-only ledger of charges per stay), the **night audit** (daily cron that posts room charges to folios, advances the hotel business date, and marks no-shows), and **TRA Colombia compliance** (Tarjeta de Registro de Alojamiento — a legal export to the Ministerio de Comercio required for every registered guest). These are not nice-to-have additions; the product cannot operate legally or financially without them. All three belong in the operations phase.

The three most dangerous technical mistakes in this domain are also identified and have concrete prevention strategies: overbooking must be prevented at the PostgreSQL level using a `btree_gist` exclusion constraint on dateranges (application-layer checks fail under concurrent load); the room entity must carry two orthogonal state machines (physical availability and housekeeping cleaning state) because conflating them into one enum leads to booking physically unavailable rooms; and the AI assistant's read-only constraint must be enforced at the tool definition layer, not the system prompt, because prompts can be overridden by injection. These three decisions are architectural — they cannot be retrofitted after production data exists.

---

## Key Findings

### Recommended Stack

The team's core stack (React 18 + Vite + NestJS + Prisma + PostgreSQL + Socket.io + Anthropic SDK + Railway) is confirmed by research as the correct choice for this product. All gap areas have been filled.

**Core technologies:**
- **NestJS 11.x**: backend framework — hexagonal architecture with DI, modules per bounded context, built-in Socket.io gateway and SSE support
- **Prisma 7.x**: ORM — type-safe, migration-based, Rust-free WASM engine production-ready
- **PostgreSQL 16** (Railway add-on): required for `btree_gist` exclusion constraint and `DATE` columns
- **React 18 + Zustand 5 + TanStack Query 5**: Zustand for UI state only; TanStack Query for all server state; never duplicate server state in Zustand
- **shadcn/ui + Radix UI**: copy-paste component system; preserves design identity over MUI/Ant Design
- **@schedule-x/react**: room rack timeline grid (rooms Y-axis, dates X-axis) — the primary front-desk UI
- **react-day-picker v10**: booking engine date range picker — built-in `mode="range"`
- **Cloudflare R2 + @aws-sdk/client-s3 pinned to 3.726.1**: file storage for room photos — zero egress fees; pin is mandatory (v3.729+ breaks R2 checksum compatibility)
- **@react-pdf/renderer v4.5.x**: server-side PDF for reports and folio at checkout — no headless Chrome required
- **Resend**: transactional email — API-first, 3,000 emails/month free, covers all v1 needs
- **NestJS @Sse() + Anthropic SDK AsyncIterable → RxJS Observable**: AI token streaming; do not use WebSocket for AI streaming
- **@nestjs/schedule**: night audit cron at 03:00 hotel local time, no Redis required
- **Vitest 4.x + Playwright 1.57.x**: Vitest replaces Jest (4x faster, zero config for TypeScript)
- **Zod 4.4.x**: single validation schema shared between NestJS pipes and React forms

**Critical version pins:**
- `@aws-sdk/client-s3`: `3.726.1` — v3.729.0+ breaks Cloudflare R2 checksum
- React: `18.x` — React 19 ecosystem not stable enough for production
- NestJS: `11.x` — v12 (ESM migration) is Q3 2026; start on v11

### Expected Features

**Must have — confirmed from initial list:**
- Room inventory CRUD with types, characteristics, photos, out-of-order/out-of-service status
- Rate configuration: base rate, seasonal multipliers, minimum-nights rules (composable rule chain returning itemized breakdown, not a single total)
- Room rack / tape chart grid — the primary PMS screen
- Reservations CRUD with overbooking prevention (DB-level btree_gist exclusion constraint)
- Guest registration with mandatory document type + number (TRA-required, non-nullable)
- Check-in / check-out workflows
- Housekeeping board with realtime WebSocket updates
- Dashboard KPIs: occupancy %, ADR, RevPAR, arrivals/departures today
- Reports filterable by date range, CSV export
- Public booking engine: availability search + reservation flow
- Auth + RBAC: 4 roles (admin, manager, reception, housekeeping)
- AI assistant: read-only chat over PMS data in natural language

**Must have — MISSING from initial list (added by research):**
- **Guest folio**: append-only ledger of all charges per stay. Room rate posts nightly via night audit; ad-hoc charges post in real time. Without this, checkout has no billing output.
- **Night audit**: daily cron at 03:00 hotel local time. Posts room + tax charges, advances `hotel_business_date`, marks no-shows, generates daily revenue snapshot. Without this, revenue is not recorded and reporting is broken. Cannot be deferred.
- **TRA Colombia compliance export**: daily CSV/PDF of guest registrations for Ministerio de Comercio. Legal requirement. Required fields: full name, document type + number, nationality, date of birth, arrival date, departure date.
- **Booking confirmation email**: triggered on reservation creation from booking engine. Basic guest expectation.

**Should have (differentiators):**
- AI proactive operational suggestions
- Realtime WebSocket on housekeeping board and occupancy calendar
- PDF folio at checkout
- Availability calendar on booking engine (visual date picker)

**Defer to v1.x (post-validation):**
- Drag-and-drop room rack
- AI anomaly detection
- Folio split billing

**Defer to v2+:** Payment gateway, real OTA integrations, online self-check-in, CRM, WhatsApp, GL export, dynamic pricing.

### Architecture Approach

The system follows clean/hexagonal architecture with one NestJS module per bounded context. Cross-module reads go through exported read-only facades; side effects cross boundaries via domain events (`EventEmitter2` + `@OnEvent()`). The shared-kernel is pure TypeScript with no Prisma or NestJS decorators. Single `schema.prisma` file — no PostgreSQL schemas (Prisma multi-schema is experimental). Logical separation via model naming conventions.

**Major components:**

| Context | Owns | Key Invariant |
|---------|------|---------------|
| `shared-kernel` | Money, DateRange, branded IDs, domain events | No DB tables — pure TypeScript |
| `auth` | User, Role, Permission | JWT + RBAC guards; all other modules depend on this |
| `inventory` | Room, RoomType | TWO state machines: physicalStatus (inventory) + cleaningStatus (housekeeping) |
| `pricing` | RatePlan, Season, PricingRule | Composable rule chain; itemized breakdown required for folio |
| `guests` | Guest | Document type + number mandatory; PII encrypted at rest; anonymized_at for erasure |
| `reservations` | Reservation, AvailabilitySlot | Single AvailabilityService; btree_gist exclusion constraint |
| `operations` | Folio, FolioItem, Stay | Append-only folio; void not delete; night audit cron; hotel_business_date |
| `housekeeping` | HousekeepingTask, CleaningStatus | Socket.io gateway emits room:statusUpdate on every transition |
| `reporting` | read-only projections | Reads daily_snapshot; never raw reservations table |
| `ai-assistant` | Conversation, Message | Named typed tools (read-only); enforced at tool layer, not system prompt |
| `channels` | source field on Reservation | Data model only in v1 |

**Realtime rule:** WebSocket for server-initiated push; HTTP REST for client-initiated requests; NestJS SSE for AI token streaming. Never WebSocket for AI streaming.

### Critical Pitfalls

1. **Overbooking race condition** — Use `btree_gist` exclusion constraint on `daterange(check_in_date, check_out_date, '[)')` with `room_id` in PostgreSQL. Application-layer check is defense-in-depth only. Wrap reservation creation in `prisma.$transaction` with `SELECT ... FOR UPDATE`. Requires raw SQL in Prisma migration. Phase: reservations, before any public endpoint.

2. **Date/timezone mismatch** — Store `check_in_date`/`check_out_date` as `DATE` (not TIMESTAMP). Separate `arrived_at`/`departed_at` as TIMESTAMPTZ for audit. Implement `hotel_business_date` as system config advanced by night audit — never use `NOW()::date` in business logic. Store hotel IANA timezone (`America/Bogota`) in config. Phase: database schema, Phase 1 — cannot be retrofitted.

3. **Folio without immutable ledger** — Never DELETE folio entries. Append-only: charges are voided (new negative entry), never removed. Folio snapshot at checkout is immutable. Required for IVA and audit compliance. Phase: operations.

4. **Room state machine — single enum** — Two orthogonal fields: `physicalStatus` (inventory) and `cleaningStatus` (housekeeping). OUT_OF_ORDER rooms excluded from availability at DB query level, not UI. Phase: inventory schema Phase 1; guard enforcement in housekeeping phase.

5. **Night audit skipped** — Without it, multi-night room charges are never posted, reporting is broken, and `hotel_business_date` is undefined. Retrofitting after 2 months of data requires historical reprocessing. Implement as `@Cron('0 3 * * *', { timeZone: 'America/Bogota' })` in same phase as folio. Phase: operations — cannot be deferred.

6. **AI prompt injection and data leakage** — Read-only constraint at tool definitions (not system prompt). No raw SQL tool. Free-text fields sanitized before returning to LLM context. Rate-limit AI endpoint. Audit log all tool calls. Phase: ai-assistant (last).

7. **PII without retention strategy** — Guest document numbers encrypted at rest. `anonymized_at` field on Guest for erasure requests. RBAC at API serialization layer: housekeeping role never receives `document_number` in response DTOs. Phase: guests module.

8. **Railway/PostgreSQL connection limit** — `connection_limit=5` in `DATABASE_URL`. Separate `DIRECT_DATABASE_URL` for Prisma migrations (bypasses PgBouncer). Never instantiate PrismaClient per request. Phase: infrastructure setup, first deploy.

---

## Implications for Roadmap

The phase order below is non-negotiable. Availability logic must exist before booking; folio must exist before checkout; night audit must exist before reporting; everything must exist before the AI assistant.

### Phase 1: Shared Kernel + Auth + Database Schema

**Rationale:** Everything depends on this. Auth guards protect all modules. Shared-kernel types are referenced by every bounded context. Database schema with correct `DATE` columns, `hotel_business_date`, two-field room status, and `btree_gist` extension must exist before any migration runs. Errors here require production data migrations.

**Delivers:** Working authentication, RBAC 4 roles, JWT + refresh tokens, complete Prisma schema with all models, `btree_gist` extension in initial migration, hotel_config table with `hotel_business_date` and IANA timezone, shared-kernel (Money, DateRange, typed IDs, domain event base class).

**Pitfalls addressed:** Date/timezone mismatch, room state machine (schema), PII retention (schema), Railway connection limit.

### Phase 2: Inventory + Pricing

**Rationale:** All reservation logic requires room references and pricing rules.

**Delivers:** Room CRUD (types, characteristics, photos via Cloudflare R2, physical + cleaning status), rate plan CRUD, seasonal overrides, minimum-nights rules. Pricing service returns itemized breakdown — required for folio line items later.

### Phase 3: Guests + Reservations + Public Booking Engine

**Rationale:** Guests and reservations are tightly coupled. The `btree_gist` exclusion constraint must be active before any public booking endpoint goes live.

**Delivers:** Guest registration with mandatory document type + number (TRA-compliant, non-nullable), guest history, reservations CRUD, AvailabilityService (single authoritative source — never replicated), `btree_gist` exclusion constraint active in DB, pessimistic lock in reservation creation transaction, public booking engine (availability search + room listing + reservation submission), booking confirmation email via Resend, `@schedule-x/react` room rack for staff, `react-day-picker` for guests.

### Phase 4: Operations — Check-in, Checkout, Folio, Night Audit, TRA Export

**Rationale:** These form a single atomic operational loop. Check-in requires confirmed reservation + available room. Folio must open atomically in the check-in transaction. Night audit requires the folio to exist. TRA export requires check-in to have captured the required fields. None can be split into sub-phases.

**Delivers:** Check-in workflow (assign room, validate ID, open folio atomically), checkout workflow (close folio, write immutable snapshot, generate PDF bill via `@react-pdf/renderer`), guest folio (append-only ledger — no DELETE, only void entries), charges-to-room (staff posts ad-hoc items to open folio), night audit cron (`@Cron('0 3 * * *', { timeZone: 'America/Bogota' })`) posting room+tax charges, advancing `hotel_business_date`, marking no-shows, writing daily revenue snapshot, TRA Colombia export (CSV/PDF per day or per stay), IVA tax line items on folio (configurable rate, not hardcoded).

### Phase 5: Housekeeping

**Rationale:** Housekeeping depends on inventory (room references) and operations (checkout triggers DIRTY via domain event). Socket.io gateway infrastructure established here.

**Delivers:** Housekeeping board UI, task assignment, cleaning state machine (DIRTY → IN_PROGRESS → INSPECTION → CLEAN) with transition validation, Socket.io gateway emitting `room:statusUpdate` on every transition, realtime updates in PMS dashboard, Socket.io connection state recovery (2-min buffer for Railway redeploys).

### Phase 6: Reporting + Dashboard

**Rationale:** Reporting depends on night audit having populated `daily_snapshot` rows. ADR and RevPAR are incorrect without nightly charge postings.

**Delivers:** KPI dashboard (queried from `daily_snapshot`), filterable reports by date range (occupancy, revenue), CSV export, PDF report export, Recharts/shadcn chart components.

### Phase 7: AI Assistant

**Rationale:** Last — enhances data that must already exist. Builds on reservations, operations (folio), guests, reporting. The AI assistant is a differentiator, not a dependency for the hotel to operate.

**Delivers:** Conversational chat panel (staff-only, JWT + RBAC), NestJS SSE streaming endpoint, 7 typed read-only tools (get_availability, get_occupancy_kpi, find_guest, get_reservation, get_checkins_today, get_checkouts_today, get_folio_summary), PmsReadFacade injecting read-only service methods, conversation history stored server-side, audit log for all tool calls, rate limiting on AI endpoint.

**Security enforced at tool layer (not system prompt):**
- All tool handlers: read-only, no create/update/delete operations
- Tool inputs validated with Zod before calling any service
- LLM receives sanitized DTOs, never raw DB rows
- Free-text fields (guest notes, special requests) sanitized before returning to LLM context
- No raw SQL tool — ever

### Research Flags

**Needs deeper research during planning:**
- **Phase 3:** btree_gist exclusion constraint in Prisma raw SQL migration — verify exact syntax before coding
- **Phase 4:** Colombia IVA accommodation threshold and exemptions — legal review required before folio tax logic
- **Phase 4:** TRA current export format — verify against Ministry of Commerce portal
- **Phase 7:** AsyncIterable → RxJS Observable pipeline for NestJS SSE with Anthropic streaming — verify integration pattern end-to-end

**Standard patterns (skip research-phase):**
- Phase 1: NestJS JWT auth, Prisma schema design
- Phase 2: Prisma CRUD, Cloudflare R2 presigned URLs
- Phase 5: Socket.io gateway in NestJS, @OnEvent cross-module pattern
- Phase 6: Recharts + @react-pdf/renderer

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified against current npm and official docs. Version pins validated. |
| Features | HIGH | Cross-validated against Cloudbeds, Mews, Hotelogix, RoomRaccoon. Three missing requirements identified with authoritative references. |
| Architecture | HIGH (NestJS) / MEDIUM (overbooking, AI) | Bounded context module structure from NestJS official docs. btree_gist from PostgreSQL official docs and booking system design references. AI tool-use from Anthropic official docs. |
| Pitfalls | HIGH (overbooking, DB, Railway, AI) / MEDIUM (night audit, folio, PII) | Overbooking verified against Prisma issue tracker. Night audit and folio from multiple hotel PMS guides. PII from OWASP and Colombian Ley 1581. |

**Overall confidence:** HIGH

### Gaps to Address

- **IVA tax rate for Colombia accommodation:** 19% IVA applies above a threshold for business travelers; leisure travelers may be exempt. Legal validation required before Phase 4 folio tax logic.
- **TRA current export format:** Verify current Ministry of Commerce XML/CSV field schema before Phase 4.
- **btree_gist Prisma raw SQL syntax:** Prisma DSL does not support exclusion constraints. Requires `$executeRaw` in a raw migration.
- **Night audit backfill strategy:** If the cron fails silently (server down at 3 AM), a backfill per business date is needed. Design idempotent night audit from day one.

---

*Research completed: 2026-05-13*
*Ready for roadmap: yes*
