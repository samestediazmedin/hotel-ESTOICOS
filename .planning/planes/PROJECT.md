# HotelOS AI

## What This Is

HotelOS AI es un **sistema operativo hotelero single-tenant** para un hotel específico en Colombia (no SaaS multi-hotel). Cubre tres audiencias:

- **Staff del hotel** (PMS — Property Management System): recepción, housekeeping, reservas internas, reportes y administración.
- **Huéspedes para reservar** (Booking Engine público): búsqueda de disponibilidad y reserva online vía `<dominio-hotel>/portal`.
- **Huéspedes para consultar la ciudad** (Concierge IA público): chatbot que recomienda restaurantes, transporte y planes en Bogotá vía `<dominio-hotel>/concierge`.

Tiene **dos asistentes IA distintos**, no uno:

1. **Asistente staff** (interno, autenticado): chat con acceso de lectura al PMS. Responde preguntas sobre reservas, ocupación, próximos check-ins, etc. Phase 7.
2. **Concierge IA** (público, sin login): chat con catálogo curado de Bogotá. Recomienda venues con tarjetas accionables (cómo llegar, llamar, reservar). Phase 8.


## Current Milestone: v1.5 — TBD (next session)

> **Pasarela de pago confirmed OUT OF SCOPE** for v1.5 and near-future versions (user decision 2026-05-23). Payment processing deferred indefinitely to a later version when explicitly prioritized. The product operates without online payment — reservations remain CONFIRMED in the system without payment-on-booking; settlement happens at check-in/check-out via offline methods or on-site.

Awaiting user decision. Recommended v1.5 scope (polish + defect cleanup):
- Routing double-prefix fix — NightAuditController + TRAExportController return /api/api/... (Phase 19 finding, HIGH defect)
- First Lighthouse + k6 baseline measurement (populate .planning/quality-baseline.md)
- 48 web lint errors cleanup (code quality phase)
- Adjacent token consolidation — GuestsPage.tsx + GuestDetailPage.tsx
- Calendar drag-to-RESIZE + cross-row moves (UX polish from v1.4 carry-forward)

## Validated (v1.4 shipped 2026-05-22)

- ✓ **Phase 17 CI/CD Gates** — .github/workflows/ci.yml with audit + typecheck + lint + tests on push and PR; CONTRIBUTING.md for branch protection (deployer, commit e81e54b)
- ✓ **Phase 18 Playwright E2E** — 5 spec files (responsive smoke + login + wizard + calendar DnD + error boundaries) × 2 projects = 50 tests; CI e2e job with Postgres service (zoe, commit c2ef86d)
- ✓ **Phase 19 Backend Coverage Gaps** — authz matrix 82 endpoints × 4 roles = 328 combos + API contract tests + throttle burst + refresh race regression; +408 tests (mia, commit f08e3d7)
- ✓ **Phase 20 Security Automation** — Dependabot + Semgrep + 8 AI prompt-injection fixtures + gitleaks; +21 always-on tests + 17 cost-gated (mia, commit 882bf67)
- ✓ **Phase 21 Performance Baseline** — k6 booking + k6 SSE + Lighthouse CI + separate perf.yml workflow + quality-baseline.md placeholder (deployer, commit 4bcd6a6)

## Original Milestone v1.4: Quality & Security Infrastructure

**Started:** 2026-05-22
**Goal:** Build the CI/CD + automated testing + security automation + performance baseline foundation so future product work cannot silently regress quality. Trigger: external QA audit identified gaps in test coverage, CI gates, and observability not closed by v1.3. No new product features — pure infrastructure.

**Target features:**
- GitHub Actions CI workflow that blocks merges on audit/typecheck/lint/test failures (Phase 17)
- Playwright E2E suite covering responsive smoke + critical flows + calendar DnD (Phase 18)
- Backend coverage gaps closed — authz matrix, API contract tests, throttling burst (Phase 19)
- Security automation — Dependabot, Semgrep, AI prompt-injection abuse tests, secrets sweep (Phase 20)
- Performance baseline — k6 load tests + Lighthouse CI with persisted baseline metrics (Phase 21)

**Key context:**
- Triggered by  external audit. Sections 10/11/12 P2 were never closed in v1.3.
- Pure infra — backend domain code and frontend UI surface are not touched.
- Phases continue numbering from Phase 16 → starts at Phase 17.
- Carry-forward from previous sweeps ( + ) is absorbed into this milestone where relevant (lint cleanup, Playwright DnD verification, CI gates).

## Validated (v1.3 shipped)

- ✓ **Phase 15 Extended Contact Capture** — Guest schema extended (preferredLanguage, contactPreference, whatsappNumber, marketingConsent, dietaryRestrictions, specialRequests) + BookingFormPage 2 collapsibles + Ley 1581 opt-in + email confirmation preferences (2026-05-19)
- ✓ **Phase 16 Guest Detail + Deep Links + Contact Events** — /guests/:id route + ContactButtons + tel/wa.me/mailto deep links + guest_contact_events table + Socket.io real-time push + sonner toasts (2026-05-19)
- ✓ **QA + Security Sweep 2026-05-22** — 8 findings resolved (SEC-001..004, BE-001, FE-001, FE-002, SEC-005). 15 CVEs remediated via pnpm.overrides. TS5095 fixed. ESLint downgraded for plugin compat. MSW added to tests.
- ✓ **UX + Functional Gaps Sweep 2026-05-22** — 3 real OBS fixed (dark mode CSS, token consolidation, calendar drag-to-move MVP) + 5 false positives documented + 6 carry-forward items

## Validated (v1.2 shipped)

- ✓ **Phase 12 Public Data API + Wiring** — 3 public GET endpoints + TanStack Query hooks + skeleton states + LegacyBookingPage deleted (2026-05-18)
- ✓ **Phase 13 Hotel Settings Admin** — PATCH /api/system-config + HotelPhotosModule (R2 CRUD) + /settings/hotel admin UI + audit log (2026-05-18)
- ✓ **Phase 14 Public Reviews System** — reviews table + JWT single-use tokens + night-audit email pipeline + /review/submit public form + staff moderation queue + portal ReviewsSection live data (2026-05-18)

## Validated (v1.1 shipped)

- ✓ **Phase 09 Design System Foundation** — Tailwind v4 tokens + Instrument Serif/Geist + dark mode + status colors + shadcn primitives refactor (2026-05-17)
- ✓ **Phase 10 Public Portal** — HotelHomePage Airbnb-style + hero gallery + 6 sections + reservation widget + concierge restyle + smoke tests (2026-05-17)
- ✓ **Phase 11 Internal Screens Restyle** — Login split-panel + Dashboard Recharts + Calendar bars + Rooms grid + Wizard stepper + Housekeeping kanban + ChatPanel staff + Sidebar collapse + ThemeToggle (2026-05-17)

## Validated (v1.0 shipped)

- ✓ **Phase 01 Foundation** — NestJS + Prisma + React + JWT + RBAC + base modules
- ✓ **Phase 02 Inventory + Pricing** — Room Types + Rooms (dual-status) + R2 photos + Rate Plans + Seasons
- ✓ **Phase 03 Guests + Reservations + Booking** — Guests AES-256-GCM + btree_gist anti-overbooking + Staff wizard 4-step + Public booking + Resend
- ✓ **Phase 04 Operations** — Check-in/out atómico + Folio + Night audit cron + IVA 19% + PDF "Estado de Cuenta" + TRA Colombia
- ✓ **Phase 05 Housekeeping** — State machine + Kanban Socket.io real-time + Domain event checkout→DIRTY
- ✓ **Phase 06 Reporting** — KPIs (Occupancy/ADR/RevPAR) + Recharts + CSV/PDF reports
- ✓ **Phase 07 Staff AI Assistant** — OpenAI gpt-4o-mini + 7 read-only tools + SSE streaming + audit + ChatPanel
- ✓ **Phase 08 Concierge IA Public** — Public chatbot Bogotá + 4 tools + token budget circuit breaker + IP rate limit + VenueCard

## Core Value

> **Un staff de hotel debe poder gestionar reservas, check-in/out, habitaciones y operación diaria desde una sola interfaz web, complementado por dos asistentes IA — uno interno que responde sobre el PMS y otro público que ayuda a huéspedes a descubrir Bogotá.**

Si el core hotelero (Phases 1-6) no funciona, no hay producto. Los asistentes IA (Phases 7-8) son **diferenciadores que se construyen al final**, no fundamentos. La identidad visual (Phases 9-11 / v1.1) hace que el producto se vea como una marca, no como una demo.

## Context

- **Origen**: Proyecto nuevo (greenfield). Diseño visual capturado de Claude Design — ver `design/DESIGN-SYSTEM.md` (paleta cream/terracota, tipografía serif italic + system-ui). Bundle completo de pantallas fetched para v1.1.
- **Etapa**: v1.0 MVP shipped (26/26 plans across 8 phases) → arrancando v1.1 visual identity.
- **Equipo**: Solo el usuario (confirmado).
- **País de operación**: **Colombia** (confirmado) — implica TRA + IVA 19% + Ley 1581 (habeas data) + COP.
- **Despliegue**: Railway (back + DB + front estático). Repo: https://github.com/softwarevalle75-wq/hotel-os-ai (privado).
- **Pagos**: **No** se procesan en v1. El modelo de datos los soporta (campo `paid_status` en reservas) pero no hay integración con pasarela. Pagos reales → v2.

## Stack (Key Decisions)

| Capa | Tecnología | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS v4 | Stack moderno del usuario. Vite por velocidad. Tailwind se configura con los tokens de `design/DESIGN-SYSTEM.md` + bundle de v1.1. |
| UI Components | shadcn/ui + Radix UI | Copy-paste, preserva identidad cream/terracota del diseño. |
| Backend | NestJS (Node + TypeScript) | Mismo lenguaje que front. Arquitectura hexagonal nativa, DI, módulos. |
| ORM | Prisma 7.x | Type-safe, migraciones limpias, raw SQL disponible para `btree_gist`. |
| DB | PostgreSQL 16 | `btree_gist` exclusion constraint para overbooking. Railway add-on. |
| Auth | JWT + refresh tokens | Sin sesiones server-side. Multi-dispositivo. Revocación inmediata por desactivación. |
| Realtime | Socket.io | Calendario, housekeeping kanban en vivo. |
| AI Streaming | NestJS `@Sse()` + OpenAI SDK AsyncIterable → RxJS Observable | Token-by-token streaming sin WebSocket. |
| IA | OpenAI SDK — `gpt-4o-mini` | Cost-efficient (~$0.15/$0.60 per MTok). Revisado 2026-05-15 (de Anthropic a OpenAI). Mismo SDK ambos asistentes. |
| File Storage | Cloudflare R2 + `@aws-sdk/client-s3@3.726.1` (pin obligatorio) | Fotos de habitaciones. Zero egress fees. |
| PDF | `@react-pdf/renderer` v4.5.x | Folio en checkout, reportes. Server-side, sin Chromium. |
| Email | Resend | Confirmaciones de booking público. |
| Calendar staff | CSS Grid `RoomRackTable.tsx` (fallback de @schedule-x paywalled) | Room rack horizontal (rooms en Y, días en X). |
| Calendar public | `react-day-picker` v10 (mode="range") | Date range picker para booking engine. |
| Charts | Recharts (vía shadcn chart wrappers) | Occupancy bars, status donut. |
| Fonts | Instrument Serif + Geist + Geist Mono (Google Fonts) | v1.1 — display warm/Airbnb + body sans + numerics monospace. |
| Deploy | Railway | Confirmado por usuario. `connection_limit=5` + `DIRECT_DATABASE_URL` para Prisma migrations. Repo privado en GitHub. |

## Architecture Style

**Clean / Hexagonal Architecture** con bounded contexts:

- `shared-kernel` — Money, DateRange, branded IDs, domain event base class (sin DB, sin NestJS)
- `auth` — Autenticación, JWT, RBAC (raíz del grafo de dependencias)
- `inventory` — Habitaciones, tipos, dos state machines (`physicalStatus` + `cleaningStatus`)
- `pricing` — Tarifas, temporadas, reglas (devuelve breakdown itemizado)
- `guests` — Huéspedes (datos básicos cifrados, no CRM)
- `reservations` — Reservas, AvailabilityService único, overbooking imposible vía `btree_gist`
- `operations` — Check-in/out, folio append-only, night audit cron, charges-to-room, TRA Colombia
- `housekeeping` — Estado de limpieza, asignaciones, Socket.io gateway
- `reporting` — Dashboard y reportes (lee `daily_snapshot`, nunca raw reservations)
- `channels` — Modelo de datos preparado (campo `source` en reservas), integraciones reales en v2
- `ai-assistant` — Asistente staff (Phase 7): chat con tools read-only al PMS, OpenAI gpt-4o-mini
- `concierge` — Concierge IA público (Phase 8): chat con catálogo curado de Bogotá, OpenAI gpt-4o-mini
- **`design-system`** — Tokens de diseño codificados como Tailwind config + CSS variables (v1.1)

## Out of Scope (v1)

- **Pagos reales** — Diferido a v2. v1 deja modelo preparado pero sin pasarela.
- **CRM / Fidelización** — Diferido a v2.
- **Channel Manager (integraciones reales)** — Booking.com / Expedia / Airbnb requieren cuentas business, certificación API y desarrollo dedicado. v1 solo prepara modelo (campo `source` en reservas).
- **POS de restaurante** — v1 solo permite "cargar consumo a habitación". POS completo es otro producto.
- **Multi-tenant / multi-hotel** — Decisión explícita: single-tenant.
- **App móvil nativa** — Solo web responsive en v1.
- **Concierge IA con APIs externas (Foursquare, Google Places)** — v1 usa catálogo curado en DB. Integraciones live → v2.
- **Multi-idioma (i18n ES/EN)** — Diferido a v1.2. v1.1 solo español.

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Single-tenant (no multi-hotel) | Reduce 40% de complejidad. El cliente es un hotel específico. | ✓ Good (v1.0 shipped) |
| NestJS para backend | Mismo lenguaje que front, arquitectura hexagonal nativa. | ✓ Good (v1.0 shipped) |
| Prisma como ORM con raw SQL para `btree_gist` | Prisma DSL no soporta exclusion constraints; raw migration es la única vía. | ✓ Good (constraint funciona) |
| Channel Manager reducido a modelo de datos | Integraciones reales con OTAs son módulo aparte con onboarding/certificación. | ✓ Good (v1.0) |
| Restaurante reducido a "consumos a habitación" | POS completo es otro producto. | ✓ Good (v1.0) |
| Pagos fuera de v1 | Requieren pasarela, compliance PCI, fricción innecesaria para MVP. | ✓ Good |
| Deploy en Railway | Decisión del usuario. | ✓ Good (DB + migraciones operando) |
| **Dos asistentes IA en v1, no uno** | El diseño muestra Concierge IA público + Asistente staff interno. Decisión del usuario: ambos en v1. | ✓ Good (Phases 7+8) |
| **País: Colombia, IVA 19%, TRA obligatorio** | Confirmado por usuario. Implica compliance Ley 1581 + retención fiscal 5 años. | ✓ Good (Phase 4 entregó IVA + TRA) |
| **Diseño visual de Claude Design es la fuente de verdad** | Tokens en `design/DESIGN-SYSTEM.md` + bundle completo en `.design-fetch/`. Codificado en v1.1 Phase 9. | — Pending (v1.1 in progress) |
| Catálogo de Bogotá curado en DB (no live API) en v1 | Reduce dependencias externas; rápido de implementar; v2 integra Foursquare/Google Places. | ✓ Good (schema + admin CRUD shipped) |
| **AI SDK: OpenAI gpt-4o-mini, revisado de Anthropic Claude** | Cost optimization (~$0.15/$0.60 per MTok vs Sonnet $3/$15). Mismo SDK ambos asistentes. Revisado 2026-05-15. | ✓ Good (Phases 7+8 funcionando) |
| **Visual identity como milestone separado v1.1** | El MVP v1.0 entregó funcionalidad end-to-end; v1.1 cierra el gap entre diseño y código sin tocar backend. | — Pending (v1.1 in progress) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-17 after starting milestone v1.1 (Visual Identity Implementation)*
