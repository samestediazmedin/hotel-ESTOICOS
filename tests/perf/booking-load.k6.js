/**
 * QSI-20 — k6 load test: POST /api/public/bookings
 *
 * Ramp profile:
 *   0 → 50 VUs over 30s  (warm-up)
 *   50 VUs sustained 30s (steady state)
 *   50 → 0 VUs over 10s  (ramp-down)
 *   Total clock time: ~70s
 *
 * Thresholds:
 *   p(95) < 800ms  — 95th-percentile latency
 *   http_req_failed < 1%  — error budget
 *
 * Prerequisites:
 *   - API running at BASE_URL (default: http://localhost:3011)
 *   - Valid roomId + roomTypeId UUIDs set as env vars or replaced here
 *   - CSRF token endpoint: GET /api/public/bookings/csrf-token
 *
 * Run:
 *   k6 run tests/perf/booking-load.k6.js
 *   k6 run -e BASE_URL=https://staging.hotel.example tests/perf/booking-load.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3011';

// Realistic room IDs — override via env or replace with seeded UUIDs from your DB.
// These are placeholder UUIDs; the test will produce 422/404 with fake IDs.
// Set ROOM_ID and ROOM_TYPE_ID env vars pointing to actual seeded rooms for valid runs.
const ROOM_ID      = __ENV.ROOM_ID       || '00000000-0000-0000-0000-000000000001';
const ROOM_TYPE_ID = __ENV.ROOM_TYPE_ID  || '00000000-0000-0000-0000-000000000002';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp 0 → 50 VUs
    { duration: '30s', target: 50 },   // sustain 50 VUs
    { duration: '10s', target: 0  },   // ramp down
  ],
  thresholds: {
    // p(95) must be below 800ms
    http_req_duration: ['p(95)<800'],
    // Less than 1% of requests may fail (network error OR non-2xx)
    http_req_failed: ['rate<0.01'],
  },
};

// ---------------------------------------------------------------------------
// setup() — runs ONCE before the load test; obtains CSRF token + cookie.
// k6 executes setup() in a single VU and passes the returned object to
// default() and teardown() as the `data` parameter.
// ---------------------------------------------------------------------------

export function setup() {
  const csrfRes = http.get(`${BASE_URL}/api/public/bookings/csrf-token`, {
    tags: { name: 'csrf-token' },
  });

  check(csrfRes, {
    'csrf-token: status 200': (r) => r.status === 200,
    'csrf-token: body has csrfToken': (r) => {
      try {
        return JSON.parse(r.body).csrfToken !== undefined;
      } catch (_) {
        return false;
      }
    },
  });

  let csrfToken = '';
  try {
    csrfToken = JSON.parse(csrfRes.body).csrfToken;
  } catch (_) {
    console.warn('setup(): could not parse CSRF token — bookings will likely return 403');
  }

  // Extract Set-Cookie value for hotel_csrf cookie so VUs can replay it.
  // k6 http.cookieJar() is per-VU and does NOT inherit from setup(); we must
  // pass the raw cookie string and re-inject it in each VU iteration.
  const setCookieHeader = csrfRes.headers['Set-Cookie'] || '';

  return { csrfToken, setCookieHeader };
}

// ---------------------------------------------------------------------------
// default() — VU iteration logic
// ---------------------------------------------------------------------------

export default function (data) {
  const { csrfToken, setCookieHeader } = data;

  // Build a realistic booking body matching CreatePublicBookingSchema (Zod v4).
  // Using a future check-in date so the API does not reject past dates.
  const today = new Date();
  const checkIn  = formatDate(addDays(today, 7));
  const checkOut = formatDate(addDays(today, 9));

  const payload = JSON.stringify({
    fullName:           'Load Test Guest',
    email:              `loadtest+${__VU}@example.com`,
    phone:              '+573001234567',
    documentType:       'CC',
    documentNumber:     `900${String(__VU).padStart(6, '0')}`,
    nationality:        'CO',
    dateOfBirth:        '1990-01-15',
    roomId:             ROOM_ID,
    roomTypeId:         ROOM_TYPE_ID,
    checkIn,
    checkOut,
    adults:             2,
    preferredLanguage:  'es',
    contactPreference:  'EMAIL',
    marketingConsent:   false,
    specialRequests:    null,
  });

  const headers = {
    'Content-Type':  'application/json',
    'X-CSRF-Token':  csrfToken,
    // Re-inject the CSRF cookie obtained in setup() — required for double-submit validation.
    // In a real browser the cookie jar handles this automatically.
    'Cookie': extractCookieValue(setCookieHeader),
  };

  const res = http.post(`${BASE_URL}/api/public/bookings`, payload, {
    headers,
    tags: { name: 'create-booking' },
  });

  check(res, {
    'booking: status 201 or 409 (conflict)': (r) =>
      r.status === 201 || r.status === 409,
    'booking: no 5xx': (r) => r.status < 500,
  });

  // Minimal think-time: simulate user reviewing confirmation (0.5–1.5s)
  sleep(Math.random() + 0.5);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date, days) {
  const d = new Date(date.valueOf());
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Extract raw "name=value" from a Set-Cookie header string.
 * Only passes the first cookie segment (name=value), ignoring attributes.
 */
function extractCookieValue(setCookieHeader) {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0].trim();
}
