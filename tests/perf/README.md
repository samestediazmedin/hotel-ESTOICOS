# Performance Tests — k6

## Prerequisites

### Install k6 (Go binary — NOT an npm package)

k6 is a standalone Go binary. Do not install it via npm.

**Windows (winget):**
```
winget install k6 --source winget
```

**macOS (Homebrew):**
```
brew install k6
```

**Linux (Debian/Ubuntu):**
```
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**CI (GitHub Actions):**  
The `perf.yml` workflow uses `grafana/setup-k6-action@v1` — no manual install needed.

Verify install: `k6 version`

---

## Scripts

### `booking-load.k6.js` — QSI-20

Load test for `POST /api/public/bookings`.

**Ramp profile:**
- 0 → 50 VUs over 30s (warm-up)
- 50 VUs sustained for 30s (steady state)
- 50 → 0 VUs over 10s (ramp-down)

**Thresholds:**
- `p(95) < 800ms` — 95th-percentile response latency
- `http_req_failed < 1%` — error budget

**CSRF:** The `setup()` function fetches a CSRF token from `GET /api/public/bookings/csrf-token` before the test begins and passes it to all VU iterations.

**Run (local):**
```bash
# With default placeholder UUIDs (will get 422/404 — tests infra, not business logic)
k6 run tests/perf/booking-load.k6.js

# With real seeded room IDs from your database
k6 run \
  -e BASE_URL=http://localhost:3011 \
  -e ROOM_ID=<uuid-from-db> \
  -e ROOM_TYPE_ID=<uuid-from-db> \
  tests/perf/booking-load.k6.js
```

**Note:** Using placeholder UUIDs produces 422 or 404 responses. To measure real latency including DB writes, seed actual room and room-type records and pass their UUIDs via env vars.

---

### `concierge-sse.k6.js` — QSI-21

Load test for `POST /api/concierge/chat` (SSE endpoint).

**Profile:** 20 concurrent VUs for 60s (fixed duration, no ramp stages).

**SSE strategy:** k6 does not natively support SSE. Each VU:
1. Fetches its own CSRF token from `GET /api/public/concierge/csrf-token`.
2. POSTs a short prompt to `/api/concierge/chat` with `Accept: text/event-stream`.
3. Reads the full buffered response body (k6 blocks until the connection closes).
4. Scans the body for terminal SSE event markers (`event: done`, `data: [DONE]`).

**Thresholds:**
- `http_req_failed < 1%` — no 5xx, no network failures
- `stream_complete > 95%` — custom Rate metric for stream completion detection

**Run (local):**
```bash
# Requires OPENAI_API_KEY set in the API process environment
k6 run tests/perf/concierge-sse.k6.js

# Against staging
k6 run -e BASE_URL=https://staging.hotel.example tests/perf/concierge-sse.k6.js
```

**Warning:** Each VU iteration makes a real OpenAI API call. Running 20 VUs for 60s against a fast model will consume real tokens. Estimate ~20–40 prompts total at ~200 input / ~100 output tokens each.

---

## Running Against a Local Environment

1. Start the API:
   ```bash
   pnpm --filter @hotel/api dev
   ```
2. Confirm the API is healthy:
   ```bash
   curl http://localhost:3011/api/health
   ```
3. Run the desired k6 script (see above).

---

## Recording the Baseline

After first successful runs, record results in `.planning/quality-baseline.md`.

k6 outputs a summary table at the end of each run. Capture:
- `http_req_duration` p50, p95, p99
- `http_req_failed` rate
- `stream_complete` rate (concierge script only)

---

## CI / Perf Workflow

The `.github/workflows/perf.yml` workflow:
- Triggers on manual dispatch (`workflow_dispatch`) or PR with label `perf-test`
- Installs k6 via `grafana/setup-k6-action@v1`
- Steps are `continue-on-error: true` — results are informational, never block merge
- Lighthouse CI runs against `pnpm preview` in the same workflow
