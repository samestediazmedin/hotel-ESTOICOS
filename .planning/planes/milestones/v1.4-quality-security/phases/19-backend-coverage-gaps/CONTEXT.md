# Phase 19 — Backend Coverage Gaps

**Milestone:** v1.4 Quality & Security Infrastructure
**Phase position:** 3 of 5
**Trigger:** External QA audit Section 10 — "Casos de prueba sugeridos: Matriz authz por rol, Contratos API status codes, Manejo uniforme excepciones, Throttling burst"
**Goal:** Close test coverage gaps in backend that allow silent regressions.

---

## Requirements

- [ ] **QSI-12**: Authz matrix test — table-driven enumerating every staff endpoint × every role (ADMIN, MANAGER, RECEPTION, HOUSEKEEPING) asserting 200/403. Single source: `apps/api/src/shared/guards/__tests__/authz-matrix.spec.ts`.
- [ ] **QSI-13**: API contract test — for every controller endpoint, validate consistent error shape `{ message, statusCode, error }` on 400/401/403/404/409/422. Catches Prisma errors leaking as 500.
- [ ] **QSI-14**: Throttling burst test — fire N+1 requests at rate-limited endpoints (booking, reviews, concierge), assert N×200 + 1×429.
- [ ] **QSI-15**: Concurrent token refresh race test — regression for 2026-05-22 bugfix. Fire 5 concurrent `/auth/refresh` calls with same cookie, assert 1×200 + 4×401, NEVER 500.

---

## Approach

**QSI-12 (Authz matrix)**:
- Enumerate every staff endpoint by reading controllers in `apps/api/src/modules/`.
- Build a table: `[endpoint, method, allowedRoles]`.
- Test setup: create a mock user per role, generate JWT, hit each endpoint, assert status.
- Output: a single spec file with one test per (endpoint × role) combo. Likely 200+ test cases — that's the point.

**QSI-13 (API contract)**:
- For each controller, invoke its endpoints with invalid input (empty body, wrong types, missing fields).
- Assert response shape: must have `message`, `statusCode`, `error` keys.
- Assert NO 500 leaks (Prisma errors should be caught and converted to 400/404/409).
- Use Supertest + the existing NestJS testing module.

**QSI-14 (Throttling burst)**:
- Identify rate-limited endpoints. Likely: `/api/public/bookings` (CSRF + throttle), `/api/public/reviews` (5/IP/hour), `/api/concierge/chat` (20/IP/hour).
- Send N requests in a tight loop, assert response codes.
- Mock `Date.now()` or use the throttler's reset method if available.

**QSI-15 (Refresh race)**:
- Already have the fix (commit `6e6fdbc` — `deleteMany` returns count).
- Just add a regression test asserting `Promise.all([5 concurrent refresh calls])` produces exactly 1 successful + 4 unauthorized, never any 5xx.
- Use existing `TokenService` spec or extend `auth.controller.spec.ts`.

---

## Out of scope

- ❌ Frontend tests (web is Phase 18)
- ❌ CI workflow modifications (already done in Phase 17)
- ❌ Authz matrix on PUBLIC endpoints (only staff endpoints with `@Roles()` decorator)
- ❌ Performance / load tests (Phase 21)

---

## Constraints

- Existing test infra: vitest@4.1.6 + @nestjs/testing + Supertest.
- Tests must coexist with the 440 existing tests — no regressions.
- New test files in `apps/api/src/**/__tests__/` (or alongside as `.spec.ts`).
- No flaky tests — if rate-limit timing is tricky, use fake timers via `vi.useFakeTimers()`.
- No `Co-Authored-By`. Conventional commit: `test(api): add authz matrix + API contract + throttle burst + refresh race coverage (QSI-12..15)`.

---

## Verification

- `pnpm --filter @hotel/api test -- --run` → 440 + new tests, all passing
- `pnpm --filter @hotel/api tsc --noEmit` → 0 errors
- Authz matrix coverage explicit — single file lists all (endpoint × role) combos
- Refresh race test produces 1×200 + 4×401 deterministically (use Promise.allSettled, not Promise.all)
