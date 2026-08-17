# Phase 18: Playwright E2E — PLAN

**Phase:** 18
**Milestone:** v1.4 — Quality & Security Infrastructure
**Mode:** infrastructure
**Goal:** Critical user flows + responsive smoke covered by real-browser tests, runs in CI.
**Trigger:** External QA audit — need real-browser coverage for DnD and responsive layouts
**Depends on:** Phase 17 (CI workflow exists)
**Requirements:** QSI-05, QSI-06, QSI-07, QSI-08, QSI-09, QSI-10, QSI-11

## Success Criteria

1. Playwright installed in apps/web with chromium + mobile config
2. Smoke test asserts public portal renders at 360/768/1024/1440 without horizontal scroll
3. Critical flow login → dashboard → logout covered
4. Critical flow wizard reservation creation covered
5. Critical flow drag-to-move calendar covered with real browser DnD
6. Error boundaries asserted for nonexistent routes and 4xx/5xx
7. Suite integrated in CI with retry-once on flakes

## Tasks

### Task 1: Playwright Installation & Config
- Install `@playwright/test@1.60.0` in `apps/web`
- Create `playwright.config.ts` with:
  - Desktop Chromium (1280x720 default)
  - Mobile Chromium (Pixel 5 viewport)
  - Base URL: `http://localhost:5173`
- Add `webServer` config to auto-start dev server
- Create `.gitignore` entries for test artifacts

### Task 2: Smoke Tests (Responsive)
- `apps/web/e2e/smoke-responsive.spec.ts`
- Test public portal at 4 viewports: 360, 768, 1024, 1440
- Assert no horizontal scroll
- Assert key elements visible at each viewport

### Task 3: Critical Flow — Login
- `apps/web/e2e/login-dashboard-logout.spec.ts`
- Login with valid credentials
- Navigate to dashboard
- Assert KPI cards visible
- Logout
- Assert redirect to login

### Task 4: Critical Flow — Reservation Wizard
- `apps/web/e2e/reservation-wizard.spec.ts`
- Navigate to reservations
- Complete 4-step wizard
- Assert reservation created
- Assert appears in calendar

### Task 5: Critical Flow — Calendar DnD
- `apps/web/e2e/calendar-drag-to-move.spec.ts`
- Add 3 `data-testid` to `RoomRackTable` for DnD handles
- Use Playwright `dragTo()` API
- Drag reservation to new date
- Assert position updated

### Task 6: Error Boundaries
- `apps/web/e2e/error-boundaries.spec.ts`
- Visit nonexistent route
- Assert catch-all redirect
- Trigger 4xx/5xx errors
- Assert error boundary renders

### Task 7: CI Integration
- Add E2E job to `.github/workflows/ci.yml`
- Run on PR only (not push to avoid flakiness noise)
- Add Postgres service container for backend
- Configure retry-once for flakes
- Upload artifacts on failure

## Verification

- [ ] All 5 spec files pass locally
- [ ] Mobile viewport tests pass
- [ ] CI E2E job passes on PR
- [ ] Intentionally break a flow → test fails with clear screenshot
- [ ] Total: 50 tests (5 specs × 2 projects: desktop + mobile)

## Files Created/Modified

- `apps/web/playwright.config.ts` (new)
- `apps/web/e2e/smoke-responsive.spec.ts` (new)
- `apps/web/e2e/login-dashboard-logout.spec.ts` (new)
- `apps/web/e2e/reservation-wizard.spec.ts` (new)
- `apps/web/e2e/calendar-drag-to-move.spec.ts` (new)
- `apps/web/e2e/error-boundaries.spec.ts` (new)
- `.github/workflows/ci.yml` (modified — add E2E job)
- `apps/web/src/components/calendar/RoomRackTable.tsx` (modified — add data-testid)

## Sub-agent

`zoe`

## Commit

`c2ef86d`
