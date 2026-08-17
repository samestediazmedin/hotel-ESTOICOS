import axios from 'axios';

/**
 * Public-only axios instance for review-submit endpoints.
 *
 * Uses a fresh axios.create() — NOT the shared `api` instance from lib/api.ts.
 * Reason: the shared instance has a request interceptor that attaches
 * `Authorization: Bearer <token>` and a response interceptor that
 * attempts silent token refresh on 401.
 *
 * For public review endpoints, neither behavior is appropriate:
 * - No auth header: tokens are one-time JWT embedded in the email link, not bearer tokens.
 * - 401 from validate-token means "invalid review token" — must propagate, not redirect.
 *
 * withCredentials: false — no session cookie needed for public routes.
 */
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: false,
});

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ValidateTokenResponse {
  reservationId: string;
  guestName: string;
  stayDate: string;        // ISO date string, e.g. "2026-05-15"
  alreadySubmitted: boolean;
}

export interface SubmitReviewBody {
  token: string;
  rating: number;          // 1-5
  comment: string;         // 10-2000 chars
}

export interface SubmitReviewResponse {
  id: string;
  createdAt: string;
}

// ─── API functions ──────────────────────────────────────────────────────────

/**
 * GET /api/public/reviews/validate-token?token=...
 *
 * Verifies the JWT review token and returns guest context for form prefill.
 * Errors:
 *   401 — invalid signature or expired (> 90 days)
 *   410 — token JTI already used (review already submitted)
 */
export async function validateReviewToken(token: string): Promise<ValidateTokenResponse> {
  const res = await publicApi.get<ValidateTokenResponse>(
    '/public/reviews/validate-token',
    { params: { token } },
  );
  return res.data;
}

/**
 * POST /api/public/reviews
 *
 * Submits the guest review. Token is validated server-side on every call.
 * Errors:
 *   401 — invalid/expired token
 *   410 — token JTI already used
 *   429 — rate limit exceeded (5 submissions/IP/hour)
 *   400 — validation error (rating out of range, comment too short/long)
 */
export async function submitReview(body: SubmitReviewBody): Promise<SubmitReviewResponse> {
  const res = await publicApi.post<SubmitReviewResponse>('/public/reviews', body);
  return res.data;
}
