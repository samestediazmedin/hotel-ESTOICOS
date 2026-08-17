# Phase 18 — Playwright E2E

**Milestone:** v1.4 Quality & Security Infrastructure
**Phase position:** 2 of 5
**Trigger:** External QA audit Section 10 — responsive smoke + critical flow coverage + error boundary
**Goal:** Critical user flows covered by real-browser E2E tests, runs in CI.

---

## Requirements

- [ ] **QSI-05**: Playwright installed in `apps/web` with `@playwright/test`. Config covers chromium + mobile viewport (`Pixel 5`).
- [ ] **QSI-06**: Smoke test: public portal renders at 360/768/1024/1440 — no horizontal scroll, hero gallery visible, reservation widget reachable.
- [ ] **QSI-07**: Critical flow: login → dashboard → logout (with token-expiry simulation in middleware).
- [ ] **QSI-08**: Critical flow: staff creates a reservation via 4-step wizard (Phase 3).
- [ ] **QSI-09**: Critical flow: drag-to-move event in calendar (OBS-005 from QA sweep) — uses real browser DnD, validates backend persistence.
- [ ] **QSI-10**: Error boundaries: navigate to `/dashboard/nonexistent`, assert friendly fallback UI (not white screen). Same for 4xx/5xx API responses.
- [ ] **QSI-11**: E2E test suite integrated into CI workflow (extends `.github/workflows/ci.yml` from Phase 17), runs after unit tests, with retry-once on flakes.

---

## Approach

### Setup

- Install `@playwright/test` as devDep in `apps/web` (NOT root).
- `npx playwright install --with-deps chromium` for browser binaries.
- Create `apps/web/playwright.config.ts`:
  - `testDir: './e2e'`
  - Projects: `chromium-desktop` (1280×720) + `chromium-mobile` (Pixel 5 emulation)
  - `webServer`: `pnpm preview` (production build) — but for first-time setup, document that `pnpm build` must precede locally; CI will handle this
  - `baseURL: http://localhost:4173` (Vite preview default)
  - `retries: process.env.CI ? 1 : 0` — retry once on CI to absorb flakes
  - `reporter: [['html'], ['list']]`

### Test files (in `apps/web/e2e/`)

- `smoke-responsive.spec.ts` — QSI-06. Visits `/`, asserts no horizontal scroll at 4 viewport widths. Asserts key elements visible (hero `<img>`, reservation widget button).
- `login-dashboard-logout.spec.ts` — QSI-07. Seeds a test admin user (via API call in beforeAll OR uses fixture in apps/api seed). Performs login flow, verifies redirect to /dashboard, clicks logout, verifies redirect to /.
- `reservation-wizard.spec.ts` — QSI-08. Logged-in flow. Navigates to /reservations/new (or wherever wizard lives), advances through 4 steps, asserts confirmation.
- `calendar-drag-to-move.spec.ts` — QSI-09. Logged-in flow. Navigate to calendar view (/reservations?view=calendar or similar). Use Playwright's `dragTo` to move an event chip to a different cell. Assert backend persistence by re-fetching or checking the cell on next page load.
- `error-boundaries.spec.ts` — QSI-10. Visit `/dashboard/nonexistent` → assert NOT a white screen, instead user-friendly 404 message. Mock API to return 500 → assert error UI surfaces.

### Test data

- E2E tests need a seeded DB. Decision: tests run against `pnpm dev` API (port 3011) which connects to local Postgres. Either:
  - Option A: Use existing seed script (`apps/api/prisma/seed-room-types.ts`) — must include a test admin user with known credentials
  - Option B: Tests create their own data via API calls in `beforeAll`
- Option A is faster; B is more isolated. Pick A and document credentials in `.env.example` (`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`).

### CI integration

Extend `.github/workflows/ci.yml` (Phase 17 created it):
- Add a new job `e2e` that depends on the existing `ci` job
- Steps: checkout, setup-pnpm, setup-node, install --frozen-lockfile, `npx playwright install --with-deps chromium`, start API + web preview in background, wait for ports, run `pnpm --filter @hotel/web playwright test`
- Upload HTML report on failure as artifact
- `if: github.event_name == 'pull_request'` — only on PR, to save CI time on every push to master

OR (simpler): single workflow with the e2e step at the end, after tests. Choose whichever produces clean YAML.

---

## Out of scope

- ❌ Visual regression testing (screenshots) — defer to v1.5
- ❌ Cross-browser testing (Firefox, Safari) — chromium only in v1.4
- ❌ Performance assertions in E2E (Phase 21 handles that)
- ❌ Real production endpoint testing — local API only
- ❌ Modifying production code to add `data-testid` attributes — use existing selectors (role, label, text). Only add `data-testid` if there's no other way and document why.

---

## Constraints

- DO NOT modify any production code unnecessarily — E2E should adapt to the app, not vice versa.
- DO NOT touch `.github/workflows/perf.yml` (Phase 21 territory).
- DO NOT break the 159 existing Vitest tests.
- The `webServer` config requires a successful `pnpm build` first — document this prerequisite.
- Calendar DnD test (QSI-09) may need additional `data-testid` on `<button>` event chips for reliable selection — minimal annotation OK if necessary.
- Conventional commit: `feat(e2e): add Playwright critical flow + responsive smoke + error boundary tests (QSI-05..11)`
- ONE atomic commit.

---

## Verification

- `cd apps/web && npx playwright test` runs all suites locally (with dev API + dev web both up)
- All 5 spec files exist with at least 1 test each
- `playwright.config.ts` configured for chromium-desktop + chromium-mobile
- CI workflow extended; YAML valid
- `pnpm --filter @hotel/web test -- --run` → still 159 passing (Vitest unchanged)
- `pnpm --filter @hotel/api test -- --run` → still 848 passing

---

## Files expected

- NEW `apps/web/playwright.config.ts`
- NEW `apps/web/e2e/smoke-responsive.spec.ts`
- NEW `apps/web/e2e/login-dashboard-logout.spec.ts`
- NEW `apps/web/e2e/reservation-wizard.spec.ts`
- NEW `apps/web/e2e/calendar-drag-to-move.spec.ts`
- NEW `apps/web/e2e/error-boundaries.spec.ts`
- NEW `apps/web/e2e/README.md` — local prerequisites + how to run
- MODIFY `apps/web/package.json` — add `@playwright/test` devDep + scripts
- MODIFY `.github/workflows/ci.yml` — add E2E step/job
- POSSIBLY MODIFY a few production components to add `data-testid` (document each, minimal)
- MODIFY `.env.example` — add `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` placeholders

---

## Caveats noted

- DO NOT actually RUN Playwright in this phase if it requires building first. Verify configs are syntactically valid (`npx playwright test --list` lists tests without running them) and document local execution.
- DnD in Playwright uses real browser events — should be more reliable than jsdom from G3 of UX sweep.
- The `pnpm preview` server is the appropriate target for production-shape testing. For some flows (auth refresh expiry) you may need dev mode. Document this in `e2e/README.md`.
