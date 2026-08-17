# Roadmap: HotelOS AI

## Overview

HotelOS AI is built across two milestones. **v1.0** (Phases 1–8) delivered the complete functional PMS — auth, inventory, pricing, guests, reservations, operations, housekeeping, reporting, staff AI, and public concierge. All 26 plans across 8 phases are done.

**v1.1** (Phases 9–11) applies the Claude Design bundle visual identity to every surface of the application. The backend is untouched; the entire milestone lives in `apps/web`. The design source of truth is `.design-fetch/hotelos-ai/project/` — token values, screen layouts, component anatomy, and typography come from that bundle. Phase 9 establishes the token foundation that Phases 10 and 11 consume. Phase 10 replaces the bare booking landing with an Airbnb-style public portal. Phase 11 restyles all internal PMS screens. Execution order is strictly sequential: 9 → 10 → 11.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

### v1.0 — MVP (complete)

- [x] **Phase 1: Foundation** - Shared kernel, auth + RBAC, complete Prisma schema with btree_gist extension and hotel config — DONE
- [x] **Phase 2: Inventory + Pricing** - Room CRUD with dual state machines, rate plans, seasons, and itemized pricing service — DONE (2026-05-15)
- [x] **Phase 3: Guests + Reservations + Booking Engine** - Guest registration, reservation lifecycle with overbooking prevention, public booking engine — DONE
- [x] **Phase 4: Operations** - Check-in/out, append-only folio, night audit cron, TRA Colombia export, room charges — DONE (2026-05-15)
- [x] **Phase 5: Housekeeping** - Cleaning state machine, task assignment, Socket.io realtime gateway — DONE (2026-05-15)
- [x] **Phase 6: Reporting + Dashboard** - KPI dashboard from daily_snapshot, filterable reports, CSV/PDF export — DONE (2026-05-15)
- [x] **Phase 7: Staff AI Assistant** - Conversational chat panel, SSE streaming, 7 read-only PMS tools (staff-only) — DONE (2026-05-15)
- [x] **Phase 8: Concierge IA (Public)** - Guest-facing chatbot on portal subdomain with curated Bogotá catalog and anti-abuse layer — DONE (2026-05-16)

### v1.1 — Visual Identity Implementation

- [x] **Phase 9: Design System Foundation** - Tailwind v4 tokens, Instrument Serif/Geist/Geist Mono fonts, dark mode, status colors, core shadcn primitives refactored (completed 2026-05-17)
- [x] **Phase 10: Public Portal** - Airbnb-style HotelHomePage replacing bare booking landing — hero gallery, nav, reservation widget, reviews, Concierge UI restyle (completed 2026-05-17)
- [x] **Phase 11: Internal Screens Restyle** - Apply bundle visual identity to Login, Dashboard, Calendar, Rooms, Reservations wizard, Housekeeping kanban, Staff Chat panel, Sidebar (completed 2026-05-17)

## Phase Details

### Phase 1: Foundation
**Mode**: mvp
**UI hint**: yes (login screen)
**Goal**: Staff can authenticate with correct roles and the complete database schema — including all critical constraints — exists in production before any feature is written
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, INF-01, INF-02, INF-03, INF-04, INF-05, DSN-01, DSN-02
**Success Criteria** (what must be TRUE):
  1. A staff user can log in with email and password and receive a JWT; the access token expires and the refresh token rotation issues a new pair without re-login
  2. An admin can create a user, assign a role (admin, manager, reception, housekeeping), and deactivate that user from the admin panel
  3. An endpoint protected by `JwtGuard + RolesGuard` returns 401 for unauthenticated requests and 403 for authenticated requests with insufficient role
  4. The initial Prisma migration runs cleanly on Railway PostgreSQL, the `btree_gist` extension is enabled, the `system_config` table exists with `hotel_business_date`, `hotel_timezone`, and `iva_rate` columns, and `DATABASE_URL` has `connection_limit=5`
  5. The shared-kernel value objects (`Money`, `DateRange`, branded IDs, `DomainEvent` base class) are importable by any module with no circular dependencies
  6. The design system tokens (colors, typography, spacing) from `design/DESIGN-SYSTEM.md` are codified as Tailwind config + CSS variables, importable from any screen, and the login screen renders using them
**Plans**: 3 plans

Plans:
- [ ] 01-PLAN-01-monorepo-and-db.md — Turborepo scaffold + Prisma 7 full schema + shared-kernel (Money, DateRange, branded IDs, DomainEvent)
- [ ] 01-PLAN-02-auth-backend.md — JWT auth + refresh rotation + JwtAuthGuard/RolesGuard + user CRUD + rate limiter + seed:admin
- [ ] 01-PLAN-03-design-and-auth-ui.md — Design tokens (tokens.ts + @theme inline) + login screen + auth store + admin users UI + walking skeleton E2E

### Phase 2: Inventory + Pricing
**Mode**: mvp
**UI hint**: yes (room CRUD admin screens — drawer pattern from design)
**Goal**: Staff can fully manage rooms and pricing rules, and the pricing service returns itemized breakdowns that the folio will consume later
**Depends on**: Phase 1
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05, PRC-01, PRC-02, PRC-03, PRC-04
**Success Criteria** (what must be TRUE):
  1. Staff can create, edit, and deactivate a room with number, floor, notes, and room type; room types are configurable with base price and amenities list
  2. Staff can upload room photos; photos are stored in Cloudflare R2 via presigned URLs and served correctly
  3. Each room carries two independent status fields (`physicalStatus` and `cleaningStatus`); setting one does not affect the other; OUT_OF_SERVICE and ON_HOLD rooms are excluded from availability queries at the DB layer
  4. Staff can define a rate plan with seasonal multipliers and minimum-nights rules; calling the pricing service for a date range returns an itemized breakdown (base, season modifier, taxes, total) — not a single number
  5. Room detail uses the right-side drawer pattern from `design/DESIGN-SYSTEM.md` with tabs: Detalles · Reservas · Limpieza · Mantenimiento · Historial
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — G3 session restore fix + RoomTypes CRUD + Rooms CRUD with dual independent status + findAvailableRooms() — DONE (2026-05-15, 12 tests, 3 tasks)
- [x] 02-02-PLAN.md — Cloudflare R2 presigned photo upload + RoomPhoto migration + PhotoUploader UI
- [x] 02-03-PLAN.md — RatePlan + Season CRUD + PricingService.calculateBreakdown() (8 unit tests) + pricing admin UI — DONE (2026-05-15, 8 tests, 3 tasks)

### Phase 3: Guests + Reservations + Public Booking Engine
**Mode**: mvp
**UI hint**: yes (booking engine public + reservation wizard staff)
**Goal**: Guests can book online and staff can manage reservations — and the database constraint makes it physically impossible to overbook a room regardless of concurrent requests
**Depends on**: Phase 2
**Research flag**: btree_gist exclusion constraint raw SQL Prisma migration syntax — verify before coding
**Requirements**: GST-01, GST-02, GST-03, GST-04, GST-05, RES-01, RES-02, RES-03, RES-04, RES-05, RES-06, RES-07, PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, PUB-06
**Success Criteria** (what must be TRUE):
  1. Staff can register a guest with all mandatory fields (full name, document type/number, nationality, date of birth, contact); document number is encrypted at rest; housekeeping-role JWT cannot retrieve `document_number` from the API
  2. Two concurrent HTTP requests attempting to book the same room for overlapping dates result in exactly one CONFIRMED reservation and one 409 Conflict response — verified with the `btree_gist` exclusion constraint present in the migration
  3. Staff can create, modify (dates, room, guest), and cancel reservations; cancelled reservations retain their record with status CANCELLED
  4. A public visitor can search availability by date range, see available rooms with photos and pricing, submit a booking form, and receive a confirmation email via Resend
  5. Public booking endpoints reject requests without CSRF token and are rate-limited; the booking engine date picker uses `react-day-picker` v10 in `mode="range"`
  6. Staff reservation creation uses the 4-step wizard from the design (Fechas y disponibilidad → Seleccionar habitación → Datos del huésped → Confirmar); calendar uses the room rack horizontal grid via `@schedule-x/react`
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — GuestsModule vertical slice: AES-256-GCM encryption + two-DTO RBAC (HOUSEKEEPING field exclusion) + guests UI at /guests
- [x] 03-02-PLAN.md — ReservationsModule backend: btree_gist exclusion-constraint migration + 23P01 → ConflictException + SELECT FOR UPDATE + AvailabilityService SINGLE GUARD
- [x] 03-03-PLAN.md — Staff reservation wizard UI: 4-step wizard + CSS Grid RoomRackCalendar + ReservationDrawer (modify/cancel)
- [x] 03-04-PLAN.md — Public booking engine: CSRF + @nestjs/throttler + Resend fire-and-forget + /booking flow with react-day-picker v10

### Phase 4: Operations
**Mode**: mvp
**UI hint**: yes (check-in/out UI + folio view)
**Goal**: Staff can execute the complete hotel operational loop — check-in atomically opens a folio, nightly charges post automatically, and checkout generates an immutable PDF bill with correct IVA
**Depends on**: Phase 3
**Research flags**:
  - Colombia IVA accommodation rules — legal review of threshold and exemptions before folio tax logic
  - TRA current export format — verify Ministry of Commerce field schema before implementation
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, FOL-01, FOL-02, FOL-03, FOL-04, FOL-05, FOL-06, NA-01, NA-02, NA-03, NA-04, NA-05, NA-06, NA-07, TRA-01, TRA-02, TRA-03, CHG-01, CHG-02
**Success Criteria** (what must be TRUE):
  1. Reception can perform check-in on a CONFIRMED reservation: the folio opens atomically in the same transaction, the room `physicalStatus` becomes OCCUPIED, and the system refuses check-in if `cleaningStatus` is not CLEAN or INSPECTION
  2. After a guest is checked in and the night audit cron runs, the folio shows one room charge + applicable IVA line item per night; `hotel_business_date` advances by one day; reservations with `check_in_date < hotel_business_date` and status CONFIRMED are marked NO_SHOW
  3. Night audit is idempotent — running it twice for the same business date is a no-op; if a day was skipped the system emits an alert and supports manual backfill
  4. A 3-night stay folio after checkout shows 3 room charges + 3 tax lines with correct running balance; checkout writes an immutable snapshot with checksum; a downloadable PDF bill is generated
  5. Admin or manager can trigger a TRA export filtered by date range; the CSV contains full name, document type/number, nationality, date of birth, arrival date, and departure date; housekeeping role cannot trigger the export
  6. Check-in UI uses the inline checklist pattern from the design (verify identity · sign register · deliver key · confirm transfer/extras · change room status)
**Plans**: 4 plans

Plans:
- [x] 04-01-PLAN.md — Check-in/Check-out vertical slice: OperationsService + FolioService (append-only + SHA-256 snapshot) + inline 5-step checklist UI
- [x] 04-02-PLAN.md — Night audit cron (04:00 Bogotá) + idempotency (advisory lock + night_audit_runs) + NO_SHOW + ScheduleModule + advanceBusinessDate + manual charges (FOL-03/CHG-01..02)
- [x] 04-03-PLAN.md — Folio PDF "ESTADO DE CUENTA" via @react-pdf/renderer (server-side) + COP formatter + Descargar PDF button
- [x] 04-04-PLAN.md — TRA Colombia CSV export (ADMIN/MANAGER only) + tra_export_log audit + react-day-picker v10 range UI — DONE (2026-05-15, 8 tests, 3 tasks)

### Phase 5: Housekeeping
**Mode**: mvp
**UI hint**: yes (housekeeping kanban board)
**Goal**: Housekeeping staff see a live kanban board of room cleaning states, manager can assign tasks, and every state transition broadcasts instantly to all connected PMS screens
**Depends on**: Phase 4
**Requirements**: HK-01, HK-02, HK-03, HK-04, HK-05, HK-06
**Success Criteria** (what must be TRUE):
  1. Housekeeping staff sees a 4-column kanban board (Pendientes · En proceso · Listas hoy · Verificadas) grouping rooms by `cleaningStatus`; the board updates in real time without page reload when any room changes state
  2. Valid cleaning state transitions (DIRTY → IN_PROGRESS → INSPECTION → CLEAN) succeed; invalid transitions (e.g., DIRTY → CLEAN directly) are rejected with an error
  3. Manager can assign a housekeeping task to a specific staff member with priority (Alta · Media · Baja); that staff member sees the assignment on their board
  4. When a guest checks out, the room `cleaningStatus` automatically transitions to DIRTY via domain event (no direct cross-module call); this transition is immediately visible on the housekeeping board
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — State machine + HousekeepingTask CRUD + @nestjs/event-emitter checkout→DIRTY listener (closes Phase 4 W2)
- [x] 05-02-PLAN.md — Socket.io gateway (@nestjs/websockets + @nestjs/platform-socket.io) + JWT handshake auth + room:statusUpdate broadcast
- [x] 05-03-PLAN.md — 4-column kanban UI + socket.io-client + RoomStatusModal (click-modal) + TaskAssignmentDrawer (MANAGER/ADMIN)

### Phase 6: Reporting + Dashboard
**Mode**: mvp
**UI hint**: yes (dashboard with KPI cards + occupancy chart)
**Goal**: Staff can see live hotel KPIs and generate date-range reports — all sourced from the `daily_snapshot` populated by night audit, never from raw reservation queries
**Depends on**: Phase 5
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04, RPT-05
**Success Criteria** (what must be TRUE):
  1. Dashboard shows today's occupancy %, ADR, RevPAR, expected arrivals, expected departures, rooms in cleaning, and active service requests as KPI cards matching the design layout; all KPIs are read from `daily_snapshot` rows, not computed from raw reservations at request time
  2. Dashboard shows a 7-day occupancy bar chart and a room status donut (occupied · reserved · cleaning · maintenance) sourced from snapshots
  3. Staff can generate a filtered report by date range showing occupancy, revenue, arrivals, and departures
  4. Reports can be exported to CSV and to PDF (via `@react-pdf/renderer`); exported files are correctly formatted and downloadable
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md — W1 atomicity fix + writeDailySnapshot real KPI computation + report_export_log migration + ReportingModule (DashboardService + 3 read endpoints)
- [x] 06-02-PLAN.md — Dashboard UI (7 KPI cards + Recharts BarChart 7-day occupancy + PieChart donut) wired to /api/reports/*
- [x] 06-03-PLAN.md — Date-range Reports page + CSV (BOM + semicolon + Spanish headers) + PDF (@react-pdf/renderer, 31-day cap) + audit log + RBAC (ADMIN/MANAGER only)

### Phase 7: Staff AI Assistant
**Mode**: mvp
**UI hint**: yes (chat panel with context + suggested actions sidebar)
**Goal**: Authenticated staff can query PMS data in natural language through a streaming chat panel — with read-only access enforced at the tool layer, a full audit trail of every tool call, and a context panel showing data sources and suggested actions
**Depends on**: Phase 6
**Research flag**: NestJS SSE `@Sse()` + Anthropic SDK AsyncIterable → RxJS Observable streaming pipeline — verify integration pattern end-to-end before coding
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, AI-08, AI-09, AI-10, AI-11, AI-12
**Success Criteria** (what must be TRUE):
  1. Authenticated staff can open the chat panel from any screen and receive streaming token-by-token responses via NestJS SSE; unauthenticated requests are rejected
  2. The assistant correctly answers questions using all 7 read-only tools; no write operations exist in any tool definition
  3. AI tool inputs are validated with Zod before any service call; the assistant never receives raw DB rows — only sanitized DTOs; free-text fields are sanitized before entering LLM context
  4. Every AI tool call is logged to the audit table (user, tool, args, timestamp); the endpoint is rate-limited per user; conversation history is persisted server-side and retrievable per user
  5. Chat UI matches the design: right-side context panel showing CONTEXTO ACTIVO · FUENTES CONSULTADAS · ACCIONES SUGERIDAS; messages render rich UI elements (tables, action buttons) when the tool returns structured data
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — Backend foundation: openai SDK + 7 read-only tools + AIToolCallLog migration + conversation REST endpoints
- [x] 07-02-PLAN.md — SSE streaming endpoint + multi-turn loop + tool_calls accumulator + scoped per-user ThrottlerGuard
- [x] 07-03-PLAN.md — Chat UI: ChatPanel + fetch+ReadableStream+Bearer + 3-section context panel + rich tool rendering + conversation list

### Phase 8: Concierge IA (Public)
**Mode**: mvp
**UI hint**: yes (public chatbot on portal subdomain, mobile-first)
**Goal**: Public visitors can chat with a city concierge for restaurant, transport, and activity recommendations in Bogotá — without authentication, but with strong rate limiting, prompt-injection defense, and cost-bounded token usage
**Depends on**: Phase 7
**Requirements**: CON-01, CON-02, CON-03, CON-04, CON-05, CON-06, CON-07, CON-08, CON-09
**Success Criteria** (what must be TRUE):
  1. A public visitor (no login) can open the Concierge chat at `/concierge` from mobile or desktop and receive streaming responses about Bogotá venues, transport, and plans
  2. The assistant exposes 3-4 read-only tools backed by a curated Bogotá catalog stored as DB rows — no internet search, no external API in v1
  3. Each response includes a venue card with name, type, rating, distance from hotel, optional photo, and action buttons
  4. Rate limiting: max 20 messages per IP per hour; circuit breaker globally caps daily token spend; over-limit requests return a friendly message
  5. Prompt-injection defenses active; all tool calls and user messages audit-logged; catalog admin available from internal screen
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md — Backend foundation: schema + 4 read-only tools registry + TokenBudgetService + audit log + admin CRUD + R2 photo presign + CSV import
- [x] 08-02-PLAN.md — SSE streaming endpoint + trust proxy fix + IpThrottlerGuard + CSRF middleware + pre-call budget check
- [x] 08-03-PLAN.md — Public chat UI (/concierge mobile-first + VenueCard + PublicConciergeLayout) + Admin catalog screen

---

## v1.1 Phases — Visual Identity Implementation

> **Scope constraint**: All three phases touch `apps/web` only. No backend (`apps/api`) changes unless Phase 10 requires a minor system-config endpoint to expose `hotelName` / photo URLs — that is the only acceptable exception.
> **Design source of truth**: `.design-fetch/hotelos-ai/project/` (tokens.jsx, screens/*.jsx)
> **Hotel name**: `system_config.hotelName` ("Mi Hotel Boutique"). The bundle uses "Hotel Sumapaz" as a design placeholder — do not hard-code it.
> **Dark mode**: VIS-03 is in scope. Language toggle (🌐) deferred to v1.2.

### Phase 9: Design System Foundation
**Mode**: mvp
**UI hint**: yes (token plumbing — not user-visible features but foundation everything else consumes)
**Goal**: Every color, font, and status semantic in the application comes from a single CSS-variable source of truth; no component contains a hardcoded hex value; dark mode toggling and all status colors work consistently before any screen is restyled
**Depends on**: Nothing (independent foundation; v1.0 phases are complete)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05
**Success Criteria** (what must be TRUE):
  1. Running `rg '#[0-9a-fA-F]{3,6}' apps/web/src --glob '*.{tsx,ts,css}' --ignore-case` (excluding the tokens config file itself) returns zero matches in any component or page file — all color references are `var(--token-name)` or Tailwind utility classes derived from tokens
  2. Toggling `data-theme="dark"` on the `<html>` element (or `.hos` root) switches the entire application palette within one paint frame; the preference is read from `localStorage` on mount and persisted on toggle
  3. All six status states (available · reserved · occupied · cleaning · maintenance · blocked) render with consistent foreground/background pairs using the `data-status` pill pattern from `tokens.jsx` — verified by visiting Rooms, Calendar, Housekeeping, and Dashboard and confirming the same hex values are used across all four screens
  4. The three font families (Instrument Serif for h1/h2/h3/display, Geist for body, Geist Mono for numeric values) are loaded from Google Fonts and render correctly in both Chrome and Firefox; no fallback system font is visible for any heading or KPI number
  5. Core shadcn primitives (Button, Card, Input, Badge) read their colors exclusively from CSS variables; no inline `style={{ color: '#...' }}` or hardcoded Tailwind color class (e.g., `text-blue-500`) remains in any primitive
**Plans**: 4 plans

Plans:
- [x] 09-01-PLAN.md — Token migration (globals.css + tokens.ts/spec to bundle palette) + `.hos` root class on `<html>` + Google Fonts `@import` + StaffLayout token rename (VIS-01, VIS-02, VIS-04)
- [x] 09-02-PLAN.md — Refactor Button + Card + Input to bundle utilities; add `terracotta` Button variant (VIS-05)
- [x] 09-03-PLAN.md — Create Badge + StatusPill + useTheme hook + ThemeToggle + inline FOUC script in index.html (VIS-03, VIS-04, VIS-05)
- [x] 09-04-PLAN.md — Dev-only `/design-system` demo route + Vitest smoke test (vertical-slice verification of VIS-01..05)

### Phase 10: Public Portal
**Mode**: mvp
**UI hint**: yes (full Airbnb-style landing replacing current bare search form)
**Goal**: A visitor landing on `/` (or `/booking`) sees a rich hotel landing page — hero gallery, hotel identity, navigation sections, a sticky reservation widget, and curated reviews — that reflects the bundle design; the Concierge public chat UI is also restyled with the warm palette
**Depends on**: Phase 9 (all tokens, fonts, and primitive styles must be in place)
**Requirements**: PUB-07, PUB-08, PUB-09, PUB-10, PUB-11, PUB-12, PUB-13
**Success Criteria** (what must be TRUE):
  1. Visiting `/` (or `/booking`) renders `HotelHomePage` without any console errors; the hotel name shown comes from `VITE_HOTEL_NAME` env var with fallback "Hotel Sumapaz" (system_config endpoint deferred to v1.2 — see 10-CONTEXT.md decision #1); the hero gallery, top navigation, and main content sections are visible on a 1280px desktop viewport
  2. The top navigation bar shows five items (Inicio · Habitaciones · Restaurante · Concierge · Ubicación); clicking each performs an anchor-scroll to the corresponding section within the same page; no separate routes are created for Restaurante or Ubicación
  3. At viewport width 360px (mobile), the layout reflows to single-column: the reservation widget drops to a fixed bottom bar, the photo gallery collapses to a 2-column 2-row grid, and all text remains legible without horizontal overflow
  4. The reservation widget (desktop: sticky right sidebar; mobile: bottom bar) contains a functional `react-day-picker` v10 range picker, a guest counter, a price-per-night display, and a "Reservar" button that navigates to `/booking/rooms`; no booking logic changes — only layout and styling
  5. The Reseñas section renders an aggregated rating, review count, and at least four sample review cards; review data is hardcoded in the component for v1.1 (no API)
  6. Visiting `/concierge` shows the public chat UI with warm-palette message bubbles, terracotta send button, Instrument Serif headings in VenueCard titles, and a background color of `var(--warm-paper)`
**Plans**: 6 plans

Plans:
- [x] 10-01-PLAN.md — Public portal scaffolding: data files (hotel/roomTypes/reviews/photos) + hooks (useHotelInfo env-var, useReservationDraft URL params, useForceLightTheme) + types + .env.example (PUB-07, PUB-12)
- [x] 10-02-PLAN.md — HotelHomePage shell + TopNav + HeroGallery + HotelIdentity + PortalFooter + router wiring (`/` and `/booking` → HotelHomePage) + BookingPage → LegacyBookingPage rename (PUB-07, PUB-08, PUB-09, PUB-12)
- [x] 10-03-PLAN.md — Section components (RoomsSection, ConciergeTeaser, RestaurantSection, LocationSection, ReviewsSection) (PUB-07, PUB-11, PUB-12)
- [x] 10-04-PLAN.md — ReservationWidget (desktop sidebar + mobile bottom bar variants) with react-day-picker v10 range + guest counter + Reservar → /booking/rooms (PUB-10, PUB-12)
- [x] 10-05-PLAN.md — Concierge public chat restyle: ConciergePage + ChatMessage + VenueCard + PublicConciergeLayout warm-palette pass + useForceLightTheme (PUB-13)
- [x] 10-06-PLAN.md — Vitest smoke tests (HotelHomePage + useReservationDraft + useForceLightTheme) + MANUAL-QA-CHECKLIST.md (PUB-07, PUB-09, PUB-10, PUB-12)

### Phase 11: Internal Screens Restyle
**Mode**: mvp
**UI hint**: yes (all staff PMS screens restyled to bundle identity)
**Goal**: Every internal staff screen — Login, Dashboard, Calendar, Rooms, Reservations wizard, Housekeeping, Staff Chat, and Sidebar — renders with the bundle visual identity; all existing functionality is preserved unchanged
**Depends on**: Phase 9 (tokens + primitives); Phase 10 must complete before Phase 11 starts (sequential to avoid shared-file conflicts on StaffLayout and shadcn primitives)
**Requirements**: INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, INT-07, INT-08
**Success Criteria** (what must be TRUE):
  1. Visiting `/login` renders the split-panel design: left panel uses `var(--ink-1)` background with terracotta + mustard radial-gradient decorative blobs, Instrument Serif italic heading "Hospitalidad, operada con inteligencia", and a three-stat strip (habitaciones · ocupación · check-ins hoy); right panel shows the email/password form with terracotta primary button and a "Ir al sitio del hotel" secondary link
  2. Visiting `/dashboard` shows the page title in Instrument Serif italic at 32px, all KPI card numbers in Geist Mono with `var(--warm-paper)` card background, and Recharts bars colored with `var(--terracotta)` for the highlighted day and `var(--mustard)` for other days — matching the `HosDashboard` screen from the bundle
  3. The `RoomRackTable` calendar shows reservation bars color-coded by status using the six `--status-*` tokens (terracotta for occupied, mustard for cleaning, reserved-blue for reserved); room numbers in the row headers use Geist Mono; hover and selected-cell states are visually distinct
  4. `RoomsPage` renders rooms as cards with photo placeholder, room number in Geist Mono, type label, and a status pill using the `data-status` pattern; `RoomDrawer` opens with `var(--warm-cream)` background, tab row, and amenity chips using `hos-pill` styling
  5. `ReservationWizard` renders a visual stepper where the active step uses terracotta, completed steps use mustard, and pending steps use `var(--warm-tan)`; step labels use Geist at 13px
  6. `HousekeepingPage` kanban renders four columns (Pendiente · En proceso · Listo · Verificado) matching the bundle layout with priority badges (Alta=terracotta, Media=mustard, Baja=olive), assignee initials in a circular avatar, and time-elapsed labels in Geist Mono
  7. `ChatPanel` (staff AI) shows message bubbles with `var(--warm-paper)` user background and `var(--warm-white)` assistant background; the right context panel uses Instrument Serif for section headings (FUENTES CONSULTADAS, ACCIONES SUGERIDAS); tool result cards use `hos-card` styling with `hos-pill` badges
  8. `StaffLayout` Sidebar shows lucide icons in `var(--ink-3)`, the active navigation item has a 2px terracotta left accent bar and `var(--terracotta-tint)` background, and the sidebar collapses/expands with a CSS transition of 200ms or less
**Plans**: 9 plans

Plans:
- [x] 11-01-PLAN.md — Shared utilities (status-colors.ts + useSidebarCollapsed) + StaffLayout topbar shell + Sidebar restyle with collapse mechanism + ThemeToggle footer mount + router.tsx ProtectedRoute token fix (INT-08)
- [x] 11-02-PLAN.md — LoginPage split-panel: left ink-1 with radial blobs + three-stat strip, right warm-white with terracotta submit + 'Ir al sitio del hotel' link (INT-01)
- [x] 11-03-PLAN.md — DashboardPage Instrument Serif h1 + KpiCard warm restyle + OccupancyBarChart terracotta/mustard via shape prop + RoomStatusDonut via STATUS_COLORS (INT-02)
- [x] 11-04-PLAN.md — RoomRackCalendar + RoomRackTable: status-tokened reservation bars via RESERVATION_STATUS_TO_CSS inline style + font-mono headers + hover/select states (INT-03)
- [x] 11-05-PLAN.md — RoomsPage table → card grid migration (4-col responsive) + RoomDrawer warm-cream + tab row + amenity chips (INT-04)
- [x] 11-06-PLAN.md — ReservationWizard StepIndicator component + 4 step files (Step1Dates/Step2Room/Step3Guest/Step4Confirm) token migration (INT-05)
- [x] 11-07-PLAN.md — HousekeepingPage 4-column kanban with priority badges (Alta/Media/Baja) + assignee avatars + time-elapsed labels — data-testid preserved verbatim (INT-06)
- [x] 11-08-PLAN.md — Staff ChatPanel 2-col layout + ContextPanel Instrument Serif headings + ChatMessage warm-palette bubbles (INT-07)
- [x] 11-09-PLAN.md — Phase 11 verification: full vitest regression + zero-hex/zero-palette/zero-.hos-* checks + manual QA checklist + v1.1 milestone closeout


## Milestone v1.2 — Public Data Wiring

**Goal:** Eliminar toda data hardcodeada del portal público. Cada cambio del admin se refleja en `hotelsumapaz.co`.

**Execution order (sequential):** Phase 12 → Phase 13 → Phase 14

---

### Phase 12: Public Data API + Frontend Wiring
**Mode**: mvp
**UI hint**: no (backend endpoints + frontend query wiring, no new visual design)
**Goal**: Public portal renders hotel name, address, room types, prices, and hero photos from backend API instead of hardcoded TS modules; admin's existing CRUD edits on RoomTypes + system_config propagate to `/booking` on refresh
**Depends on**: Phase 2 (Inventory CRUD), Phase 10 (Public Portal layout — consumes this)
**Requirements**: PDA-01, PDA-02, PDA-03, PDA-04, PDA-05, PDA-06, PDA-07, PDA-08
**Success Criteria** (what must be TRUE):
  1. Three public endpoints respond 200 without `Authorization` header: `GET /api/public/hotel-info`, `GET /api/public/room-types`, `GET /api/public/hotel-photos`. Each returns valid JSON matching its declared shape.
  2. Admin opens `RoomTypeDrawer`, changes the basePrice for "Doble Estándar" from 280000 to 295000, saves; refresh `/booking` shows the new price in `RoomsSection.tsx` within the next request cycle (cache-control max-age=60s honored)
  3. `apps/web/src/features/public-portal/data/{hotel,roomTypes,photos}.ts` no longer exist OR contain only fallback constants used when API errors; primary data path is TanStack Query
  4. `HotelHomePage` renders skeleton states (matching bundle layout) while initial queries are pending; renders error toast with retry button on query failure
  5. `LegacyBookingPage.tsx` deleted (cleanup from v1.1 deprecation); zero references in `router.tsx` or any feature
  6. All Phase 10 Vitest tests still pass after wiring (regression safety)
**Plans**: 5 plans

Plans:
- [x] 12-01-PLAN.md — Prisma migration `20260523000000_phase12_public_portal_data` + idempotent seed-phase12.ts (extends system_config, adds isPublished to room_types, creates hotel_photos table)
- [x] 12-02-PLAN.md — PublicPortalModule (controller + service + Zod DTOs) — 3 GET endpoints with Cache-Control max-age=60, badge computed in service, AppModule registration
- [x] 12-03-PLAN.md — Frontend TanStack Query hooks (useHotelInfo rewrite + useRoomTypes + useHotelPhotos) + public-portal.api.ts client + types.ts updates
- [x] 12-04-PLAN.md — Section wiring (HotelHomePage orchestration, skeletons.tsx, HeroGallery/HotelIdentity/RoomsSection/PortalFooter consumers, inline error banner with Reintentar)
- [x] 12-05-PLAN.md — Cleanup + regression gate (delete data/roomTypes.ts, data/photos.ts, LegacyBookingPage.tsx; full vitest regression; vertical-slice demo verification)

---

### Phase 13: Hotel Settings Admin Page
**Mode**: mvp
**UI hint**: yes (new admin form + gallery manager — consumes Phase 9 primitives)
**Goal**: Admin can edit hotel identity (name, address, tagline, description, phone, tags) and manage hero gallery photos (upload, reorder, delete) from a new staff-only `/settings/hotel` route — without touching env vars or DB
**Depends on**: Phase 12 (public API exposes the data this page edits)
**Requirements**: HSP-01, HSP-02, HSP-03, HSP-04, HSP-05, HSP-06
**Success Criteria** (what must be TRUE):
  1. `/settings/hotel` route exists in `router.tsx`, gated by ADMIN role via existing `RolesGuard`; non-admin staff sees 403 forbidden state
  2. Form renders all 6 editable fields with current values prefilled from `useSystemConfig()`; react-hook-form + zodResolver validates client-side; submit calls `PATCH /api/system-config` and shows success toast
  3. Gallery manager renders current hero photos as draggable thumbnails (drag-to-reorder via lightweight CSS or @dnd-kit), upload button triggers presigned R2 flow (already exists in Phase 2), delete button shows confirmation dialog
  4. `hotel_photos` table or columns exist in Prisma schema with `displayOrder` indexed; migration applied to Railway DB
  5. Admin edits hotel name → saves → opens `/booking` in a new tab → new name visible in `HeroIdentity` + `TopNav` + `PortalFooter` after refresh
  6. Backend audit log records every `PATCH /api/system-config` with `{userId, fields_changed, before, after}`
**Plans**: 5 plans

Plans:
- [x] 13-01-PLAN.md — Migration (address + key + system_config_change_log) + SystemConfig.update + PublicPortalService dual-shape resolution
- [x] 13-02-PLAN.md — HotelPhotos admin module (presign + confirm + reorder + delete) with R2 reuse + Vitest spec
- [x] 13-03-PLAN.md — /settings/hotel page + HotelInfoForm + TagsInput + Sidebar nav + Textarea/AlertDialog primitives
- [x] 13-04-PLAN.md — HotelGalleryManager + PhotoThumbnail (HTML5 drag) + 4 photo hooks + admin GET endpoint
- [x] 13-05-PLAN.md — Regression gate + manual QA checklist (9 scenarios) + Phase 13 closeout

---

### Phase 14: Public Reviews System
**Mode**: mvp
**UI hint**: yes (review submit form + staff moderation queue + portal aggregation)
**Goal**: Real guests can submit reviews via post-checkout email link; admin moderates from staff page; published reviews display on `/booking` Reseñas section with aggregated rating; hardcoded reviews data deleted
**Depends on**: Phase 12 (public API patterns), Phase 4 (night-audit cron sends emails), Phase 3 (Resend integration)
**Requirements**: REV-01, REV-02, REV-03, REV-04, REV-05, REV-06, REV-07, REV-08
**Success Criteria** (what must be TRUE):
  1. `reviews` Prisma table exists with required columns + index on `(moderated, publishedAt)`; migration applied
  2. Post-checkout cron (existing in Phase 4 night-audit) enqueues email to checked-out guest via Resend with `/review/submit?token=...` link; token is signed JWT valid 90 days, single-use
  3. Guest visits `/review/submit?token=...`, sees form (5-star rating + comment textarea), submits → review created with `moderated=false`
  4. Staff `/reviews` page (any staff role) shows pending queue; admin clicks "Aprobar" → review becomes `moderated=true, publishedAt=now()`; portal Reseñas refreshes within cache window
  5. `ReviewsSection.tsx` consumes `GET /api/public/reviews?page=1&limit=10` query; aggregated rating computed server-side; pagination "Ver más" loads next page
  6. `apps/web/src/features/public-portal/data/reviews.ts` deleted; no hardcoded review content anywhere in the frontend
  7. Rate limit on `POST /api/public/reviews`: 1 submission per token, 5 submissions per IP per hour (uses existing `@nestjs/throttler`)
**Plans**: 6 plans

Plans:
- [x] 14-01-PLAN.md — Migration (Review table + Reservation columns + CHECK constraint) + ReviewsModule backend (5 endpoints + dedicated `reviews-submit` throttler + single-use JWT via DB unique + P2002 catch)
- [x] 14-02-PLAN.md — Night-audit cron extension + sendReviewInvite email (re-throws on failure) + .env.example (REVIEW_TOKEN_SECRET + FRONTEND_BASE_URL)
- [x] 14-03-PLAN.md — Public /review/submit page (useForceLightTheme + standalone layout + StarRatingInput a11y + react-hook-form + zodResolver)
- [x] 14-04-PLAN.md — Portal ReviewsSection rewire (self-fetching + averageRating server-side) + DELETE data/reviews.ts + ReviewsSectionSkeleton
- [x] 14-05-PLAN.md — Staff /reviews moderation page (3 tabs + Sidebar nav under Administración with MessageSquareText) + cross-cache invalidation (admin + public queryKeys)
- [x] 14-06-PLAN.md — Regression gate + manual QA (8 scenarios) + Phase 14 closeout + v1.2 milestone closeout

---

## Milestone v1.3 — Guest Communication Hub

> **Milestone v1.3 — Guest Communication Hub: COMPLETE — 12 GCC-IDs shipped across Phases 15+16 (2026-05-19)**

**Goal:** Capturar datos completos de contacto del huésped + permitir comunicación staff↔huésped vía deep-links con notificación real-time. **Pasarela de pago diferida a v1.4**.

**Execution order (sequential):** Phase 15 → Phase 16

---

### Phase 15: Extended Contact Capture
**Mode**: mvp
**UI hint**: yes (campos extra en BookingFormPage público)
**Goal**: BookingFormPage público captura preferencias de contacto + restricciones dietarias + special requests; backend persiste todo en Guest; email de confirmación incluye resumen de preferencias capturadas
**Depends on**: Phase 3 (BookingFormPage existente + Resend + Guest schema), Phase 12 (cache-control patterns para portal)
**Requirements**: GCC-01, GCC-02, GCC-03, GCC-04, GCC-05
**Success Criteria** (what must be TRUE):
  1. Prisma `Guest` model tiene 6 columnas nuevas nullable (preferredLanguage default 'es', contactPreference enum nullable, whatsappNumber String nullable, marketingConsent Boolean default false, dietaryRestrictions String? max 500, specialRequests String? max 1000); migración aplicada a Railway DB
  2. BookingFormPage público renderea sección "Preferencias de contacto" colapsable con: WhatsApp number input (formato E.164 con validación client-side), contactPreference radio buttons (Email/Phone/WhatsApp), marketingConsent checkbox; sección "Preferencias adicionales" con dietaryRestrictions + specialRequests textareas
  3. Reservar con campos extra completos retorna 201 y persiste todos los valores en el Guest row; reservar sin completar los opcionales también funciona (no breaking change)
  4. Email de confirmación incluye sección "Sus preferencias" SI el huésped llenó al menos un campo opcional; si todos null, la sección no aparece
  5. PATCH `/api/guests/:id` (staff auth) acepta updates parciales de cualquier campo nuevo; respuesta 200 con guest actualizado; validación Zod E.164 rechaza whatsappNumber inválido con 400
**Plans**: 4 plans

Plans:
- [x] 15-01-PLAN.md — Prisma migration `20260519000001_phase15_extended_guest_contact` + ContactPreference enum + CreateGuestSchema (Zod) + GuestsService explicit field mapping in create + update (GCC-01, GCC-02)
- [x] 15-02-PLAN.md — CreatePublicBookingSchema extension + PublicBookingService tx.guest.create explicit mapping + txResult type widening + BookingConfirmationParams +4 scalars + buildPreferencesSection with inline escapeHtml against XSS (GCC-03, GCC-05)
- [x] 15-03-PLAN.md — BookingFormPage.tsx 2 native `<details>` collapsible sections (contact + adicionales) + extended Zod guestFormSchema with WhatsApp space-strip transform + Ley 1581 opt-in marketing consent + token-correct field errors (GCC-04)
- [x] 15-04-PLAN.md — Full tsc + vitest regression gate + 7-scenario manual QA checklist + human sign-off checkpoint + atomic STATE/ROADMAP/REQUIREMENTS closeout (GCC-01..05)

---

### Phase 16: Guest Detail + Deep Links + Contact Events
**Mode**: mvp
**UI hint**: yes (nueva ruta staff /guests/:id con sección "Últimos contactos" en tiempo real)
**Goal**: Staff abre detalle del huésped, ve info completa de contacto, hace click en Llamar/WhatsApp/Email; cada click registra evento en DB ANTES de abrir el deep link; toast confirma localmente + sección "Últimos contactos" se actualiza + otras sesiones staff reciben push Socket.io para evitar doble contacto
**Depends on**: Phase 15 (campos extra de Guest), Phase 5 (Socket.io ya configurado para Housekeeping)
**Requirements**: GCC-06, GCC-07, GCC-08, GCC-09, GCC-10, GCC-11, GCC-12
**Success Criteria** (what must be TRUE):
  1. Tabla `guest_contact_events` existe con `{id, guestId FK, staffUserId FK, method (CALL|WHATSAPP|EMAIL), notes String?, createdAt}` indexada en `(guestId, createdAt desc)`; migración aplicada
  2. POST `/api/guests/:id/contact-events` (staff auth, body `{method, notes?}`) crea evento y retorna 201 con event row; GET `/api/guests/:id/contact-events?limit=5` retorna eventos recientes con `staffUser.name` joined
  3. Socket.io room `guest:{guestId}` emite `contact-event.created` con `{eventId, method, staffUserId, staffUserName, createdAt}` cuando se crea evento; otras sesiones staff suscritas reciben el push
  4. Ruta staff `/guests/:id` renderea header (nombre + documento + nationality + dateOfBirth), Información de contacto (email + phone + WhatsApp + preferences) con botón "Editar" inline, Reservaciones (lista todas las reservaciones del huésped con link a cada una), Últimos contactos (últimos 5 eventos con staff name + método + tiempo relativo)
  5. Componente `<ContactButtons />` renderea 3 botones (Llamar/WhatsApp/Email) en guest detail header y reservation detail row; click en cualquier botón ejecuta secuencialmente: (a) POST a contact-events, (b) abre deep link (`tel:` / `wa.me/{e164}?text={prefilled}` / `mailto:{email}?subject={prefilled}`), (c) muestra toast "✓ Contacto registrado por {método}", (d) invalida query `['guest', id, 'contact-events']`
  6. `useGuestContactEvents(guestId)` hook combina TanStack Query con Socket.io subscription al room `guest:{guestId}`; al recibir evento de OTRA sesión, invalida query Y muestra toast informativo `"{staffName} inició contacto por {método} con este huésped"`
  7. Sidebar nav "Huéspedes" enlazado a `GuestsPage.tsx` (ya existe) extendido con columna "Último contacto" (formato relativo: "hace 2h" / "nunca"); click en row navega a `/guests/:id`
**Plans**: 7 plans

**Plans: 7 plans**

Plans:
- [x] 16-00-PLAN.md — Wave 0 infra: install sonner + date-fns + mount Toaster (apps/web) — DONE (2026-05-19)
- [x] 16-01-PLAN.md — Wave 1 backend: Prisma migration `20260527000000_phase16_guest_contact_events` + GuestContact module (controller + service + gateway with dynamic rooms + DTOs + tests) + AppModule registration (GCC-06, GCC-07, GCC-08) — DONE (2026-05-19)
- [x] 16-02-PLAN.md — Wave 2 backend: extend GET /api/guests with lastContactEvent (no N+1) + update GuestLike type + both DTO transformers (GCC-12 backend) — DONE (2026-05-19)
- [x] 16-03-PLAN.md — Wave 2 frontend: shared Socket.io singleton (lib/socket.ts) + guest-contact.api.ts + types + useGuestContactEvents hook (GCC-08 frontend, GCC-11) — DONE (2026-05-19)
- [x] 16-04-PLAN.md — Wave 3 frontend: GuestDetailPage (4 sections + inline edit) + ContactButtons (3 deep-link buttons with toast + invalidation) + router /guests/:id (GCC-09, GCC-10) — DONE (2026-05-19)
- [x] 16-05-PLAN.md — Wave 3 frontend: GuestsPage extension — Último contacto column + row click navigation (GCC-12 frontend) — DONE (2026-05-19)
- [x] 16-06-PLAN.md — Wave 4 closeout: full regression + 8-scenario manual QA + Phase 16 CLOSEOUT + V1.3 MILESTONE CLOSEOUT + STATE/ROADMAP updates (GCC-06..12) — DONE (2026-05-19)

---

## Milestone v1.4 — Quality and Security Infrastructure

> Triggered by external QA audit (2026-05-22) — Sections 10/11/12 P2 items never closed in v1.3. Pure infrastructure milestone; no new product features.

**Goal:** Build CI/CD gates, automated E2E, security automation, and performance baseline so future feature work cannot silently regress quality.

### Phase 17: CI/CD Gates
**Goal:** Every push and PR runs audit + typecheck + lint + tests via GitHub Actions. PRs to master require all checks green to merge.
**Requirements:** QSI-01, QSI-02, QSI-03, QSI-04
**Success criteria:**
  1. .github/workflows/ci.yml runs on push + PR
  2. Workflow executes pnpm install --frozen-lockfile, pnpm audit --prod, per-workspace tsc, lint, tests
  3. Branch protection on master requires ALL checks green
  4. Cold-cache CI run completes in under 5 minutes
**Plans:** TBD by gsd-plan-phase 17

### Phase 18: Playwright E2E
**Goal:** Critical user flows + responsive smoke covered by real-browser tests, runs in CI.
**Requirements:** QSI-05, QSI-06, QSI-07, QSI-08, QSI-09, QSI-10, QSI-11
**Success criteria:**
  1. Playwright installed in apps/web with chromium + mobile config
  2. Smoke test asserts public portal renders at 360/768/1024/1440 without horizontal scroll
  3. Critical flow login → dashboard → logout covered
  4. Critical flow wizard reservation creation covered
  5. Critical flow drag-to-move calendar covered with real browser DnD
  6. Error boundaries asserted for nonexistent routes and 4xx/5xx
  7. Suite integrated in CI with retry-once on flakes
**Depends on:** Phase 17 (CI workflow exists)
**Plans:** TBD

### Phase 19: Backend Coverage Gaps
**Goal:** Close test coverage gaps — authz matrix, API contracts, throttling burst, regression for refresh race.
**Requirements:** QSI-12, QSI-13, QSI-14, QSI-15
**Success criteria:**
  1. authz-matrix.spec enumerates every staff endpoint × every role with 200/403 assertions
  2. API contract test verifies every controller returns consistent error shape on 4xx/5xx
  3. Throttling burst test fires N+1 requests against booking/reviews/concierge and asserts 1×429
  4. Concurrent /auth/refresh race test — 5 concurrent same-cookie calls produce 1×200 + 4×401, never 500
**Depends on:** Phase 17 (CI workflow exists)
**Plans:** TBD

### Phase 20: Security Automation
**Goal:** Dependabot + Semgrep + AI abuse + secrets sweep all run in CI.
**Requirements:** QSI-16, QSI-17, QSI-18, QSI-19
**Success criteria:**
  1. .github/dependabot.yml weekly PRs for npm + GitHub Actions
  2. Semgrep CI step on p/security-audit + p/typescript; HIGH blocks PR, MEDIUM/LOW comment
  3. AI abuse fixtures test prompt-injection on staff AI + Concierge IA; any execution failure fails CI
  4. gitleaks / Trufflehog scans every PR diff for secrets; documented allowlist
**Depends on:** Phase 17
**Plans:** TBD

### Phase 21: Performance Baseline
**Goal:** k6 load tests + Lighthouse CI with persisted baseline.
**Requirements:** QSI-20, QSI-21, QSI-22, QSI-23
**Success criteria:**
  1. k6 script for POST /api/public/bookings — 50 VUs ramp 60s, p95 < 800ms, error rate < 1%
  2. k6 script for /api/public/concierge/chat SSE — 20 concurrent streams, no token-budget breach, no 5xx
  3. Lighthouse CI on / with performance ≥ 80, a11y ≥ 95, best practices ≥ 90, SEO ≥ 90
  4. Baseline metrics persisted to .planning/quality-baseline.md for future regression comparison
**Depends on:** Phase 17
**Plans:** TBD

---

## Progress

**v1.0 Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (complete)
**v1.1 Execution Order:** 9 → 10 → 11 (complete)
**v1.2 Execution Order:** 12 → 13 → 14 (complete)
**v1.3 Execution Order:** 15 → 16 (complete)
**v1.4 Execution Order:** 17 → 18 → 19 → 20 → 21 (complete)
**v1.5 Execution Order:** Polish & Defect Cleanup (complete)
**v1.6 Execution Order:** 22 → 23 (complete)
**v1.7 Execution Order:** 24 → 25 → 26 → 27 (planned)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | PASS_WITH_GAPS (9 gaps → Phase 1.1) |
| 1.1 Foundation polish | 1/1 | Complete | 2026-05-14 |
| 2. Inventory + Pricing | 3/3 | Complete | 2026-05-15 |
| 3. Guests + Reservations + Booking Engine | 4/4 | Complete | 2026-05-15 |
| 4. Operations | 4/4 | Complete | 2026-05-15 |
| 5. Housekeeping | 3/3 | Complete | 2026-05-15 |
| 6. Reporting + Dashboard | 3/3 | Complete | 2026-05-15 |
| 7. Staff AI Assistant | 3/3 | Complete | 2026-05-15 |
| 8. Concierge IA (Public) | 3/3 | Complete | 2026-05-16 |
| 9. Design System Foundation | 4/4 | Complete | 2026-05-17 |
| 10. Public Portal | 6/6 | Complete | 2026-05-17 |
| 11. Internal Screens Restyle | 9/9 | Complete | 2026-05-17 |
| 12. Public Data API + Wiring | 5/5 | Complete | 2026-05-18 |
| 13. Hotel Settings Admin Page | 5/5 | Complete | 2026-05-18 |
| 14. Public Reviews System | 6/6 | Complete | 2026-05-18 |
| 15. Extended Contact Capture | 4/4 | Complete | 2026-05-19 |
| 16. Guest Detail + Deep Links + Contact Events | 7/7 | Complete | 2026-05-19 |
| 17. CI/CD Gates | 1/1 | Complete | 2026-05-22 |
| 18. Playwright E2E | 1/1 | Complete | 2026-05-22 |
| 19. Backend Coverage Gaps | 1/1 | Complete | 2026-05-22 |
| 20. Security Automation | 1/1 | Complete | 2026-05-22 |
| 21. Performance Baseline | 1/1 | Complete | 2026-05-22 |
| 22. Concierge Hotel Knowledge | 1/1 | Complete | 2026-05-23 |
| 23. Staff AI Role-Based Tool Filtering | 1/1 | Complete | 2026-05-23 |
| 24. Pre-arrival Reminder | 3/3 | Complete | 2026-06-19 |
| 25. Email Templates | 4/4 | Complete | 2026-06-19 |
| 26. Online Reservation Completion | 4/4 | Complete | 2026-06-19 |
| 27. Documentation Retroactive v1.0 | 2/2 | Complete | 2026-06-19 |
