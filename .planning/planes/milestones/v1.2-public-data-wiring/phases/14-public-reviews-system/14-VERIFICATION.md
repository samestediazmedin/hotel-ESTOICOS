---
phase: 14-public-reviews-system
verified: 2026-05-18T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Scenario 1 — Valid token flow + successful review submission"
    expected: "Form renders with guest name prefilled; 4-star rating + comment submitted; DB row created with moderated=false"
    why_human: "Requires live DB + signed JWT token + browser interaction; cannot verify form state machine end-to-end programmatically"
  - test: "Scenario 2 — Invalid / tampered token"
    expected: "Error state renders; no form shown; GET validate-token returns 401"
    why_human: "Requires live API call with a malformed JWT to confirm 401 path and error state rendering"
  - test: "Scenario 3 — Token replay 410 (single-use enforcement)"
    expected: "Second submission returns 410 Gone; alreadySubmitted flag true; no duplicate review row"
    why_human: "Requires DB with unique constraint active and a previously consumed JTI on a real reservation row"
  - test: "Scenario 5 — Rate limit 5/IP/hour (reviews-submit throttler)"
    expected: "5th request returns 201; 6th returns 429; correct throttler name used (not global short/long)"
    why_human: "Requires 6 sequential HTTP submissions against a running NestJS instance with the dedicated reviews-submit throttler active"
  - test: "Scenario 6 — Staff moderation flow (RECEPTION role)"
    expected: "/reviews loads for RECEPTION user; approve action moves review from Pendientes to Publicadas; DB moderated=true + publishedAt set"
    why_human: "Requires authenticated staff session + browser tab interaction with the 3-tab UI"
  - test: "Scenario 7 — Portal cross-cache invalidation after moderation"
    expected: "Approved review appears on /booking Reseñas within 60s; averageRating + count from live DB; no hardcoded 4.84/318 visible"
    why_human: "Requires live approved review in DB + Cache-Control window observation; programmatic verification cannot confirm real browser behavior"
  - test: "Scenario 8 — Night-audit cron pipeline (end-to-end email)"
    expected: "Resend email delivered with correct subject + guest name + terracotta CTA link; reviewInviteSentAt stamped; second trigger does not re-send"
    why_human: "Requires Railway DB connectivity + Resend API key + manually triggering the night-audit backfill endpoint"
  - test: "DB migration applied to Railway (infrastructure)"
    expected: "prisma migrate status shows 20260518170000_phase14_public_reviews_schema as Applied"
    why_human: "Railway DB connectivity was intermittent during Phase 14-01 (P1001). Migration SQL is correct but deployment requires human to run prisma migrate deploy when DB is reachable"
---

# Phase 14: Public Reviews System — Verification Report

**Phase Goal:** Real guests submit reviews via post-checkout email link; admin moderates from staff page; published reviews display on `/booking` Reseñas section with aggregated rating; hardcoded reviews data deleted.
**Verified:** 2026-05-18
**Status:** human_needed — 7/7 automated criteria VERIFIED; 8 items flagged for human/runtime verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `reviews` Prisma table with all required columns + CHECK(rating) + correct indexes | VERIFIED | `schema.prisma` lines 572-588: Review model with all 10 columns; `@@index([moderated, publishedAt])` + `@@index([reservationId])`; migration SQL line 28: `CHECK ("rating" >= 1 AND "rating" <= 5)` |
| 2 | `Reservation` has `reviewInviteSentAt DateTime?` + `reviewTokenJtiUsed String? @unique` | VERIFIED | `schema.prisma` lines 232-233; migration SQL lines 5-9 confirm ALTER TABLE + unique index |
| 3 | Post-checkout cron calls `sendPendingReviewInvites` fire-and-forget; stamp only on confirmed delivery | VERIFIED | `night-audit.service.ts` lines 81-86: `await this.reviewsService.sendPendingReviewInvites(bd).catch(...)` — fire-and-forget pattern; `reviews.service.ts` lines 350-353: stamp AFTER `sendReviewInvite`, inside per-reservation try/catch |
| 4 | `/review/submit?token=...` public route exists, outside ProtectedRoute, uses `useForceLightTheme` + accessible `StarRatingInput` | VERIFIED | `router.tsx` lines 95-101: route at `'/review/submit'` outside ProtectedRoute; `ReviewSubmitPage.tsx` line 4: `useForceLightTheme()` called; `StarRatingInput.tsx` lines 49-52: `role="radiogroup"`, `aria-label`, roving `tabIndex`, keyboard nav |
| 5 | Staff `/reviews` route inside ProtectedRoute; Sidebar Reseñas nav under Administración with `MessageSquareText` | VERIFIED | `router.tsx` lines 174-176: `path: 'reviews'` inside ProtectedRoute+StaffLayout children; `Sidebar.tsx` lines 19 + 66: `MessageSquareText` imported and nav item `{ to: '/reviews', label: 'Reseñas', icon: MessageSquareText }` with no `roles` restriction |
| 6 | `ReviewsSection.tsx` self-contained with `useReviews()` hook; `data/reviews.ts` deleted; no orphan imports | VERIFIED | `ReviewsSection.tsx` line 4: `import { useReviews } from '../hooks/useReviews'` — zero hardcoded data; `data/index.ts` confirms reviews re-export removed; `ls apps/web/src/features/public-portal/data/` shows only `hotel.ts` + `index.ts`; rg `from.*data/reviews` → 0 matches |
| 7 | Rate limit: `@Throttle({ 'reviews-submit': { limit: 5, ttl: 3_600_000 } })` on POST endpoint; dedicated throttler in `ReviewsModule` | VERIFIED | `reviews-public.controller.ts` line 39: exact decorator present; `reviews.module.ts` lines 35-37: `ThrottlerModule.forRoot([{ name: 'reviews-submit', ttl: 3_600_000, limit: 5 }])` |

**Score:** 7/7 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/prisma/schema.prisma` | Review model + Reservation columns | VERIFIED | Lines 570-588; all 10 Review fields present |
| `apps/api/prisma/migrations/20260518170000_phase14_public_reviews_schema/migration.sql` | reviews table + ALTER TABLE + CHECK constraint | VERIFIED | 38 lines; CHECK constraint on line 28; both indexes; FK with SetNull |
| `apps/api/src/modules/reviews/reviews.service.ts` | 6+ methods incl. sendPendingReviewInvites | VERIFIED | 365 lines; 7 methods: signReviewToken, validateToken, submitReview, getPublicReviews, getAdminReviews, moderateReview, sendPendingReviewInvites |
| `apps/api/src/modules/reviews/reviews-public.controller.ts` | 3 public endpoints + ThrottlerGuard + Throttle | VERIFIED | POST reviews (rate-limited), GET validate-token, GET reviews with Cache-Control header |
| `apps/api/src/modules/reviews/reviews-admin.controller.ts` | 2 staff endpoints + JwtAuthGuard + RolesGuard | VERIFIED | GET queue + PATCH :id/moderate; both guards applied at controller level |
| `apps/api/src/modules/reviews/reviews.module.ts` | Dedicated throttler + JwtModule + EmailModule + SystemConfigModule + export ReviewsService | VERIFIED | All 5 imports present; ReviewsService exported for NightAuditModule injection |
| `apps/api/src/modules/email/email.service.ts` | sendReviewInvite re-throws on failure | VERIFIED | Lines 75-90: sendReviewInvite explicitly re-throws (line 88: `throw err`) unlike sendBookingConfirmation which swallows |
| `apps/api/src/modules/night-audit/night-audit.service.ts` | ReviewsService injected; sendPendingReviewInvites called after audit | VERIFIED | Line 12 import; line 58 constructor injection; lines 81-86 fire-and-forget call |
| `apps/web/src/router.tsx` | /review/submit outside ProtectedRoute; /reviews inside ProtectedRoute | VERIFIED | Lines 95-101 (public); lines 174-176 (protected+staff layout) |
| `apps/web/src/features/review-submit/ReviewSubmitPage.tsx` | 6-state page machine + useForceLightTheme | VERIFIED | 147 lines; 6 states: no-token, loading, error, already-used, form, success |
| `apps/web/src/features/review-submit/components/StarRatingInput.tsx` | role=radiogroup + aria-label + roving tabIndex + keyboard nav | VERIFIED | Lines 49-84; all 4 a11y requirements present |
| `apps/web/src/features/reviews-admin/ReviewsModeratorPage.tsx` | 3 tabs + hand-rolled TabButton + no inline role gate | VERIFIED | Lines 1-114; 3 tabs (pending/published/rejected); TabButton component; no @Roles restriction inline |
| `apps/web/src/features/public-portal/components/ReviewsSection.tsx` | Self-contained + useReviews + keepPreviousData + aggregated rating from server | VERIFIED | Line 4 useReviews import; line 62 query inside component; line 81 `averageRating` from server response |
| `apps/web/src/features/public-portal/hooks/useReviews.ts` | TanStack Query + keepPreviousData + staleTime 60s | VERIFIED | Lines 27-33; `placeholderData: keepPreviousData`; `staleTime: 60_000` |
| `apps/web/src/components/layout/Sidebar.tsx` | MessageSquareText icon + Reseñas nav item under Administración | VERIFIED | Line 19: import; line 66: nav item with no roles restriction |
| `apps/web/src/features/public-portal/data/reviews.ts` | DELETED | VERIFIED | File absent; `ls data/` shows only hotel.ts + index.ts |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `NightAuditService.scheduledNightAudit` | `ReviewsService.sendPendingReviewInvites` | Constructor injection + await | WIRED | `night-audit.service.ts` lines 53-58 (DI) + lines 83-85 (call) |
| `ReviewsService.sendPendingReviewInvites` | `EmailService.sendReviewInvite` | `await this.emailService.sendReviewInvite(...)` | WIRED | `reviews.service.ts` lines 342-348 |
| `EmailService.sendReviewInvite` | Resend API | `this.resend.emails.send(...)` | WIRED | `email.service.ts` lines 76-88 |
| `ReviewSubmitPage` | `GET /api/public/reviews/validate-token` | `useReviewToken` hook | WIRED | `ReviewSubmitPage.tsx` line 36; `hooks/useReviewToken.ts` calls validate-token endpoint |
| `ReviewSubmitPage` | `POST /api/public/reviews` | `useSubmitReview` mutation | WIRED | `ReviewSubmitPage.tsx` line 37 + lines 43-45 |
| `ReviewsSection` | `GET /api/public/reviews` | `useReviews` → `publicPortalApi.fetchPublicReviews` | WIRED | `ReviewsSection.tsx` line 4 + `useReviews.ts` line 29 + `public-portal.api.ts` (fetchPublicReviews added per closeout) |
| `ReviewsModeratorPage` | `GET /api/reviews` | `useAdminReviews` hook | WIRED | `ReviewsModeratorPage.tsx` line 3 + line 21 |
| `ModerationButtons` | `PATCH /api/reviews/:id/moderate` | `useModerateReview` mutation | WIRED | Per closeout: `ModerationButtons.tsx` + `useModerateReview.ts` |
| `useModerateReview.onSuccess` | Cross-cache invalidation | Invalidates `['admin','reviews']` + `['public','reviews']` | WIRED | Per closeout + engram: cross-cache invalidation implemented |
| `router.tsx /review/submit` | `ReviewSubmitPage` (default export) | Named import | WIRED | `router.tsx` line 214 import + line 100 element |
| `router.tsx /reviews` | `ReviewsModeratorPage` (default export) | Named import | WIRED | `router.tsx` line 216 import + line 175 element |

---

### Requirements Coverage

| Requirement | Plan(s) | Description | Status | Evidence |
|-------------|---------|-------------|--------|----------|
| REV-01 | 14-01 | reviews table + CHECK constraint + index | SATISFIED | Migration SQL lines 11-34; schema.prisma lines 572-588 |
| REV-02 | 14-01 | POST submit + single-use JWT + 5/IP/hour | SATISFIED | Controller line 39 `@Throttle`; service `submitReview` P2002 catch; DTO min(1).max(5) for rating |
| REV-03 | 14-01 | GET /api/public/reviews paginated | SATISFIED | `getPublicReviews` returns `{reviews, total, averageRating, pages}` with proper `where` filter |
| REV-04 | 14-01 + 14-05 | PATCH /api/reviews/:id/moderate | SATISFIED | `reviews-admin.controller.ts` lines 44-54; `moderateReview` sets publishedAt/rejectedAt |
| REV-05 | 14-04 | ReviewsSection real API + hardcoded data deleted | SATISFIED | `ReviewsSection.tsx` uses `useReviews()`; `data/reviews.ts` absent |
| REV-06 | 14-05 | Staff /reviews (any staff role) + 3 tabs + Sidebar nav | SATISFIED | No inline role gate; Sidebar nav item without roles restriction |
| REV-07 | 14-02 | Night-audit cron sends review-invite via Resend | SATISFIED | `night-audit.service.ts` fire-and-forget call; `sendReviewInvite` re-throws correctly |
| REV-08 | 14-03 | /review/submit public form | SATISFIED | Route outside ProtectedRoute; `ReviewSubmitPage` standalone; `useForceLightTheme` |

**Coverage: 8/8 REV-IDs satisfied (code level)**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `review-submit/**/*.tsx` | — | Hex colors | None | rg scan: 0 matches |
| `reviews-admin/**/*.tsx` | — | Hex colors | None | rg scan: 0 matches |
| `review-submit/**/*.tsx` | — | Tailwind raw color utilities | None | rg scan: 0 matches |
| `reviews-admin/**/*.tsx` | — | Tailwind raw color utilities | None | rg scan: 0 matches |
| `reviews.service.ts` | 39 | `any[]` on interface return types | INFO | `AdminReviewsResult.pending/published/rejected: any[]`; minor type safety issue, no functional impact |
| `reviews-admin.controller.ts` | 52 | `Promise<any>` return type on moderate | INFO | Non-blocking; typed return from service |
| `14-MANUAL-QA-CHECKLIST.md` | — | All 8 scenarios marked [ ] unchecked | INFO | Human sign-off pending — expected state at phase close |

**No BLOCKER or WARNING anti-patterns found.**

---

### Note: Empty Migration Placeholder

A known deviation documented in `14-CLOSEOUT.md`: migration `20260518164531_phase14_public_reviews` is an empty placeholder due to Railway P1001 connectivity issue during Phase 14-01. The real migration is `20260518170000_phase14_public_reviews_schema` which contains all DDL. This is a carry-forward infrastructure item — `prisma migrate deploy` must be run against Railway when DB connectivity is restored.

---

### Human Verification Required

#### 1. Valid token flow + successful review submission

**Test:** Create a CHECKED_OUT reservation, sign a JWT via `ReviewsService.signReviewToken`, visit `/review/submit?token=...`, select 4 stars, enter comment ≥10 chars, submit.
**Expected:** Success state "¡Gracias por tu reseña!"; DB row with `moderated=false`, `publishedAt=null`; `reviewTokenJtiUsed` stamped on reservation.
**Why human:** Requires live DB + browser interaction with the 6-state page machine.

#### 2. Invalid / tampered token

**Test:** Visit `/review/submit?token=eyBOGUS.PAYLOAD.SIG`
**Expected:** Error state renders with "Este enlace ya no es válido o ha expirado"; no form rendered; API returns 401.
**Why human:** Requires live NestJS instance to confirm JWT verification path.

#### 3. Token replay 410

**Test:** Re-submit with an already-used token (same JTI as a previously submitted review).
**Expected:** UI shows "Este enlace ya fue utilizado"; direct POST returns 410 Gone; no duplicate review row in DB.
**Why human:** Requires DB with unique constraint on `reviewTokenJtiUsed` active and a real reservation row.

#### 4. Rate limit 429 (5 submissions per IP per hour)

**Test:** Send 6 POST requests to `/api/public/reviews` within 1 minute using 6 distinct valid tokens.
**Expected:** First 5 return 201; 6th returns 429 from `reviews-submit` throttler (not the global one).
**Why human:** Requires a running NestJS instance with the dedicated `reviews-submit` ThrottlerModule active.

#### 5. Staff moderation flow (RECEPTION role)

**Test:** Log in as RECEPTION user, navigate to `/reviews`, approve a pending review.
**Expected:** Page loads without 403; 3 tabs render; approve action moves review to Publicadas; DB `moderated=true + publishedAt` not null.
**Why human:** Requires authenticated staff session and live mutation against DB.

#### 6. Portal cross-cache invalidation

**Test:** Immediately after approving a review, visit `/booking` Reseñas section.
**Expected:** Approved review appears; `averageRating` and count are live values (not 4.84/318 from old hardcoded data); skeleton renders on first load.
**Why human:** Real-time behavior after TanStack Query cache invalidation; requires browser observation.

#### 7. Night-audit cron end-to-end (email pipeline)

**Test:** Insert CHECKED_OUT reservation with `reviewInviteSentAt=null`; trigger night-audit backfill; check Resend dashboard.
**Expected:** Email delivered with subject "Cuéntanos sobre tu estadía en [hotel name]"; `reviewInviteSentAt` stamped; second trigger skips (idempotent).
**Why human:** Requires Resend API key + Railway DB access; cannot mock real email delivery.

#### 8. DB migration on Railway (infrastructure)

**Test:** `cd apps/api && pnpm prisma migrate deploy`
**Expected:** `prisma migrate status` shows `20260518170000_phase14_public_reviews_schema` as Applied.
**Why human:** Railway P1001 connectivity was intermittent during Phase 14-01; migration SQL is correct but deployment requires human to confirm Railway DB is reachable.

---

### Gaps Summary

No gaps found at the automated code-verification level. All 7 success criteria from ROADMAP.md are satisfied by the actual codebase. The 8 human-verification items are runtime and infrastructure concerns that cannot be validated without a live database and browser session — they are not implementation defects.

**One pending infrastructure item** (not a code gap): the `20260518170000_phase14_public_reviews_schema` migration must be applied to the Railway PostgreSQL instance before the reviews cron will function in production. The SQL is correct; this is a deployment step.

---

_Verified: 2026-05-18_
_Verifier: Claude (gsd-verifier)_
