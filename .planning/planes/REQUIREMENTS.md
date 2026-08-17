# HotelOS AI — Requirements v1

**Project:** HotelOS AI — Single-tenant Hotel PMS + Booking Engine + Dual AI Assistants
**Version:** v1 (MVP)
**Status:** Active (hypotheses — ship to validate)
**Last updated:** 2026-05-13

---

## v1 Requirements

### Auth & RBAC

- [x] **AUTH-01**: Staff user can log in with email and password
- [x] **AUTH-02**: User session is maintained via JWT access token + refresh token rotation
- [x] **AUTH-03**: User can log out from any page (token revoked server-side)
- [x] **AUTH-04**: System enforces 4 roles: admin, manager, reception, housekeeping
- [x] **AUTH-05**: Each module endpoint requires both `JwtGuard` and `RolesGuard` checks
- [x] **AUTH-06**: Admin can create, edit, and deactivate users from admin panel

### Inventory (Rooms)

- [x] **INV-01**: Staff can create, edit, and deactivate rooms (number, floor, notes) — done in 02-01
- [x] **INV-02**: Staff can define room types (single, double, suite, etc.) with base price and amenities — done in 02-01
- [x] **INV-03**: Staff can upload room photos (stored in Cloudflare R2 via presigned URLs)
- [x] **INV-04**: Each room carries two orthogonal states: `physicalStatus` (AVAILABLE | OCCUPIED | OUT_OF_SERVICE | ON_HOLD) and `cleaningStatus` (DIRTY | IN_PROGRESS | INSPECTION | CLEAN) — done in 02-01
- [x] **INV-05**: OUT_OF_SERVICE and ON_HOLD rooms are excluded from availability queries at the DB layer — done in 02-01

### Pricing

- [x] **PRC-01**: Staff can define rate plans per room type
- [x] **PRC-02**: Staff can configure seasons (high, mid, low) with date ranges and multipliers
- [x] **PRC-03**: Staff can define minimum-nights rules per season
- [x] **PRC-04**: Pricing service returns itemized breakdown (base, season modifier, taxes, total) — not a single total, because folio requires line items

### Guests

- [x] **GST-01**: Staff can register guests with mandatory fields: full name, document type, document number, nationality, date of birth, contact (email + phone)
- [x] **GST-02**: Guest document number is encrypted at rest
- [x] **GST-03**: Staff can view guest history (past stays, total nights, total spent)
- [x] **GST-04**: System supports guest anonymization (sets `anonymized_at` timestamp; PII fields nulled) for GDPR/Ley 1581 erasure requests
- [x] **GST-05**: Housekeeping role does NOT receive `document_number` in response DTOs (serialization-layer RBAC)

### Reservations

- [x] **RES-01**: Staff can create reservations (select guest, room type or specific room, check-in date, check-out date)
- [x] **RES-02**: Staff can modify reservations (dates, room, guest details) before check-in
- [x] **RES-03**: Staff can cancel reservations (status set to CANCELLED, not deleted)
- [x] **RES-04**: Overbooking is prevented via PostgreSQL `btree_gist` exclusion constraint on `daterange(check_in_date, check_out_date, '[)')` per room, scoped to non-cancelled status
- [x] **RES-05**: Reservation creation uses `prisma.$transaction` with `SELECT ... FOR UPDATE` on the room row (defense-in-depth)
- [x] **RES-06**: System exposes a single `AvailabilityService` — no other module computes availability independently
- [x] **RES-07**: Reservation has explicit `source` field (DIRECT, WALK_IN, OTA_FUTURE) — channels data model prepared, no real OTA integration in v1
- [ ] **RES-08**: Staff reservation creation flow uses the 4-step wizard from the design (Fechas → Habitación → Datos huésped → Confirmar)

### Public Booking Engine

- [x] **PUB-01**: Public visitor can search availability by date range and number of guests
- [x] **PUB-02**: Public visitor sees only AVAILABLE rooms with photos, type, and price for selected dates
- [x] **PUB-03**: Public visitor can submit a reservation (creates CONFIRMED reservation + guest record)
- [x] **PUB-04**: Booking engine uses `react-day-picker` v10 (mode="range") for date selection
- [x] **PUB-05**: Booking confirmation email is sent automatically via Resend after successful reservation
- [x] **PUB-06**: Public booking endpoints are rate-limited and behind CSRF protection

### Operations — Check-in / Check-out

- [x] **OPS-01**: Reception can perform check-in for a CONFIRMED reservation: assigns specific room, validates guest ID, opens folio atomically in the check-in transaction, sets reservation to CHECKED_IN, sets room `physicalStatus` to OCCUPIED
- [x] **OPS-02**: Reception can perform check-out: closes folio (immutable snapshot), generates PDF bill via `@react-pdf/renderer`, sets reservation to CHECKED_OUT, sets room `cleaningStatus` to DIRTY via domain event
- [x] **OPS-03**: System refuses check-in if room `cleaningStatus` is not CLEAN or INSPECTION (configurable hotel policy)
- [x] **OPS-04**: Check-out generates a downloadable folio PDF
- [x] **OPS-05**: Check-in UI uses inline checklist (verify ID · sign register · deliver key · confirm transfer · change room status) per design

### Operations — Guest Folio

- [x] **FOL-01**: Each active stay has exactly one open folio
- [x] **FOL-02**: Folio is append-only — entries are never DELETED; corrections post a new voiding entry referencing the original
- [x] **FOL-03**: Staff can post ad-hoc charges to an open folio (item description, amount, tax rate)
- [x] **FOL-04**: Folio shows itemized breakdown with running balance
- [x] **FOL-05**: Folio close at check-out writes an immutable snapshot with checksum
- [x] **FOL-06**: IVA (or configurable tax) is calculated and posted as a separate folio line item — tax rate is configurable per item type, NOT hardcoded

### Operations — Night Audit

- [x] **NA-01**: System runs night audit cron at 03:00 hotel local time (`@Cron('0 3 * * *', { timeZone: '<config>' })`)
- [x] **NA-02**: Night audit posts room charge + applicable taxes to every open folio for every guest still checked in
- [x] **NA-03**: Night audit advances `hotel_business_date` (system config) by one day
- [x] **NA-04**: Night audit marks reservations as NO_SHOW if their `check_in_date < hotel_business_date` and status is still CONFIRMED
- [x] **NA-05**: Night audit writes a daily_snapshot row (revenue, ADR, occupancy %, RevPAR) for reporting
- [x] **NA-06**: Night audit is idempotent — if it ran already for a given `hotel_business_date`, re-running is a no-op
- [x] **NA-07**: Night audit emits an alert if it skips a day (server down at 03:00) and supports manual backfill per business date

### Operations — TRA Colombia Compliance

- [x] **TRA-01**: System exposes an export of guest registrations (full name, document type, document number, nationality, date of birth, arrival date, departure date) filtered by date range
- [x] **TRA-02**: Export is available in CSV format (additional formats per Ministerio de Comercio current spec)
- [x] **TRA-03**: Only admin and manager roles can trigger the TRA export

### Housekeeping

- [x] **HK-01**: Housekeeping staff sees a board of rooms grouped by `cleaningStatus` (4-column kanban per design: Pendientes · En proceso · Listas hoy · Verificadas)
- [x] **HK-02**: Housekeeping staff can transition a room through valid cleaning states (DIRTY → IN_PROGRESS → INSPECTION → CLEAN); invalid transitions are rejected
- [x] **HK-03**: Manager can assign housekeeping tasks to specific staff with priority (Alta · Media · Baja)
- [x] **HK-04**: Every cleaning state transition emits a `room:statusUpdate` event over Socket.io
- [x] **HK-05**: PMS dashboard receives realtime updates and reflects new states without page reload
- [x] **HK-06**: Check-out automatically transitions room `cleaningStatus` to DIRTY via domain event (no direct cross-module call)

### Operations — Charges to Room

- [x] **CHG-01**: Staff can post item charges (description, amount, quantity) to an open folio without going through a POS
- [x] **CHG-02**: Charges are immediately reflected on the folio with timestamp and posting staff member

### Reporting & Dashboard

- [x] **RPT-01**: Dashboard shows live KPIs: today's occupancy %, ADR, RevPAR, arrivals expected, departures expected, rooms in cleaning, active service requests
- [x] **RPT-02**: KPIs are queried from `daily_snapshot` (not from raw reservations)
- [x] **RPT-03**: Staff can generate a filtered report by date range (occupancy, revenue, arrivals/departures)
- [x] **RPT-04**: Reports can be exported to CSV
- [x] **RPT-05**: Reports can be exported to PDF via `@react-pdf/renderer`
- [ ] **RPT-06**: Dashboard renders 7-day occupancy bar chart + room status donut (per design)

### Staff AI Assistant

- [x] **AI-01**: Authenticated staff users can open a chat panel from any screen
- [x] **AI-02**: AI responses stream token-by-token via NestJS SSE (`@Sse()` decorator)
- [x] **AI-03**: AI exposes exactly 7 read-only typed tools: `get_availability`, `get_occupancy_kpi`, `find_guest`, `get_reservation`, `get_checkins_today`, `get_checkouts_today`, `get_folio_summary`
- [x] **AI-04**: AI has NO write tools — read-only constraint is enforced at the tool definition layer (not the system prompt)
- [x] **AI-05**: AI tool inputs are validated with Zod before any service call
- [x] **AI-06**: AI receives sanitized DTOs from tools, never raw DB rows
- [x] **AI-07**: Free-text fields (guest notes, special requests) are sanitized before entering the LLM context
- [x] **AI-08**: AI endpoint is JWT + RBAC protected (staff only; never public)
- [x] **AI-09**: All AI tool calls are logged to an audit table (user, tool, args, timestamp)
- [x] **AI-10**: AI endpoint is rate-limited per user
- [x] **AI-11**: Conversation history is persisted server-side and retrievable per user
- [x] **AI-12**: Chat UI renders the right-side context panel showing CONTEXTO ACTIVO · FUENTES CONSULTADAS · ACCIONES SUGERIDAS (per design)

### Concierge IA (Public, Guest-Facing)

- [x] **CON-01**: Public visitor (no login required) can open the Concierge chat at `<portal>/concierge` on mobile or desktop
- [x] **CON-02**: Concierge responses stream token-by-token via NestJS SSE
- [x] **CON-03**: Concierge exposes 3-4 read-only typed tools: `search_venues`, `get_venue_detail`, `get_transport_info`, `get_event_info` — all backed by a curated Bogotá catalog stored in the DB, never live external APIs in v1
- [x] **CON-04**: Concierge has NO write tools and NO access to PMS data — separation enforced at the tool definition layer (different tool module from staff AI)
- [x] **CON-05**: Each venue response renders as a card with name, type, rating, distance from hotel, optional photo, and action buttons (`Cómo llegar` deep link, `Llamar` tel link, `Reservar` if applicable)
- [x] **CON-06**: Rate limiting — max 20 messages per IP per rolling hour; over-limit returns a friendly message; admin can adjust limit per environment
- [x] **CON-07**: Token-budget circuit breaker — global daily Anthropic spend cap (configurable); when reached, Concierge serves a friendly "estamos descansando" message until reset
- [x] **CON-08**: Prompt-injection defenses — user input sanitized and length-capped; system prompt locked in code (not template-stringified from user data); all messages and tool calls audit-logged
- [x] **CON-09**: Admin can manage the Bogotá catalog (add/edit/disable venues, set categories, photos, contact info) from an internal screen

### Design System

- [ ] **DSN-01**: Design tokens (colors, typography, spacing, radii) from `design/DESIGN-SYSTEM.md` are codified as Tailwind config + CSS custom properties — both back/front read from the same single source
- [ ] **DSN-02**: A theme provider initializes the design tokens; CSS variables are available globally; every component reads tokens, never hardcoded hex values

### Infrastructure & Deploy

- [x] **INF-01**: `DATABASE_URL` includes `connection_limit=5` for Railway connection pooling
- [x] **INF-02**: `DIRECT_DATABASE_URL` exists (separate from `DATABASE_URL`) and bypasses PgBouncer — used exclusively for Prisma migrations
- [x] **INF-03**: Application is deployed on Railway (back + DB + front static)
- [x] **INF-04**: Initial Prisma migration enables `btree_gist` extension
- [x] **INF-05**: System config table holds `hotel_business_date` (DATE), `hotel_timezone` (IANA), and `iva_rate` (decimal)

## v1.1 Requirements — Visual Identity Implementation

**Milestone:** v1.1 Visual Identity
**Started:** 2026-05-17
**Goal:** Implement the Claude Design bundle visual system across all existing v1.0 screens — public and internal — without touching backend functionality.

### Design System Foundation (Phase 9)

- [x] **VIS-01**: Tailwind v4 config exports all bundle tokens (warm-paper, warm-cream, ink-1..4, terracotta, terracotta-deep, terracotta-soft, mustard, olive, clay) as CSS variables and Tailwind utility classes; no hardcoded hex values in any component
- [x] **VIS-02**: Instrument Serif (display, italic-capable), Geist (body), and Geist Mono (numerics) are loaded from Google Fonts and applied via global CSS; all h1/h2/h3 use Instrument Serif
- [x] **VIS-03**: Dark mode toggles via `data-theme="dark"` on `<html>` (or `.hos` root); dark palette from bundle is the inverse mapping; toggle button persists choice to `localStorage`
- [x] **VIS-04**: Status colors (available/reserved/occupied/cleaning/maintenance/blocked) exist as utility classes with consistent fg/bg pairs; used identically across Rooms, Calendar, Housekeeping, Dashboard
- [x] **VIS-05**: Core shadcn primitives (Button, Card, Input, Drawer/Sheet replacement, Badge, Pill) are refactored to read tokens; no inline styles or hardcoded colors

### Public Portal (Phase 10)

- [x] **PUB-07**: Route `/` (or `/booking` as alias) renders `HotelHomePage` with hero gallery + hotel name (from `system_config.hotelName`) + rating + location pills + description; replaces the current search-form-only landing
- [x] **PUB-08**: Photo gallery shows 4 hero photos (desktop) / 3 (mobile) in CSS Grid layout with "Ver las N fotos" overlay
- [x] **PUB-09**: Top navigation displays: Inicio · Habitaciones · Restaurante · Concierge · Ubicación; anchor-scrolls to sections (no separate routes for restaurante/ubicacion in v1.1)
- [x] **PUB-10**: Reservation widget renders as sticky right sidebar on desktop (≥1024px) and as bottom bar on mobile; includes date range picker (react-day-picker v10), guest counter, price breakdown, "Reservar" button → navigates to `/booking/rooms`
- [x] **PUB-11**: Reseñas section shows aggregated rating + count + 4-5 curated sample reviews; review data hardcoded in v1.1 (real review system → v2)
- [x] **PUB-12**: Layout is responsive at viewport breakpoints 360px (mobile), 768px (tablet), 1280px (desktop) — same React tree, CSS-driven
- [x] **PUB-13**: `/concierge` public chat UI is restyled with bundle tokens — VenueCard uses warm palette + terracotta action buttons + Instrument Serif headings

### Internal Screens Restyle (Phase 11)

- [x] **INT-01**: `/login` renders the split-panel design — left panel dark with branding + mini hotel stats, right panel warm with email/password form + terracotta primary button + Geist Mono email hint
- [x] **INT-02**: `/dashboard` applies tokens — h1/h2 Instrument Serif italic, KPI cards with warm-paper bg + ink-1 numbers in Geist Mono, Recharts bar/donut colors reference bundle palette
- [x] **INT-03**: `RoomRackTable.tsx` (calendar) restyled — reservation bars color-coded by status (terracotta=occupied, mustard=cleaning, olive=reserved), numbers in Geist Mono, hover/select states
- [x] **INT-04**: `RoomsPage` grid renders rooms as cards (photo placeholder + room number + type + status badge) per bundle; `RoomDrawer` opens with warm cream background + tabs + amenities chips
- [x] **INT-05**: `ReservationWizard` 4-step renders visual stepper (active step terracotta, completed mustard, pending warm-tan); page transitions match bundle pacing
- [x] **INT-06**: `HousekeepingPage` kanban renders 4 columns per bundle — Pendiente / En proceso / Listo / Verificado — with priority badges, assignee avatars, time-elapsed indicators
- [x] **INT-07**: `ChatPanel` staff (Phase 7 existing) restyled — message bubbles warm palette, context panel right with FUENTES CONSULTADAS in serif headings, rich tool results use Card + Badge bundle styles
- [x] **INT-08**: `Sidebar` (`StaffLayout`) restyled — lucide icons in ink-3, active item with terracotta left accent bar, collapsible with smooth transition

---

## v1.2 Requirements — Public Data Wiring

### Public Data API + Frontend Wiring (Phase 12)

- [ ] **PDA-01**: Backend endpoint `GET /api/public/hotel-info` (no auth) returns `{ name, address, tagline, description, phone, rating, reviewCount, tags[] }` from `system_config`. Cache-Control: `public, max-age=60` for CDN compatibility.
- [ ] **PDA-02**: Backend endpoint `GET /api/public/room-types` (no auth) returns array of `{ id, name, capacity, description, basePrice, photos[], badge? }` filtered to `isPublished=true`. Hides cost-only fields. Sorted by `basePrice` ascending.
- [ ] **PDA-03**: Backend endpoint `GET /api/public/hotel-photos` (no auth) returns hero gallery as `{ url, alt, displayOrder }[]` sorted by displayOrder.
- [ ] **PDA-04**: Frontend `apps/web/src/features/public-portal/hooks/useHotelInfo.ts` replaced with TanStack Query consuming `/api/public/hotel-info`; Vite env vars become fallback only when API errors.
- [x] **PDA-05**: Frontend `data/roomTypes.ts` hardcoded module deleted; `RoomsSection.tsx` consumes `useRoomTypes()` query directly.
- [x] **PDA-06**: Frontend `data/photos.ts` hardcoded module deleted; `HeroGallery.tsx` consumes `useHotelPhotos()` query directly.
- [x] **PDA-07**: Skeleton loading states (Tailwind `animate-pulse` placeholders matching the bundle layout) render while queries are pending; toast error state with retry button on query failure.
- [x] **PDA-08**: `LegacyBookingPage.tsx` deleted permanently (from v1.1 deprecation). Any lingering imports removed.

### Hotel Settings Admin Page (Phase 13)

- [x] **HSP-01**: Backend `PATCH /api/system-config` (ADMIN role only) accepts partial updates of `{ name, address, tagline, description, phone, tags }` with Zod validation + audit log entry. Done — Phase 13-01 (2026-05-18)
- [x] **HSP-02**: Backend new schema column or table `hotel_photos` with `{ id, url, alt, displayOrder, uploadedAt }`. Migration adds + indexes `displayOrder`. R2 already provides storage. Done — Phase 13-01 (2026-05-18)
- [x] **HSP-03**: Frontend new route `/settings/hotel` (ADMIN only via existing `RolesGuard`) with form to edit hotel name, address, tagline, description, phone, tags. Uses react-hook-form + zod shared schema with backend. Done — Phase 13-03 (2026-05-18)
- [x] **HSP-04**: Frontend gallery manager component on same page: drag-to-reorder, upload via existing `presign-photo` flow, delete with confirmation. Shows live preview of hero gallery. Done — Phase 13-04 (2026-05-18)
- [x] **HSP-05**: Backend `POST /api/admin/hotel-photos`, `PATCH /api/admin/hotel-photos/reorder`, `DELETE /api/admin/hotel-photos/:id` (ADMIN role). All hit R2 via presigned URLs (no proxy through API). Done — Phase 13-02 (2026-05-18)
- [x] **HSP-06**: Phase 12's `/api/public/hotel-info` and `/api/public/hotel-photos` reflect changes from HSP-03/HSP-04/HSP-05 immediately after admin save (no caching beyond the 60s `max-age`). Done — Phase 13-01 + 13-04 (2026-05-18)

### Public Reviews System (Phase 14)

- [x] **REV-01**: Prisma schema new table `reviews` with `{ id, guestName, rating (1-5), comment (text), stayDate, reservationId?, moderated (default false), publishedAt?, createdAt }`. Migration adds index on `(moderated, publishedAt)`. Done — Phase 14-01 (2026-05-18)
- [x] **REV-02**: Backend `POST /api/public/reviews` accepts review submission with one-time token (signed JWT) issued in post-checkout email. Token expires 90 days. Rate limit 1 submission per token. Done — Phase 14-01 + 14-03 (2026-05-18)
- [x] **REV-03**: Backend `GET /api/public/reviews?page=N&limit=M` returns paginated `moderated=true && publishedAt IS NOT NULL` reviews. Default 10 per page. Sorted by `publishedAt` desc. Done — Phase 14-01 (2026-05-18)
- [x] **REV-04**: Backend `PATCH /api/reviews/:id/moderate` (ADMIN) sets `moderated=true` and `publishedAt=now()`. `DELETE /api/reviews/:id` rejects rather than publishes (soft delete). Done — Phase 14-01 + 14-05 (2026-05-18)
- [x] **REV-05**: Frontend `ReviewsSection.tsx` (Phase 10 component) replaces hardcoded `data/reviews.ts` with `useReviews()` query. Aggregated rating computed server-side and returned with paginated payload. Done — Phase 14-04 (2026-05-18)
- [x] **REV-06**: Frontend new staff page `/reviews` (any staff role, not only ADMIN) with moderation queue: pending reviews list + approve/reject actions + preview of how it will look on portal. Done — Phase 14-01 + 14-05 (2026-05-18)
- [x] **REV-07**: Backend night-audit cron (existing in Phase 4) enqueues post-checkout email via Resend with `{guestName, stayDate, reviewSubmitToken}` — links to `/review/submit?token=...` frontend page (new). Email sent 1 day after `CHECKED_OUT`. Done — Phase 14-02 (2026-05-18)
- [x] **REV-08**: Frontend new route `/review/submit?token=...` (public, no auth) validates token via backend, then renders review form (stars + comment). Submits to PDA-02 endpoint. Done — Phase 14-03 (2026-05-18)

---

## v1.3 Requirements — Guest Communication Hub

### Extended Contact Capture (Phase 15)

- [x] **GCC-01**: Prisma schema — extender `Guest` con campos opcionales: `preferredLanguage` (default `es`), `contactPreference` (enum `EMAIL | PHONE | WHATSAPP`, nullable), `whatsappNumber` (String?, validado formato E.164), `marketingConsent` (Boolean default false), `dietaryRestrictions` (String?, max 500 chars), `specialRequests` (String?, max 1000 chars). Migration añade columnas nullable, sin breaking change para reservations existentes.
- [x] **GCC-02**: Backend — extender `Guest` DTOs (CreateGuestDto + UpdateGuestDto) con los nuevos campos vía Zod. Validación E.164 para `whatsappNumber`. Endpoint PATCH `/api/guests/:id` (staff auth) acepta updates parciales.
- [x] **GCC-03**: Backend — endpoint público `POST /api/public/bookings` (Phase 3) acepta los nuevos campos en el payload de guest. Sin breaking change: campos opcionales.
- [x] **GCC-04**: Frontend público — `BookingFormPage.tsx` extendido con sección "Preferencias de contacto" (collapsible/expandible): WhatsApp number, contact preference (radio), marketing consent (checkbox). Sección "Preferencias adicionales" con dietary restrictions + special requests (textareas). Validación client-side con react-hook-form + zod (schema compartido).
- [x] **GCC-05**: Backend — `buildConfirmationHtml` (Phase 3) extendido para incluir resumen de preferencias capturadas si el huésped llenó alguno de los campos opcionales. No incluye sección si todos son null.

### Guest Detail + Deep Links + Contact Events (Phase 16)

- [x] **GCC-06**: Prisma schema — nueva tabla `guest_contact_events` con `{id, guestId (FK), staffUserId (FK to User), method (enum CALL | WHATSAPP | EMAIL), notes (String?), createdAt}`. Indexed on `(guestId, createdAt desc)`.
- [x] **GCC-07**: Backend — endpoints `POST /api/guests/:id/contact-events` (staff auth, body `{method, notes?}`, returns event row) + `GET /api/guests/:id/contact-events?limit=5` (staff auth, returns recent events with staff user name joined).
- [x] **GCC-08**: Backend — Socket.io room `guest:{guestId}` emits `contact-event.created` con `{eventId, method, staffUserId, staffUserName, createdAt}` cuando se crea un evento. Otras sesiones staff subscritas reciben el push en tiempo real.
- [x] **GCC-09**: Frontend staff — nueva ruta `/guests/:id` (cualquier staff role) con secciones: header (nombre + documento + nationality + dateOfBirth), Información de contacto (email + phone + WhatsApp + preferences) con botones "Editar" inline, Reservaciones (lista de todas las reservaciones del huésped, link a cada una), Últimos contactos (sección mostrando los últimos 5 eventos con staff name + método + tiempo relativo).
- [x] **GCC-10**: Frontend staff — botones de acción en guest detail header + en cada reservation row: `<ContactButtons guestId email phone whatsapp />` que rendera 3 botones (Llamar / WhatsApp / Email). Cada botón: (a) POST a `/api/guests/:id/contact-events` con el método, (b) abre el deep link correspondiente (`tel:` / `wa.me/{phone}?text={prefilled}` / `mailto:{email}?subject={prefilled}`), (c) muestra toast "✓ Contacto registrado por {método}", (d) invalida query `['guest', id, 'contact-events']` para que aparezca en la sección.
- [x] **GCC-11**: Frontend staff — `useGuestContactEvents(guestId)` hook con TanStack Query + Socket.io subscription. Al recibir evento Socket.io `contact-event.created`, invalida la query Y muestra toast `"María Pérez inició contacto por WhatsApp con este huésped"` (informativo, no requiere acción).
- [x] **GCC-12**: Frontend staff — Sidebar nav item "Huéspedes" ya existe (Phase 3). `GuestsPage.tsx` extender con columna "Último contacto" (relativo: "hace 2h" / "nunca"). Click en row navega a `/guests/:id`.

---



---

## v1.4 Requirements — Quality & Security Infrastructure

**Milestone:** v1.4 Quality & Security Infrastructure
**Started:** 2026-05-22
**Goal:** Build the CI/CD + automated testing + security automation + performance baseline foundation so future feature work cannot regress quality silently. No new product features — pure infrastructure.

### CI/CD Gates (Phase 17)

- [ ] **QSI-01**: GitHub Actions workflow `.github/workflows/ci.yml` runs on every push and PR. Executes (in this order): `pnpm install --frozen-lockfile`, `pnpm audit --prod` (failing on high/critical), per-workspace `pnpm tsc --noEmit`, `pnpm --filter @hotel/web lint`, `pnpm --filter @hotel/api test -- --run`, `pnpm --filter @hotel/web test -- --run`.
- [ ] **QSI-02**: Workflow fails fast — typecheck error stops downstream; audit high/critical stops downstream.
- [ ] **QSI-03**: Branch protection rule on `master`: PRs require all CI checks to pass before merge. Documented in `.github/CONTRIBUTING.md`.
- [ ] **QSI-04**: Workflow runs in under 5 minutes on cold cache via pnpm cache + Turbo remote cache (if configured).

### Playwright E2E (Phase 18)

- [ ] **QSI-05**: Playwright installed in `apps/web` with `@playwright/test`. Config covers chromium + mobile viewport (`Pixel 5`).
- [ ] **QSI-06**: Smoke test: public portal at 360px / 768px / 1024px / 1440px — no horizontal scroll, hero gallery visible, reservation widget reachable.
- [ ] **QSI-07**: Critical flow: login → dashboard → logout (with token-expiry simulation in middleware).
- [ ] **QSI-08**: Critical flow: staff creates a reservation via 4-step wizard (Phase 3).
- [ ] **QSI-09**: Critical flow: drag-to-move event in calendar (OBS-005 from QA sweep) — uses real browser DnD, validates backend persistence.
- [ ] **QSI-10**: Error boundaries: navigate to `/dashboard/nonexistent`, assert friendly fallback UI (not white screen). Same for 4xx/5xx API responses.
- [ ] **QSI-11**: E2E test suite integrated into CI workflow (QSI-01), runs after unit tests, with retry-once on flakes.

### Backend Coverage Gaps (Phase 19)

- [ ] **QSI-12**: Authz matrix test — table-driven test enumerating every staff endpoint × every role combination, asserting 200 / 403 expected per matrix. Single source of truth in `apps/api/src/shared/guards/__tests__/authz-matrix.spec.ts`.
- [ ] **QSI-13**: API contract test — for every controller endpoint, validate that all documented status codes (400/401/403/404/409/422 as applicable) actually return with consistent error shape `{ message, statusCode, error }`. Catches NestJS exception leaks (500 on Prisma errors etc.).
- [ ] **QSI-14**: Throttling burst test — fire N+1 requests in rapid succession against rate-limited endpoint (booking, reviews, concierge), assert N succeeded + 1 returned 429.
- [ ] **QSI-15**: Concurrent token refresh race test (regression for 2026-05-22 bugfix) — fire 5 concurrent `/auth/refresh` calls with same cookie, assert 1 success + 4 × 401, NEVER 500.

### Security Automation (Phase 20)

- [ ] **QSI-16**: Dependabot configured in `.github/dependabot.yml` — weekly PRs for security updates on npm packages + GitHub Actions versions.
- [ ] **QSI-17**: Semgrep CI step added to QSI-01 workflow — runs default `p/security-audit` ruleset + `p/typescript`. PR blocking only on HIGH severity findings; MEDIUM/LOW surface as PR comments.
- [ ] **QSI-18**: AI abuse test suite — fixture set of prompt-injection inputs (system override attempts, tool-call hijacking, jailbreak prompts) against both staff AI and Concierge IA. Each must refuse without executing the injected instruction. Failure of ANY case fails CI.
- [ ] **QSI-19**: Secrets sweep — Trufflehog or `gitleaks` action added to CI; scans the diff of every PR for accidentally committed secrets. Documented allowlist for known false positives in `.gitleaks.toml`.

### Performance Baseline (Phase 21)

- [ ] **QSI-20**: k6 load test script for `/api/public/bookings` — 50 VUs, ramping over 60s, asserting p95 < 800ms, error rate < 1%.
- [ ] **QSI-21**: k6 script for `/api/public/concierge/chat` (SSE endpoint) — 20 concurrent streams, no token-budget breach, no 5xx, all streams complete.
- [ ] **QSI-22**: Lighthouse CI configured for `/` (public portal) — performance score ≥ 80, accessibility ≥ 95, best practices ≥ 90, SEO ≥ 90. Runs in PR comment mode (informational, not blocking — to avoid flakes).
- [ ] **QSI-23**: Baseline metrics persisted in `.planning/quality-baseline.md` after first successful run — future regressions compare against this.

---

## v2 Requirements (deferred — table stakes not in v1)

- [ ] Real OTA integrations (Booking.com, Expedia, Airbnb) via Channel Manager
- [ ] Payment gateway (Stripe / Mercado Pago / local Colombian processor) — **CONFIRMED OUT OF SCOPE 2026-05-23** (user decision). Not scheduled for v1.5+. Reservations remain CONFIRMED without online payment; settlement happens at check-in/check-out via offline methods.
- [ ] Online self check-in for guests
- [ ] CRM / loyalty / guest segmentation
- [ ] WhatsApp / SMS integration for guest communication
- [ ] Full restaurant POS (carta, mesas, comandas)
- [ ] GL export to accounting software
- [ ] Dynamic / AI-driven pricing
- [ ] Drag-and-drop on room rack
- [ ] Folio split billing
- [ ] AI anomaly detection (proactive ops alerts)
- [ ] Concierge IA with live Foursquare/Google Places integration (v1 uses curated catalog only)

---

## Out of Scope (explicit exclusions)

- **Multi-tenant / multi-hotel** — Architectural decision. Single-tenant only. v2 redesign would be required.
- **Native mobile apps** — Web responsive only. No iOS/Android binaries.
- **Real-time channel manager sync** — Requires OTA business accounts, contracts, certification. v2+.
- **Accounting general ledger** — Out of product scope. v2 exports to external accounting software.
- **PCI-DSS compliance** — Deferred with payments. No card data is stored anywhere in v1.

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-01..06 | Phase 1 — Foundation | Complete |
| INF-01..05 | Phase 1 — Foundation | Complete |
| DSN-01, DSN-02 | Phase 1 — Foundation | Complete |
| INV-01, INV-02, INV-04, INV-05 | Phase 2 Plan 01 — Inventory CRUD | Done (2026-05-15) |
| INV-03 | Phase 2 Plan 02 — Photo Upload | Complete |
| PRC-01..04 | Phase 2 — Inventory + Pricing | Done — 02-03 (2026-05-15) |
| GST-01..05 | Phase 3 — Guests + Reservations + Booking Engine | Complete |
| RES-01..03 | Phase 3 — Guests + Reservations + Booking Engine | Done — 03-02/03-03 (2026-05-15) |
| RES-04..08 | Phase 3 — Guests + Reservations + Booking Engine | Done — RES-04..07 (03-02), RES-08 (03-03) |
| PUB-01..06 | Phase 3 — Guests + Reservations + Booking Engine | Done — 03-04 (2026-05-14) |
| OPS-01..05 | Phase 4 — Operations | Done — 04-01/04-02 (2026-05-15) |
| FOL-01..06 | Phase 4 — Operations | Done — 04-01/04-02/04-03 (2026-05-15) |
| NA-01..07 | Phase 4 — Operations | Done — 04-02 (2026-05-15) |
| TRA-01..03 | Phase 4 — Operations | Done — 04-04 (2026-05-15) |
| CHG-01..02 | Phase 4 — Operations | Done — 04-01/04-02 (2026-05-15) |
| HK-01..06 | Phase 5 — Housekeeping | Complete (2026-05-15) |
| RPT-01..05 | Phase 6 — Reporting + Dashboard | Complete (2026-05-15) |
| RPT-06 | Phase 6 — Reporting + Dashboard | Complete (2026-05-15) |
| AI-01..12 | Phase 7 — Staff AI Assistant | Complete (2026-05-15) |
| CON-01..09 | Phase 8 — Concierge IA (Public) | Complete (2026-05-16) |
| VIS-01, VIS-02, VIS-03, VIS-04, VIS-05 | Phase 9 — Design System Foundation | Complete (2026-05-17) |
| PUB-07, PUB-08, PUB-09, PUB-10, PUB-11, PUB-12, PUB-13 | Phase 10 — Public Portal | Complete (2026-05-17) |
| INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, INT-07, INT-08 | Phase 11 — Internal Screens Restyle | Complete (2026-05-17) |
| PDA-01..08 | Phase 12 — Public Data API + Wiring | Complete (2026-05-18) |
| HSP-01..06 | Phase 13 — Hotel Settings Admin Page | Complete (2026-05-18) |
| REV-01..08 | Phase 14 — Public Reviews System | Complete (2026-05-18) |
| GCC-01..05 | Phase 15 — Extended Contact Capture | Complete (2026-05-19) |
| GCC-06..12 | Phase 16 — Guest Detail + Deep Links + Contact Events | Complete (2026-05-19) |

**Total v1 REQ-IDs: 95** (was 79; +9 Concierge + 2 Design System + 5 design-driven additions: RES-08, OPS-05, HK-01 refined, RPT-01 expanded, RPT-06, AI-12)
**Total v1.1 REQ-IDs: 20** (VIS-01..05 × 5, PUB-07..13 × 7, INT-01..08 × 8)
**Total v1.2 REQ-IDs: 22** (PDA-01..08 × 8, HSP-01..06 × 6, REV-01..08 × 8)
**Total v1.3 REQ-IDs: 12** (GCC-01..12 × 12)
**Grand total mapped: 149**

---

*All v1 requirements are hypotheses until shipped and validated.*
