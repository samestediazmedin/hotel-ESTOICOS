# Quality Baseline — HotelOS AI

> **STATUS: PENDING FIRST RUN**
>
> This file is a template. The actual baseline values must be measured manually
> by running k6 and Lighthouse against a running API + web build.
> See `tests/perf/README.md` for run instructions.
>
> Once measured, replace all `<TBD on first run>` placeholders with real values
> and record the date and environment below.

---

## Measurement Environment

| Field             | Value                        |
|-------------------|------------------------------|
| Date              | `<TBD on first run>`         |
| Measured by       | `<TBD>`                      |
| Environment       | Local dev / CI runner        |
| API commit        | `<git SHA>`                  |
| Web commit        | `<git SHA>`                  |
| Database state    | Seeded with test fixtures     |
| Machine specs     | `<TBD (CPU, RAM, OS)>`       |

---

## Booking Endpoint — POST /api/public/bookings (QSI-20)

k6 ramp: 0 → 50 VUs over 30s, sustained 50 VUs for 30s, ramp-down 10s.

| Metric                  | Value                  | Threshold |
|-------------------------|------------------------|-----------|
| p50 (median latency)    | `<TBD on first run>`   | —         |
| p95 latency             | `<TBD on first run>`   | < 800ms   |
| p99 latency             | `<TBD on first run>`   | —         |
| Error rate              | `<TBD on first run>`   | < 1%      |
| Total requests          | `<TBD on first run>`   | —         |
| RPS at steady state     | `<TBD on first run>`   | —         |

### k6 run command used

```bash
k6 run \
  -e BASE_URL=http://localhost:3011 \
  -e ROOM_ID=<uuid> \
  -e ROOM_TYPE_ID=<uuid> \
  tests/perf/booking-load.k6.js
```

---

## Concierge SSE — POST /api/concierge/chat (QSI-21)

k6 profile: 20 concurrent VUs for 60s (fixed duration).

| Metric                    | Value                  | Threshold |
|---------------------------|------------------------|-----------|
| Average stream duration   | `<TBD on first run>`   | —         |
| p95 stream duration       | `<TBD on first run>`   | —         |
| Stream completion rate    | `<TBD on first run>`   | > 95%     |
| Error rate (5xx)          | `<TBD on first run>`   | < 1%      |
| Total streams opened      | `<TBD on first run>`   | —         |

### k6 run command used

```bash
k6 run \
  -e BASE_URL=http://localhost:3011 \
  tests/perf/concierge-sse.k6.js
```

---

## Lighthouse Scores — Public Portal / (QSI-22)

Measured against production build (`pnpm build` + `pnpm preview`).
Each score is the median across 3 Lighthouse runs.

| Category       | Score               | Threshold |
|----------------|---------------------|-----------|
| Performance    | `<TBD on first run>` | ≥ 0.80   |
| Accessibility  | `<TBD on first run>` | ≥ 0.95   |
| Best Practices | `<TBD on first run>` | ≥ 0.90   |
| SEO            | `<TBD on first run>` | ≥ 0.90   |

### lhci run command used

```bash
# Must have production build and preview server running
pnpm --filter @hotel/web build
pnpm --filter @hotel/web lhci:autorun
```

---

## Regression Protocol

When a PR:
- Changes a hot path in booking creation, concierge streaming, or AI calls
- Bumps a performance-sensitive dependency (Prisma, NestJS, OpenAI SDK)
- Modifies database queries in `ReservationsModule` or `PublicBookingModule`

**Do the following:**
1. Add the `perf-test` label to the PR (triggers the perf workflow automatically)
2. Compare new k6 p95 against the baseline above
3. Compare new Lighthouse scores against the thresholds above
4. If any metric regresses > 10% from baseline, investigate before merging

Update this file after any intentional infrastructure change that resets the baseline.
