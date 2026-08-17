# Phase 21: Performance Baseline — PLAN

**Phase:** 21
**Milestone:** v1.4 — Quality & Security Infrastructure
**Mode:** infrastructure
**Goal:** k6 load tests + Lighthouse CI with persisted baseline.
**Trigger:** External QA audit — need measurable performance gates
**Depends on:** Phase 17 (CI workflow exists)
**Requirements:** QSI-20, QSI-21, QSI-22, QSI-23

## Success Criteria

1. k6 script for POST /api/public/bookings — 50 VUs ramp 60s, p95 < 800ms, error rate < 1%
2. k6 script for /api/public/concierge/chat SSE — 20 concurrent streams, no token-budget breach, no 5xx
3. Lighthouse CI on / with performance ≥ 80, a11y ≥ 95, best practices ≥ 90, SEO ≥ 90
4. Baseline metrics persisted to `.planning/quality-baseline.md` for future regression comparison

## Tasks

### Task 1: k6 Booking Load Test
- `tests/perf/booking-load.k6.js`
- 50 VUs ramp over 60 seconds
- POST /api/public/bookings with valid payload
- Thresholds:
  - p95 < 800ms
  - Error rate < 1%
  - 95th percentile checks pass
- Export results to JSON for CI artifacts

### Task 2: k6 Concierge SSE Test
- `tests/perf/concierge-sse.k6.js`
- 20 VUs sustained for 5 minutes
- Connect to /api/public/concierge/chat SSE endpoint
- Send messages and verify streaming responses
- Assert no token-budget breach (check response headers)
- Assert zero 5xx errors
- Assert completion rate > 95%

### Task 3: Lighthouse CI Configuration
- `apps/web/lighthouserc.cjs`
- Test URL: `/` (public portal)
- Categories with thresholds:
  - Performance ≥ 80
  - Accessibility ≥ 95
  - Best Practices ≥ 90
  - SEO ≥ 90
- Run on PR (not push)
- Upload results to temporary storage
- Assert thresholds pass

### Task 4: Baseline Documentation
- `.planning/quality-baseline.md`
- Document first measurement methodology
- Create template for recording:
  - Date
  - Commit hash
  - k6 p95 values
  - Lighthouse scores
  - Test environment specs
- Note: First actual measurement pending user manual execution

## Verification

- [ ] k6 booking test: p95 < 800ms, error rate < 1%
- [ ] k6 concierge test: 20 streams, 0 5xx, completion > 95%
- [ ] Lighthouse CI: all 4 thresholds pass
- [ ] CI job runs on PR
- [ ] Baseline file created with placeholder

## Files Created/Modified

- `tests/perf/booking-load.k6.js` (new)
- `tests/perf/concierge-sse.k6.js` (new)
- `apps/web/lighthouserc.cjs` (new)
- `.github/workflows/perf.yml` (new — separate workflow for performance)
- `.planning/quality-baseline.md` (new)

## Sub-agent

`deployer`

## Commit

`4bcd6a6`
