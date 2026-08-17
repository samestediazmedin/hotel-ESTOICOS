# Phase 14 — Manual QA Checklist (8 Scenarios)

**Phase:** 14 — Public Reviews System
**Plan:** 14-06
**Date:** 2026-05-18
**Requirements covered:** REV-01 · REV-02 · REV-03 · REV-04 · REV-05 · REV-06 · REV-07 · REV-08

---

## Prerequisites

Before running these scenarios, ensure:

- [ ] API running: `cd apps/api && pnpm start:dev`
- [ ] Frontend running: `cd apps/web && pnpm dev`
- [ ] Railway DB reachable + migration `20260518170000_phase14_public_reviews_schema` applied
- [ ] `.env` has `REVIEW_TOKEN_SECRET`, `RESEND_API_KEY`, `FRONTEND_BASE_URL=http://localhost:5173`
- [ ] At least one staff user exists in the DB (admin role preferred)

---

## Scenario 1 — Valid token flow + successful review submission

> Covers: REV-02 (token issuance), REV-03 (submit endpoint), REV-05 (form UI)

**Steps:**
1. Insert a `Reservation` row with `status=CHECKED_OUT`, `checkOutDate` = yesterday, and a `Guest` with a valid email address. Note the `reservationId`.
2. Using a NestJS REPL or admin endpoint, call `ReviewsService.signReviewToken({ reservationId, guestName: 'Lucía García', stayDate: new Date('2026-05-17') })` to obtain a signed JWT.
3. Visit `http://localhost:5173/review/submit?token=<signed-token>`.

**Expected results:**
- [ ] Page renders without error — guestName "Lucía García" displayed in greeting
- [ ] Stay date shown in human-readable format (e.g., "17 de mayo de 2026")
- [ ] 5-star `StarRatingInput` is keyboard-navigable (Tab → star focused, Arrow keys move between stars)
- [ ] Set rating = 4, enter comment "Excelente estadía, muy recomendado." (≥10 chars)
- [ ] Click submit → success state "¡Gracias por tu reseña!" appears
- [ ] DB: `reviews` table has 1 new row with `moderated=false`, `publishedAt=null`

---

## Scenario 2 — Invalid / tampered token

> Covers: REV-02 (token validation), REV-05 (error state)

**Steps:**
1. Visit `http://localhost:5173/review/submit?token=eyBOGUS.PAYLOAD.SIG`

**Expected results:**
- [ ] Page shows "Este enlace ya no es válido o ha expirado" error state
- [ ] NO form is rendered — only the error message and a link back to `/`
- [ ] Network tab: `GET /api/public/reviews/validate-token?token=eyBOGUS...` returns 401

---

## Scenario 3 — Token replay (single-use enforcement)

> Covers: REV-02 (single-use constraint), REV-03 (410 response)

**Steps:**
1. Reuse the token from Scenario 1 (already consumed).
2. Visit `http://localhost:5173/review/submit?token=<same-token>`.
3. Also attempt directly via curl:
   ```bash
   curl -X POST http://localhost:3011/api/public/reviews \
     -H "Content-Type: application/json" \
     -d '{"token":"<same-token>","rating":5,"comment":"Trying to replay."}'
   ```

**Expected results:**
- [ ] Page shows "Este enlace ya fue utilizado" (`alreadySubmitted=true` from validate-token endpoint)
- [ ] Curl returns `410 Gone` — not 200 or 201
- [ ] DB: still only 1 review row for this reservation (no duplicate created)

---

## Scenario 4 — Client-side form validation

> Covers: REV-05 (form validation — Zod schema)

**Steps:**
1. With a fresh valid token (new reservation), open `/review/submit?token=...`.
2. Click Submit with 0 stars selected.
3. Set 5 stars but enter comment "ok" (only 2 chars), click Submit.
4. Set 5 stars but enter a 2001-character comment, click Submit.

**Expected results:**
- [ ] 0 stars: error "Selecciona al menos 1 estrella" (or equivalent) visible below rating
- [ ] 2-char comment: error "Mínimo 10 caracteres" visible below textarea
- [ ] 2001-char comment: error "Máximo 2000 caracteres" visible below textarea
- [ ] Form does NOT submit in any of the above cases (no network request to POST endpoint)

---

## Scenario 5 — Rate limit (5 submissions per IP per hour)

> Covers: REV-02 (dedicated reviews-submit throttler, 5/IP/hour), REV-07 (rate limit separate from global)

**Steps:**
1. Generate 6 fresh valid tokens (6 different reservations or use the same token before single-use kicks in — use fresh tokens each time).
2. Submit 6 POST requests to `http://localhost:3011/api/public/reviews` within 1 minute:
   ```bash
   for i in 1..6; curl -X POST http://localhost:3011/api/public/reviews \
     -H "Content-Type: application/json" \
     -d '{"token":"<fresh-token-N>","rating":5,"comment":"Rate limit test attempt N."}'
   ```

**Expected results:**
- [ ] First 5 requests return `201 Created`
- [ ] 6th request returns `429 Too Many Requests`
- [ ] The limit is enforced by the `reviews-submit` throttler (TTL=3600000ms/limit=5), NOT the global `short` throttler

---

## Scenario 6 — Staff moderation flow

> Covers: REV-04 (moderate endpoint), REV-06 (any staff role), REV-05 (portal section)

**Steps:**
1. Log in as a RECEPTION staff user (not ADMIN) at `http://localhost:5173/login`.
2. Click "Reseñas" in the sidebar under Administración section.
3. Verify `/reviews` page loads without 403 error.
4. The "Pendientes" tab shows the review submitted in Scenario 1.
5. Click "Aprobar" on that review.

**Expected results:**
- [ ] `/reviews` route loads for RECEPTION role (any staff can moderate per REV-06)
- [ ] 3 tabs render: Pendientes · Publicadas · Rechazadas
- [ ] Review from Scenario 1 appears in "Pendientes" tab with guestName, rating, comment preview
- [ ] After "Aprobar": review disappears from Pendientes, appears in Publicadas
- [ ] DB: `reviews` row has `moderated=true`, `publishedAt` is NOT null

---

## Scenario 7 — Portal reflection (cross-cache invalidation)

> Covers: REV-05 (ReviewsSection real data), REV-01 (reviews table), PDA-01 (public endpoint)

**Steps:**
1. Immediately after Scenario 6 (approve action), open a new tab.
2. Visit `http://localhost:5173/booking` (or `/`).
3. Scroll to the "Reseñas" section.
4. Wait 60 seconds and refresh the page.

**Expected results:**
- [ ] The just-approved review appears in the Reseñas section on `/booking`
- [ ] `averageRating` and total review count reflect the new state (not the old hardcoded 4.84/318)
- [ ] The `ReviewsSectionSkeleton` flashes briefly on first load, then real data renders
- [ ] "Ver más reseñas" button appears if `total > 10` (or is hidden if only 1 review)
- [ ] After 60s refresh: data still correct (CDN Cache-Control max-age=60 honored, not stale forever)

---

## Scenario 8 — Night-audit cron pipeline (end-to-end email)

> Covers: REV-07 (post-checkout email cron), REV-02 (JWT in email link), REV-08 (submit form from email)

**Steps:**
1. Insert a new `Reservation` with:
   - `status=CHECKED_OUT`
   - `checkOutDate` = yesterday's date
   - `reviewInviteSentAt = NULL`
   - Linked `Guest` with a valid email address you can access (e.g., a Resend test inbox)
2. Trigger the night-audit backfill via admin JWT:
   ```bash
   curl -X POST "http://localhost:3011/api/night-audit/backfill?businessDate=<today>" \
     -H "Authorization: Bearer <admin-jwt>"
   ```
3. Check the Resend dashboard (https://resend.com/emails) for a new email.
4. In the DB, verify `reviewInviteSentAt` is populated for that reservation.
5. Click the link in the email — it should open `http://localhost:5173/review/submit?token=...`.

**Expected results:**
- [ ] Email appears in Resend dashboard with subject "Cuéntanos sobre tu estadía en [hotel name]..."
- [ ] Email body shows guest name, stay date (formatted in es-CO), and a terracotta CTA button
- [ ] DB: `Reservation.reviewInviteSentAt` now has a timestamp (was NULL before)
- [ ] Clicking the email link loads the review form correctly with guestName prefilled
- [ ] A second backfill for the same date does NOT re-send the email (idempotency — `reviewInviteSentAt IS NOT NULL` guard)

---

## Results Summary

| # | Scenario | Status | Notes |
|---|----------|--------|-------|
| 1 | Valid token + submit | [ ] Pass / [ ] Fail | |
| 2 | Invalid token | [ ] Pass / [ ] Fail | |
| 3 | Token replay 410 | [ ] Pass / [ ] Fail | |
| 4 | Client-side validation | [ ] Pass / [ ] Fail | |
| 5 | Rate limit 429 | [ ] Pass / [ ] Fail | |
| 6 | Staff moderation | [ ] Pass / [ ] Fail | |
| 7 | Portal reflection | [ ] Pass / [ ] Fail | |
| 8 | Night-audit cron pipeline | [ ] Pass / [ ] Fail | |

**Overall:** [ ] All 8 PASS — Phase 14 functionally complete
            [ ] Failures in scenarios: _____ — document in 14-CLOSEOUT.md

---

## Notes

- Scenarios 1-4 and 6-7 can be run without Resend credentials (mock email in dev, check DB directly).
- Scenario 5 may require clearing rate-limit state between test runs: restart the API or wait 1 hour.
- Scenario 8 requires a working Resend API key with the hotel's sender domain configured.
- Any failures should be documented in `.planning/phases/14-public-reviews-system/14-CLOSEOUT.md` under "Known Issues / Carry-Forward".
