<!-- GSD:project-start source:PROJECT.md -->
## Project

**HotelOS AI**

HotelOS AI es un **sistema operativo hotelero single-tenant** para un hotel específico (no SaaS multi-hotel). Cubre las dos audiencias clásicas:

- **Staff del hotel** (PMS — Property Management System): recepción, housekeeping, reservas internas, reportes y administración.
- **Huéspedes** (Booking Engine público): búsqueda de disponibilidad y reserva online.

El diferenciador es un **asistente conversacional con IA** (Kimi/Moonshot AI API — modelo `kimi-latest`) accesible para el staff con acceso a datos del PMS — consulta de disponibilidad, generación de reportes en lenguaje natural, asistencia operativa.

**Core Value:** > **Un staff de hotel debe poder gestionar reservas, check-in/out, habitaciones y operación diaria desde una sola interfaz web, complementado por un asistente IA que responde preguntas del PMS y ayuda a tareas operativas.**

Si ese flujo no funciona, no hay producto.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Confirmed Decisions (team already locked these in)
| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS | Confirmed |
| Backend | NestJS 11.x (Node.js) | Confirmed |
| ORM | Prisma 7.x | Confirmed |
| Database | PostgreSQL 16 | Confirmed |
| Auth | JWT + refresh tokens (NestJS Passport + @nestjs/jwt) | Confirmed |
| Realtime | Socket.io 4.x (@nestjs/platform-socket.io) | Confirmed |
| AI | OpenAI SDK — `kimi-latest` (Kimi/Moonshot AI) | Confirmed (revised 2026-06-12 — switched from OpenAI to Kimi) |
| Deploy | Railway | Confirmed |
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
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `shadcn/ui` | CLI-based (no package version) | Component system | Copy-paste approach — components live in your codebase, not a node_modules black box. Built on Radix UI. Tailwind-native. Perfect for a custom hotel UI. |
| `@radix-ui/*` | latest (managed by shadcn CLI) | Headless primitives | Accessibility-correct primitives for modals, dropdowns, tooltips, selects. |
| `class-variance-authority` | 0.7.x | Variant management for components | Standard shadcn/ui peer dep. |
| `clsx` + `tailwind-merge` | latest | Conditional className merging | Standard shadcn/ui utilities. |
| `lucide-react` | 0.x latest | Icon library | Default shadcn/ui icon set. Consistent, tree-shakeable. |
### Calendar / Date Selection (CRITICAL for hotel UX)
#### Occupancy Calendar (room grid view — the PMS calendar)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@schedule-x/react` | latest | Visual room-by-room timeline calendar | Modern framework-aware alternative to react-big-calendar. Native React component injection, responsive design, better DX in 2025+. Use for the horizontal timeline view (rooms on Y-axis, dates on X-axis — classic PMS layout). |
#### Booking Date Range Picker (public booking engine + search filters)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-day-picker` | 10.x | Date range selection | v10 is the current stable (just released). Powers shadcn/ui's own Calendar component. Use directly for the booking engine's check-in/check-out range picker. Built-in `mode="range"` is exactly what hotel booking needs. |
### Form Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-hook-form` | 7.75.x | Form state management | 7.75.x is current (May 2026). Uncontrolled components = minimal re-renders. Critical for forms with many fields (room CRUD, guest registration). |
| `@hookform/resolvers` | 3.x | Bridges RHF with zod | Use `zodResolver` — single validation schema shared between backend (Zod pipes) and frontend. |
| `zod` | 4.4.x | Schema validation | Already listed in backend. Import the same schema package on both ends for contract parity. |
### State Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `zustand` | 5.0.x | Global UI state | v5 is current (May 2026). Use for: current logged-in user, UI preferences (sidebar open/collapsed), active filters, selected room. Do NOT use for server data — that belongs in TanStack Query. |
| `@tanstack/react-query` | 5.100.x | Server/async state | v5 is current. Handles fetching, caching, background refetch, optimistic updates. Essential for the real-time-adjacent PMS data (reservations list, room status). |
| `@tanstack/react-query-devtools` | 5.x | Dev tools | Include in development only. |
### Charts / Data Visualization
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `recharts` | 2.x (v3 if stable) | Occupancy charts, revenue charts, dashboard KPIs | 2.4M weekly downloads, declarative React API, SVG-based. The hotel dashboard (occupancy %, ADR, RevPAR trends) maps perfectly to its LineChart, BarChart, and PieChart components. shadcn/ui's chart components are built on Recharts — use them to stay consistent with the design system. |
### AI Assistant (Streaming)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `openai` | 4.x latest | OpenAI-compatible API client | Uses OpenAI SDK with Kimi (Moonshot AI) base URL. Team decision (revised 2026-06-12 — switched to Kimi). Model: `kimi-latest`. Supports streaming + function calling (tools) + structured outputs. |
| Model: `kimi-latest` | — | LLM | Chosen for the staff AI assistant. Kimi offers competitive pricing, strong Spanish support, and 128k+ context window. Native function-calling support. Uses OpenAI-compatible API via `https://api.moonshot.cn/v1`. |
| NestJS SSE (`@Sse()` decorator) | built-in | Stream tokens to frontend | NestJS has native SSE support via `EventSource`-compatible response. Pipe the OpenAI streaming response (`AsyncIterable<ChatCompletionChunk>`) through an RxJS `Observable` and return from a `@Sse()` endpoint. EventSource browser API does NOT support Authorization headers — use `fetch + ReadableStream` on the frontend with JWT in headers. |
| `eventsource-parser` | 2.x | Parse raw SSE stream on the client (if needed) | Only needed for the frontend if we hand-roll SSE parsing. The NestJS server-side flow uses the SDK's native AsyncIterable directly. |
### File Storage (Room Photos)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@aws-sdk/client-s3` | 3.726.x | S3-compatible client for R2 | Cloudflare R2 is fully S3-compatible. Pin to 3.726.1 — v3.729.0 introduced a checksum behavior incompatible with R2. |
| `@aws-sdk/s3-request-presigner` | same | Presigned URLs for direct upload | Generate presigned upload URLs on the backend; frontend uploads directly to R2. Never proxy file bytes through NestJS. |
### PDF Generation (Reports)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@react-pdf/renderer` | 4.5.x | Generate PDF reports (occupancy, revenue, guest history) | v4.5.1 is current (April 2026). Runs in Node.js (not just browser). Use React-component approach on the NestJS backend — `ReactPDF.renderToStream()` or `renderToBuffer()`. Generates well-structured, styled PDFs declaratively. |
### Email (Transactional)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `resend` | 4.x | Booking confirmations, check-in notifications | API-first, no SMTP to manage. Free tier: 3,000 emails/month. For a single hotel, this covers all transactional email indefinitely. Setup takes 5 minutes. Excellent TypeScript SDK. |
### Error Tracking / Observability
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@sentry/nestjs` | 8.x | Backend error tracking + performance | Official NestJS SDK. Captures unhandled exceptions with full request context, stack traces, breadcrumbs. |
| `@sentry/react` | 8.x | Frontend error tracking + performance | Captures JS errors with component stack traces. |
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
### NestJS Architecture Patterns (Hexagonal)
| Pattern | Implementation | Why |
|---------|---------------|-----|
| Repository abstraction | Interface + Prisma implementation class per bounded context | Prisma client stays in `infrastructure/` layer. Domain services depend on the interface, not Prisma directly. |
| Module per bounded context | `ReservationsModule`, `InventoryModule`, `GuestsModule`, etc. | Each module encapsulates domain, application, and infrastructure layers. No cross-module Prisma imports. |
| DTO validation | `class-transformer` + Zod pipes (or `nestjs-zod`) | Use Zod schemas as the single source of truth for DTO shape. |
| Guards for RBAC | `@nestjs/passport` + custom `RolesGuard` | Decorate controllers with `@Roles('admin', 'reception')`. |
| Config validation | `@nestjs/config` with Zod schema for env vars | Fail-fast on startup if required env vars are missing. |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| AI Assistant SDK | OpenAI SDK + Kimi (`kimi-latest`) | OpenAI (gpt-4o-mini), Anthropic (Claude) | Team decision revised 2026-06-12: Switched to Kimi (Moonshot AI) for stronger Spanish support, competitive pricing, and OpenAI-compatible API. Uses `https://api.moonshot.cn/v1` base URL. Previous OpenAI gpt-4o-mini config was working but Kimi offers better value for Spanish-language hotel operations. |
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
## Installation Reference
# Backend — NestJS
# Backend dev dependencies
# Frontend — React
# Frontend dev dependencies
# shadcn/ui — install via CLI, not npm
## Key Version Pins
| Package | Version | Reason for Pinning |
|---------|---------|-------------------|
| `@aws-sdk/client-s3` | `3.726.1` | v3.729.0+ has checksum bug incompatible with Cloudflare R2 |
| `react` | `18.x` (not 19) | React 19 ecosystem stability not yet at the level needed for production |
| `@nestjs/*` | `11.x` (not 12) | v12 (full ESM migration) is Q3 2026 — start on stable v11 |
| `openai` | `4.x latest` | OpenAI Node SDK v4 (current as of 2026-05). Model: `kimi-latest` via Kimi/Moonshot AI base URL. |
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
| OpenAI SDK (`openai`) | MEDIUM | v4.x current. Verify gpt-4o-mini availability + pricing on install. |
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
- OpenAI streaming + function calling: https://platform.openai.com/docs/api-reference/streaming
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
