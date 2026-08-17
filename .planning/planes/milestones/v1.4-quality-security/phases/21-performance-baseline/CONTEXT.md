# Phase 21 — Performance Baseline

**Milestone:** v1.4 Quality & Security Infrastructure
**Phase position:** 5 of 5
**Trigger:** External QA audit Section 11 — "Herramientas recomendadas: k6, Lighthouse CI"
**Goal:** Establish performance baseline metrics so future regressions are measurable.

---

## Requirements

- [ ] **QSI-20**: k6 load test script for `POST /api/public/bookings` — 50 VUs, ramping 60s, p95 < 800ms, error rate < 1%.
- [ ] **QSI-21**: k6 script for `/api/concierge/chat` SSE endpoint — 20 concurrent streams, no token-budget breach, no 5xx, all streams complete.
- [ ] **QSI-22**: Lighthouse CI on `/` (public portal) — performance ≥ 80, a11y ≥ 95, best practices ≥ 90, SEO ≥ 90. Runs in PR comment mode (informational, NOT blocking — avoids flakes).
- [ ] **QSI-23**: Baseline metrics persisted in `.planning/quality-baseline.md` after first successful run. Future regressions compare against this.

---

## Approach

### QSI-20 + QSI-21 (k6 scripts)

- Install k6 via instructions (NOT as npm dep — k6 is a separate Go binary). Document the install command.
- Create `tests/perf/` directory at repo root.
- `tests/perf/booking-load.k6.js` — script using `import http from 'k6/http'`, `import { check, sleep } from 'k6'`. Define `options.stages` for the ramp.
- `tests/perf/concierge-sse.k6.js` — uses `http.asyncRequest` or streaming pattern (k6 doesn't natively SSE — use `http.get` with timeout + parse response stream).
- Scripts target `http://localhost:3011` by default (the API dev port — read `vite.config.ts` proxy target). Configurable via `BASE_URL` env var so CI can override.
- Include `thresholds`: `http_req_duration{p(95)<800}`, `http_req_failed<0.01`.

### QSI-22 (Lighthouse CI)

- Install `@lhci/cli` as devDep in apps/web.
- Create `apps/web/lighthouserc.cjs` (or `.json`) with assertions:
  - `categories:performance >= 0.80`
  - `categories:accessibility >= 0.95`
  - `categories:best-practices >= 0.90`
  - `categories:seo >= 0.90`
- Configure to run against a local `pnpm dev` build OR a `pnpm preview` (production build). Lighthouse prefers production builds.
- For CI: add a separate workflow file `.github/workflows/perf.yml` (NOT modify ci.yml — Phase 18 + Phase 20 also want to touch ci.yml and we need to avoid conflicts). Trigger on PR and on push to master. Lighthouse step uses `lhci autorun --upload.target=temporary-public-storage` so reports are shareable URLs.
- Mark Lighthouse as informational only — comment results on PR, never block merge. Configurable via `lighthouse-ci.yml` settings.

### QSI-23 (Baseline persistence)

- After first manual k6 + Lighthouse run, capture results.
- Write `.planning/quality-baseline.md` with:
  - Date of baseline
  - Booking endpoint: p50, p95, p99, error rate
  - Concierge SSE: avg stream duration, completion rate
  - Lighthouse scores (perf, a11y, BP, SEO)
  - Hardware notes (CI runner vs local)
- Future regressions: any phase that bumps a perf-sensitive dependency or refactors a hot path should re-run k6 + Lighthouse and compare to baseline.

---

## Out of scope

- ❌ Modify existing `.github/workflows/ci.yml` (Phase 18 + 20 will). Create a SEPARATE workflow `perf.yml`.
- ❌ Run k6 in main CI workflow (too slow, would push cold-cache time over 5 min). Perf workflow can run on schedule (nightly) or on PR with label `perf-test`.
- ❌ Backend perf instrumentation / APM — that's v1.5 if needed.
- ❌ Real production environment perf — these tests target local dev API.

---

## Constraints

- k6 is NOT a Node module. It's a Go binary. Document install: `winget install k6 --source winget` on Windows, `brew install k6` on macOS, `apt install k6` on Linux. CI uses `grafana/setup-k6-action@v1` to install in workflow.
- Lighthouse CI requires Chrome to be available in CI runner — `ubuntu-latest` has Chrome preinstalled.
- DON'T actually run k6 / Lighthouse during this phase — only build the scripts and config. Running requires the API + web to be up; that's the user's job to verify locally.
- Scripts must be syntactically valid k6 (run `k6 inspect` if available to verify).
- `.github/workflows/perf.yml` must not collide with ci.yml (different filename, different triggers).

---

## Verification

- `tests/perf/booking-load.k6.js` exists, valid k6 syntax, options.stages defined, thresholds set
- `tests/perf/concierge-sse.k6.js` exists, valid k6 syntax, streaming handled
- `apps/web/lighthouserc.cjs` exists, 4 category thresholds set
- `.github/workflows/perf.yml` exists, triggers on PR + push, uses `lhci/lhci-action` and `grafana/setup-k6-action`
- `.planning/quality-baseline.md` exists with a placeholder explaining "first run pending — populated after manual execution"
- No modifications to `.github/workflows/ci.yml` (Phase 17's territory)

---

## Files expected

- NEW `tests/perf/booking-load.k6.js`
- NEW `tests/perf/concierge-sse.k6.js`
- NEW `tests/perf/README.md` — how to install k6, how to run scripts locally
- NEW `apps/web/lighthouserc.cjs`
- NEW `.github/workflows/perf.yml`
- NEW `.planning/quality-baseline.md` (placeholder until first run)
- Possibly modify `apps/web/package.json` to add `@lhci/cli` devDep + npm script `lhci:autorun`
