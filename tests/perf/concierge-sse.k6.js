/**
 * QSI-21 — k6 load test: POST /api/concierge/chat (SSE endpoint)
 *
 * k6 does NOT natively support SSE. Strategy:
 *   - GET /api/public/concierge/csrf-token per VU (sets CSRF cookie)
 *   - POST /api/concierge/chat with timeout: '60s'; k6 reads the full
 *     response body (NestJS buffers the SSE stream into the response body
 *     when consumed by a non-browser client)
 *   - Detect SSE event markers in the response body to validate stream
 *     completion: look for 'event: done' or 'data: [DONE]'
 *
 * Virtual users: 20 concurrent
 * Duration: 60s fixed (no ramp stages — SSE sessions are long-lived)
 *
 * Thresholds:
 *   http_req_failed < 1%   — no 5xx, no network failures
 *   stream_complete > 95%  — custom rate metric for stream completion
 *
 * Prerequisites:
 *   - API running at BASE_URL (default: http://localhost:3011)
 *   - OPENAI_API_KEY set in API environment (responses require real AI calls)
 *   - CSRF_SECRET set in API environment
 *
 * Run:
 *   k6 run tests/perf/concierge-sse.k6.js
 *   k6 run -e BASE_URL=https://staging.hotel.example tests/perf/concierge-sse.k6.js
 */

import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3011';

// Custom metric: tracks the fraction of VU iterations where the SSE stream
// completed (detected via terminal event marker in response body).
const streamCompleteRate = new Rate('stream_complete');

export const options = {
  vus:      20,
  duration: '60s',
  thresholds: {
    // No network failures and no 5xx responses
    http_req_failed:  ['rate<0.01'],
    // At least 95% of SSE streams must complete (reach a terminal event)
    stream_complete:  ['rate>0.95'],
  },
};

// ---------------------------------------------------------------------------
// setup() — obtain a single CSRF token for all VUs.
// Note: the concierge CSRF cookie uses __Host-concierge-csrf, which is
// bound to an IP-based session identifier (see csrf.middleware.ts).
// Each VU will re-fetch its own CSRF token to get a VU-specific cookie.
// ---------------------------------------------------------------------------

export function setup() {
  // Verify the CSRF endpoint is reachable before the test begins.
  const probe = http.get(`${BASE_URL}/api/public/concierge/csrf-token`, {
    tags: { name: 'concierge-csrf-probe' },
  });

  check(probe, {
    'concierge CSRF endpoint reachable': (r) => r.status === 200,
  });

  return {};
}

// ---------------------------------------------------------------------------
// default() — VU iteration logic
// ---------------------------------------------------------------------------

export default function (_data) {
  // Step 1: Obtain a fresh CSRF token for this VU iteration.
  // The double-submit pattern requires the cookie value to match the
  // X-CSRF-Token header. We fetch per-iteration to ensure cookie freshness.
  const csrfRes = http.get(`${BASE_URL}/api/public/concierge/csrf-token`, {
    tags: { name: 'concierge-csrf-token' },
  });

  check(csrfRes, {
    'csrf: status 200': (r) => r.status === 200,
  });

  let csrfToken = '';
  let csrfCookie = '';

  try {
    csrfToken  = JSON.parse(csrfRes.body).csrfToken;
    csrfCookie = (csrfRes.headers['Set-Cookie'] || '').split(';')[0].trim();
  } catch (_) {
    console.warn(`VU ${__VU}: could not parse CSRF token — stream will likely 403`);
  }

  // Step 2: Send SSE chat request.
  // Using a simple, short prompt to keep AI processing time bounded.
  const payload = JSON.stringify({
    message: '¿Cuáles son los horarios de check-in del hotel?',
    sessionCookie: `k6-vu-${__VU}-iter-${__ITER}`,
  });

  const headers = {
    'Content-Type':  'application/json',
    'Accept':        'text/event-stream',
    'X-CSRF-Token':  csrfToken,
    'Cookie':        csrfCookie,
  };

  // Step 3: POST to SSE endpoint with a 60s read timeout.
  // k6 reads the full response body synchronously — this is the k6
  // workaround for SSE: the complete buffered SSE stream arrives as
  // one string once the server closes the connection.
  const res = http.post(`${BASE_URL}/api/concierge/chat`, payload, {
    headers,
    timeout: '60s',
    tags: { name: 'concierge-chat' },
  });

  // Step 4: Validate HTTP-level success.
  const httpOk = check(res, {
    'chat: no 5xx':     (r) => r.status < 500,
    'chat: not 403':    (r) => r.status !== 403,
    'chat: not empty':  (r) => (r.body || '').length > 0,
  });

  // Step 5: Detect SSE stream completion.
  // NestJS ConciergeService emits a terminal event when the stream is done.
  // Possible markers (check both patterns for resilience):
  //   event: done\n
  //   data: [DONE]\n
  //   data: {"event":"done"}\n
  const body = res.body || '';
  const streamCompleted =
    body.includes('event: done') ||
    body.includes('data: [DONE]') ||
    body.includes('"event":"done"') ||
    body.includes('"type":"done"');

  streamCompleteRate.add(streamCompleted ? 1 : 0);

  check(res, {
    'chat: stream completed': () => streamCompleted,
  });

  // No explicit sleep — SSE sessions are naturally long-lived.
  // The 60s VU duration budget controls concurrency naturally.
}
