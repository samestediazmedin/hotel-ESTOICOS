# Technology Stack

**Project:** HotelOS AI — Single-tenant Hotel PMS + Booking Engine + AI Assistant
**Researched:** 2026-05-13
**Research mode:** Ecosystem (confirming existing choices + filling gaps)

---

## Confirmed Decisions (team already locked these in)

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS | Confirmed |
| Backend | NestJS 11.x (Node.js) | Confirmed |
| ORM | Prisma 7.x | Confirmed |
| Database | PostgreSQL 16 | Confirmed |
| Auth | JWT + refresh tokens (NestJS Passport + @nestjs/jwt) | Confirmed |
| Realtime | Socket.io 4.x (@nestjs/platform-socket.io) | Confirmed |
| AI | Anthropic SDK (Claude) | Confirmed |
| Deploy | Railway | Confirmed |

---

## Recommended Stack (complete — all gaps filled)

### Core Backend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@nestjs/core` | 11.1.x | NestJS application kernel | Current stable. v12 (ESM migration) is Q3 2026 — start on v11 to avoid instability. |
| `@nestjs/platform-express` | 11.1.x | HTTP adapter (Express under NestJS) | Default, battle-tested. Fastify offers marginal gains not worth the trade-off for a single-tenant PMS. |
| `@nestjs/platform-socket.io` | 11.1.x | WebSocket gateway | Native NestJS integration for Socket.io. |
| `@nestjs/jwt` | 11.x | JWT signing / verification | Official NestJS package, pairs with Passport. |
| `@nestjs/passport` | 11.x | Auth strategy scaffolding | Standard NestJS auth pattern. |
| `passport-jwt` | 4.x | JWT strategy for Passport | Industry default. |
| `@nestjs/config` | 4.x | Env var management | NestJS-native, supports Joi validation of env vars. |
| `@nestjs/swagger` | 11.4.x | OpenAPI documentation | Generates API docs from decorators. Critical for team DX and frontend contract alignment. |
| `@nestjs/schedule` | latest | Cron jobs | For nightly reports, reservation reminders. No Redis needed for simple schedules. |
| `prisma` | 7.x | ORM CLI + migrations | v7 is stable current. Rust-free WASM engine now production-ready on PostgreSQL. |
| `@prisma/client` | 7.x | Type-safe DB client | Generated from schema — the main runtime dependency. |
| `zod` | 4.4.x | Schema validation (shared, backend + frontend) | v4 is now stable and current. Use for request body validation in NestJS pipes and for shared types with frontend. Replaces `class-validator` for pure validation. |
| `bcrypt` / `@types/bcrypt` | 5.x | Password hashing | Standard. Use bcrypt, not bcryptjs — Node.js native bindings are faster. |

### Core Frontend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react` | 18.x | UI library | Confirmed. Do NOT upgrade to React 19 yet — ecosystem stability for 18 is higher. |
| `react-dom` | 18.x | DOM renderer | Paired with React 18. |
| `vite` | 6.x | Build tool | Current major. Vite 6 supports React 18 and TypeScript natively. |
| `@vitejs/plugin-react` | 4.x | React plugin for Vite | SWC-based — faster than Babel. Use `plugin-react-swc` variant. |
| `tailwindcss` | 4.x | Utility CSS | Tailwind v4 is current. Note: config format changed from `tailwind.config.js` to CSS-native — use v4 from day one. |
| `typescript` | 5.7.x | Type safety | Current stable for 2026. |

### UI Component Library

**Recommendation: shadcn/ui (with Radix UI primitives)**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `shadcn/ui` | CLI-based (no package version) | Component system | Copy-paste approach — components live in your codebase, not a node_modules black box. Built on Radix UI. Tailwind-native. Perfect for a custom hotel UI. |
| `@radix-ui/*` | latest (managed by shadcn CLI) | Headless primitives | Accessibility-correct primitives for modals, dropdowns, tooltips, selects. |
| `class-variance-authority` | 0.7.x | Variant management for components | Standard shadcn/ui peer dep. |
| `clsx` + `tailwind-merge` | latest | Conditional className merging | Standard shadcn/ui utilities. |
| `lucide-react` | 0.x latest | Icon library | Default shadcn/ui icon set. Consistent, tree-shakeable. |

**Why not MUI or Ant Design:** They impose their own design system. For a hotel PMS with a custom visual identity, shadcn/ui gives full control while still providing production-ready accessible components.

### Calendar / Date Selection (CRITICAL for hotel UX)

**Recommendation: Two separate components for two separate jobs.**

#### Occupancy Calendar (room grid view — the PMS calendar)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@schedule-x/react` | latest | Visual room-by-room timeline calendar | Modern framework-aware alternative to react-big-calendar. Native React component injection, responsive design, better DX in 2025+. Use for the horizontal timeline view (rooms on Y-axis, dates on X-axis — classic PMS layout). |

**Why not react-big-calendar:** Mature but older API. The "resource view" (multi-room timeline) requires workarounds. Schedule-X handles this more cleanly.
**Why not FullCalendar:** Commercial license for advanced views. Schedule-X is fully open-source.

#### Booking Date Range Picker (public booking engine + search filters)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-day-picker` | 10.x | Date range selection | v10 is the current stable (just released). Powers shadcn/ui's own Calendar component. Use directly for the booking engine's check-in/check-out range picker. Built-in `mode="range"` is exactly what hotel booking needs. |

**Why not a combined solution:** The occupancy grid (staff view) and the booking date picker (guest view) are fundamentally different UX patterns. Forcing one library to do both creates constraints.

### Form Management

**Recommendation: react-hook-form + zod**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-hook-form` | 7.75.x | Form state management | 7.75.x is current (May 2026). Uncontrolled components = minimal re-renders. Critical for forms with many fields (room CRUD, guest registration). |
| `@hookform/resolvers` | 3.x | Bridges RHF with zod | Use `zodResolver` — single validation schema shared between backend (Zod pipes) and frontend. |
| `zod` | 4.4.x | Schema validation | Already listed in backend. Import the same schema package on both ends for contract parity. |

**Why not Formik:** react-hook-form is consistently faster (fewer re-renders) and has overtaken Formik as the 2025 standard by npm download metrics.

### State Management

**Recommendation: Zustand (global) + TanStack Query (server state)**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `zustand` | 5.0.x | Global UI state | v5 is current (May 2026). Use for: current logged-in user, UI preferences (sidebar open/collapsed), active filters, selected room. Do NOT use for server data — that belongs in TanStack Query. |
| `@tanstack/react-query` | 5.100.x | Server/async state | v5 is current. Handles fetching, caching, background refetch, optimistic updates. Essential for the real-time-adjacent PMS data (reservations list, room status). |
| `@tanstack/react-query-devtools` | 5.x | Dev tools | Include in development only. |

**Why not Redux Toolkit:** Massive overkill for a single-tenant app. Zustand + TanStack Query covers 95% of state needs with 1/10th the boilerplate.
**Why not React Context for everything:** Context re-renders all consumers on any state change. Fine for auth context; terrible for frequently-updated PMS data.

### Charts / Data Visualization

**Recommendation: Recharts**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `recharts` | 2.x (v3 if stable) | Occupancy charts, revenue charts, dashboard KPIs | 2.4M weekly downloads, declarative React API, SVG-based. The hotel dashboard (occupancy %, ADR, RevPAR trends) maps perfectly to its LineChart, BarChart, and PieChart components. shadcn/ui's chart components are built on Recharts — use them to stay consistent with the design system. |

**Why not Tremor:** Tremor is built on Recharts anyway. If using shadcn/ui, use shadcn/ui's chart wrappers (which wrap Recharts) for visual consistency. Tremor introduces a second component system.
**Why not Chart.js:** Imperative API (not declarative React). Harder to control with React state.

### AI Assistant (Streaming)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@anthropic-ai/sdk` | latest (0.x / 1.x) | Claude API client | Official SDK. Team decision. |
| NestJS SSE (`@Sse()` decorator) | built-in | Stream Claude tokens to frontend | NestJS has native SSE support via `EventSource` response. Use `stream: true` on the Anthropic SDK call, pipe the `AsyncIterable` through an RxJS `Observable`, and return it from a `@Sse()` endpoint. No extra package needed. |
| `eventsource-parser` | 2.x | Parse raw SSE stream (if needed) | Only needed if bypassing the SDK's built-in streaming. Prefer SDK's `.stream()` method. |

**Pattern:** Backend receives chat message via REST POST → creates Anthropic stream → returns SSE stream → frontend `EventSource` consumes tokens progressively. Do NOT use WebSocket for AI streaming — SSE is simpler and sufficient for unidirectional token streaming.

**CRITICAL:** AI assistant reads PMS data via Prisma queries inside NestJS services — it does NOT get direct DB access. The `ai-assistant` module calls read-only methods on `ReservationService`, `RoomService`, etc. This maintains hexagonal boundaries.

### File Storage (Room Photos)

**Recommendation: Cloudflare R2**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@aws-sdk/client-s3` | 3.726.x | S3-compatible client for R2 | Cloudflare R2 is fully S3-compatible. Pin to 3.726.1 — v3.729.0 introduced a checksum behavior incompatible with R2. |
| `@aws-sdk/s3-request-presigner` | same | Presigned URLs for direct upload | Generate presigned upload URLs on the backend; frontend uploads directly to R2. Never proxy file bytes through NestJS. |

**Why R2 over AWS S3:** Zero egress fees. A hotel's room photos will be served frequently. On S3, egress at scale is expensive. R2 is 20-40% faster than S3 for reads. S3-compatible API means the same client code works.
**Why not Railway Volumes:** Railway persistent volumes are not a CDN — they're block storage. Serving media through them means serving through your NestJS process, which wastes compute and bandwidth.
**Why not uploadthing:** Adds a third-party abstraction on top of S3. Unnecessary complexity when `@aws-sdk/client-s3` + R2 is direct and well-documented.

### PDF Generation (Reports)

**Recommendation: @react-pdf/renderer (server-side)**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@react-pdf/renderer` | 4.5.x | Generate PDF reports (occupancy, revenue, guest history) | v4.5.1 is current (April 2026). Runs in Node.js (not just browser). Use React-component approach on the NestJS backend — `ReactPDF.renderToStream()` or `renderToBuffer()`. Generates well-structured, styled PDFs declaratively. |

**Why not Puppeteer:** Puppeteer launches a headless Chromium instance. On Railway's container environment, this requires additional system dependencies and ~400MB extra image size. Overkill for structured reports.
**Why not pdfmake:** JSON-based syntax is less maintainable than JSX for complex layouts. Worse performance for large files.
**Why not wkhtmltopdf:** Deprecated, unmaintained, complex Railway deployment.

**Usage pattern:** NestJS `@Get('reports/:type/pdf')` endpoint calls a service that renders a React component tree to PDF via `@react-pdf/renderer` and returns `application/pdf` response.

### Email (Transactional)

**Recommendation: Resend + @nestjs-modules/mailer as optional fallback**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `resend` | 4.x | Booking confirmations, check-in notifications | API-first, no SMTP to manage. Free tier: 3,000 emails/month. For a single hotel, this covers all transactional email indefinitely. Setup takes 5 minutes. Excellent TypeScript SDK. |

**Why not Nodemailer:** Requires SMTP server configuration. For a single-tenant hotel, managing SMTP reliability (SPF, DKIM, DMARC) is unnecessary ops overhead. Resend handles deliverability.
**Why not @nestjs-modules/mailer:** It wraps Nodemailer. The wrapper adds value when you need Handlebars templates with SMTP. Resend's SDK is cleaner for API-based sending.

**v1 scope:** Only two email types needed — booking confirmation and (optionally) check-out summary. Do NOT over-engineer email templates in v1.

### Error Tracking / Observability

**Recommendation: Sentry**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@sentry/nestjs` | 8.x | Backend error tracking + performance | Official NestJS SDK. Captures unhandled exceptions with full request context, stack traces, breadcrumbs. |
| `@sentry/react` | 8.x | Frontend error tracking + performance | Captures JS errors with component stack traces. |

**Why Sentry over alternatives (Datadog, Logtail):** Generous free tier (5,000 errors/month). NestJS has official first-class integration. Railway + Sentry is the standard 2025 indie/small-team stack. Zero infra to manage.

**Note:** Add `instrument.ts` as the FIRST import in `main.ts` before any NestJS module imports — this is required for Sentry's automatic instrumentation to work correctly.

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `vitest` | 4.1.x | Unit + integration tests (frontend + backend) | v4.1.6 is current (May 2026). Vite-native, 4x faster than Jest, zero config for TypeScript. Use for both NestJS service tests (via `vitest` with `@nestjs/testing`) and React component tests. |
| `@testing-library/react` | 16.x | Component testing utilities | Standard React testing. Query DOM by role/label (not implementation details). |
| `@testing-library/user-event` | 14.x | Simulated user interactions | `userEvent` > `fireEvent` — closer to real browser behavior. |
| `@testing-library/jest-dom` | 6.x | DOM assertion matchers | `toBeInTheDocument()`, `toHaveValue()`, etc. Works with Vitest via `@testing-library/jest-dom/vitest`. |
| `jsdom` | 26.x | Browser environment for Vitest | Required for React component tests in Node. |
| `@playwright/test` | 1.57.x | E2E tests | Current stable. Test critical flows: booking creation, check-in, calendar availability. Only for happy paths in v1 — do not over-invest in E2E coverage at MVP stage. |
| `@nestjs/testing` | 11.x | NestJS test module factory | Use `Test.createTestingModule()` for unit testing controllers and services with DI. |
| `supertest` | 7.x | HTTP request assertions for NestJS e2e | Test full request/response cycles in NestJS without starting a server. |

**Testing strategy:** Unit tests for domain logic (pricing rules, availability calculation, overbooking prevention). Integration tests for Prisma repositories. E2E (Playwright) only for the booking flow and check-in/out.

### NestJS Architecture Patterns (Hexagonal)

| Pattern | Implementation | Why |
|---------|---------------|-----|
| Repository abstraction | Interface + Prisma implementation class per bounded context | Prisma client stays in `infrastructure/` layer. Domain services depend on the interface, not Prisma directly. |
| Module per bounded context | `ReservationsModule`, `InventoryModule`, `GuestsModule`, etc. | Each module encapsulates domain, application, and infrastructure layers. No cross-module Prisma imports. |
| DTO validation | `class-transformer` + Zod pipes (or `nestjs-zod`) | Use Zod schemas as the single source of truth for DTO shape. |
| Guards for RBAC | `@nestjs/passport` + custom `RolesGuard` | Decorate controllers with `@Roles('admin', 'reception')`. |
| Config validation | `@nestjs/config` with Zod schema for env vars | Fail-fast on startup if required env vars are missing. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| UI Components | shadcn/ui | MUI, Ant Design | Impose design systems incompatible with custom hotel branding |
| State (global) | Zustand 5 | Redux Toolkit | Massive boilerplate overhead for a single-tenant app |
| State (server) | TanStack Query 5 | SWR | TanStack Query has richer cache control, mutations, and devtools |
| Forms | react-hook-form | Formik | RHF is consistently faster (uncontrolled model) and has overtaken Formik |
| Charts | Recharts | Tremor, Nivo | Tremor wraps Recharts; shadcn/ui's charts already wrap Recharts — no need for another layer |
| PDF | @react-pdf/renderer | Puppeteer | Puppeteer requires headless Chrome — too heavy for Railway containers |
| Email | Resend | Nodemailer | SMTP management overhead not justified for single hotel |
| File storage | Cloudflare R2 | AWS S3, Railway Volumes | R2 has zero egress fees; Railway Volumes are not CDN-capable |
| ORM | Prisma 7 | Drizzle, TypeORM | TypeORM has known issues with complex relations; Drizzle is promising but less mature ecosystem; Prisma's type safety is unmatched |
| Calendar (grid) | @schedule-x | react-big-calendar | react-big-calendar's resource/timeline view requires more workarounds; schedule-x has cleaner React integration |
| Testing (unit) | Vitest | Jest | Vitest is 4x faster, zero config for Vite projects, and Jest-compatible API |

---

## Installation Reference

```bash
# Backend — NestJS
npm install @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/jwt @nestjs/passport @nestjs/config @nestjs/swagger @nestjs/schedule @nestjs/platform-socket.io
npm install passport passport-jwt
npm install prisma @prisma/client
npm install zod bcrypt
npm install @anthropic-ai/sdk
npm install @aws-sdk/client-s3@3.726.1 @aws-sdk/s3-request-presigner@3.726.1
npm install @react-pdf/renderer resend
npm install @sentry/nestjs

# Backend dev dependencies
npm install -D @nestjs/testing supertest vitest @types/bcrypt @types/supertest

# Frontend — React
npm install react react-dom
npm install @tanstack/react-query zustand
npm install react-hook-form @hookform/resolvers zod
npm install @schedule-x/react react-day-picker
npm install recharts
npm install lucide-react clsx tailwind-merge class-variance-authority
npm install @sentry/react
npm install eventsource-parser  # only if manual SSE parsing needed

# Frontend dev dependencies
npm install -D vite @vitejs/plugin-react-swc typescript tailwindcss
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
npm install -D @playwright/test
npm install -D @tanstack/react-query-devtools

# shadcn/ui — install via CLI, not npm
npx shadcn@latest init
```

---

## Key Version Pins

| Package | Version | Reason for Pinning |
|---------|---------|-------------------|
| `@aws-sdk/client-s3` | `3.726.1` | v3.729.0+ has checksum bug incompatible with Cloudflare R2 |
| `react` | `18.x` (not 19) | React 19 ecosystem stability not yet at the level needed for production |
| `@nestjs/*` | `11.x` (not 12) | v12 (full ESM migration) is Q3 2026 — start on stable v11 |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| NestJS version | HIGH | Verified: v11.1.19 current, v12 Q3 2026 |
| Prisma version | HIGH | Verified: v7.x current (v7.3+ as of Jan 2026), Rust-free WASM engine production-ready |
| react-hook-form | HIGH | Verified: v7.75.x current (May 2026) |
| Zustand | HIGH | Verified: v5.0.13 current |
| TanStack Query | HIGH | Verified: v5.100.10 current |
| Vitest | HIGH | Verified: v4.1.6 current |
| Zod | HIGH | Verified: v4.4.3 current |
| @nestjs/swagger | HIGH | Verified: v11.4.2 current |
| react-day-picker | HIGH | Verified: v10.x just released; use v10 |
| @react-pdf/renderer | HIGH | Verified: v4.5.1 current (April 2026) |
| @schedule-x | MEDIUM | Current as of search; verify exact version on install |
| Cloudflare R2 + aws-sdk pin | HIGH | Verified via official Cloudflare R2 docs — pin 3.726.1 |
| Resend | MEDIUM | Current as of 2025 searches; free tier limits to verify before committing |
| Playwright | HIGH | Verified: v1.57.x current |
| Recharts | MEDIUM | v2.x stable; v3 in progress — start with v2 |

---

## Sources

- NestJS releases: https://github.com/nestjs/nest/releases
- Prisma changelog: https://www.prisma.io/changelog
- react-hook-form npm: https://www.npmjs.com/package/react-hook-form
- Zustand npm: https://www.npmjs.com/package/zustand
- TanStack Query npm: https://www.npmjs.com/package/@tanstack/react-query
- Vitest: https://vitest.dev/
- Zod v4: https://zod.dev/v4
- @nestjs/swagger npm: https://www.npmjs.com/package/@nestjs/swagger
- react-day-picker v10: https://daypicker.dev/changelog
- @react-pdf/renderer npm: https://www.npmjs.com/package/@react-pdf/renderer
- Cloudflare R2 + aws-sdk-js-v3: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
- Playwright releases: https://github.com/microsoft/playwright/releases
- Sentry for NestJS: https://docs.sentry.io/platforms/javascript/guides/nestjs/
- shadcn/ui date picker: https://ui.shadcn.com/docs/components/radix/date-picker
- Schedule-X: https://github.com/schedule-x/schedule-x
- Anthropic streaming: https://platform.claude.com/docs/en/build-with-claude/streaming
