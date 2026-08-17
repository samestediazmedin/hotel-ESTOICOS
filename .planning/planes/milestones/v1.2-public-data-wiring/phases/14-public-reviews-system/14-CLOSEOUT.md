# Phase 14 Closeout — Public Reviews System

**Closed:** 2026-05-18
**Status:** Complete — pending manual QA sign-off (see `14-MANUAL-QA-CHECKLIST.md`)
**Duration:** All 6 plans executed 2026-05-18
**Plans:** 14-01 · 14-02 · 14-03 · 14-04 · 14-05 · 14-06

---

## Phase Summary

Phase 14 delivers the Public Reviews System for HotelOS AI v1.2 — the last phase of the milestone. It provides a full vertical slice from post-checkout email invite to guest submission to staff moderation to public portal display. The system uses single-use JWT tokens stored in the `Reservation` table for atomic replay protection; all review moderation goes through a dedicated staff route accessible to every staff role (not just ADMIN); published reviews are served from the real DB via a paginated endpoint with server-side average rating, replacing the hardcoded `data/reviews.ts` that was introduced in v1.1.

---

## REV-IDs Closed

| REQ-ID | Description | Plan | Status | Verification |
|--------|-------------|------|--------|--------------|
| REV-01 | `reviews` Prisma table + migration + CHECK constraint + index | 14-01 | Done 2026-05-18 | tsc exit 0 + 11 unit tests pass |
| REV-02 | POST /api/public/reviews with single-use JWT token + 5/IP/hour rate limit | 14-01 | Done 2026-05-18 | 17 unit tests (reviews.service.spec.ts) |
| REV-03 | GET /api/public/reviews paginated, published only | 14-01 | Done 2026-05-18 | Unit tests cover pagination + averageRating |
| REV-04 | PATCH /api/reviews/:id/moderate (any staff) + publishedAt | 14-01 · 14-05 | Done 2026-05-18 | Unit test moderateReview approve + reject |
| REV-05 | ReviewsSection consumes real API, hardcoded data deleted | 14-04 | Done 2026-05-18 | 11 frontend tests pass + data/reviews.ts absent |
| REV-06 | Staff /reviews page (any staff role) + 3 tabs + Sidebar nav | 14-05 | Done 2026-05-18 | tsc exit 0; Sidebar.tsx has Reseñas nav item |
| REV-07 | Night-audit cron sends review-invite email via Resend | 14-02 | Done 2026-05-18 | 21 night-audit.service.spec.ts tests + 9 email.service.spec.ts tests |
| REV-08 | /review/submit?token=... public page with star form | 14-03 | Done 2026-05-18 | tsc exit 0; router.tsx has public route |

---

## Files Inventory

### Created (across all 6 plans)

| File | Plan | Purpose |
|------|------|---------|
| `apps/api/prisma/migrations/20260518164531_phase14_public_reviews/migration.sql` | 14-01 | Empty placeholder (Railway P1001 workaround) |
| `apps/api/prisma/migrations/20260518170000_phase14_public_reviews_schema/migration.sql` | 14-01 | Actual migration: reviews table + Reservation columns |
| `apps/api/src/modules/reviews/reviews.module.ts` | 14-01 | ReviewsModule with dedicated throttler + JwtModule |
| `apps/api/src/modules/reviews/reviews.service.ts` | 14-01 + 14-02 | 7 methods: signToken, validate, submit, getPublic, getAdmin, moderate, sendInvites |
| `apps/api/src/modules/reviews/reviews-public.controller.ts` | 14-01 | 3 public endpoints (POST submit + GET validate-token + GET list) |
| `apps/api/src/modules/reviews/reviews-admin.controller.ts` | 14-01 | 2 staff endpoints (GET admin list + PATCH moderate) |
| `apps/api/src/modules/reviews/reviews.service.spec.ts` | 14-01 + 14-02 | 17 unit tests |
| `apps/api/src/modules/reviews/dto/submit-review.dto.ts` | 14-01 | Zod DTO |
| `apps/api/src/modules/reviews/dto/moderate-review.dto.ts` | 14-01 | Zod DTO |
| `apps/api/src/modules/reviews/dto/public-reviews-query.dto.ts` | 14-01 | Zod DTO |
| `apps/api/.env.example` | 14-02 | REVIEW_TOKEN_SECRET + FRONTEND_BASE_URL documented |
| `apps/web/src/features/review-submit/ReviewSubmitPage.tsx` | 14-03 | Standalone public page (6 states) |
| `apps/web/src/features/review-submit/review-submit.api.ts` | 14-03 | Fresh axios instance (no auth interceptor) |
| `apps/web/src/features/review-submit/hooks/useReviewToken.ts` | 14-03 | TanStack Query validate-token |
| `apps/web/src/features/review-submit/hooks/useSubmitReview.ts` | 14-03 | useMutation POST submit |
| `apps/web/src/features/review-submit/components/StarRatingInput.tsx` | 14-03 | Accessible radiogroup + roving tabIndex |
| `apps/web/src/features/review-submit/components/ReviewForm.tsx` | 14-03 | react-hook-form + zodResolver |
| `apps/web/src/features/public-portal/hooks/useReviews.ts` | 14-04 | TanStack Query GET /public/reviews |
| `apps/web/src/features/reviews-admin/ReviewsModeratorPage.tsx` | 14-05 | Staff 3-tab moderation page |
| `apps/web/src/features/reviews-admin/reviews-admin.api.ts` | 14-05 | Authenticated axios (fetchAdminReviews + moderateReview) |
| `apps/web/src/features/reviews-admin/hooks/useAdminReviews.ts` | 14-05 | TanStack Query admin list |
| `apps/web/src/features/reviews-admin/hooks/useModerateReview.ts` | 14-05 | useMutation + cross-cache invalidation |
| `apps/web/src/features/reviews-admin/components/ReviewQueueTable.tsx` | 14-05 | Table primitive + showActions |
| `apps/web/src/features/reviews-admin/components/ModerationButtons.tsx` | 14-05 | Aprobar/Rechazar buttons |
| `.planning/phases/14-public-reviews-system/14-MANUAL-QA-CHECKLIST.md` | 14-06 | 8-scenario manual QA checklist |
| `.planning/phases/14-public-reviews-system/14-CLOSEOUT.md` | 14-06 | This file |
| `.planning/phases/14-public-reviews-system/V1.2-MILESTONE-CLOSEOUT.md` | 14-06 | v1.2 milestone wrap-up |

### Modified (across all 6 plans)

| File | Plan | Change |
|------|------|--------|
| `apps/api/prisma/schema.prisma` | 14-01 | Review model + Reservation.reviewInviteSentAt + Reservation.reviewTokenJtiUsed |
| `apps/api/src/app.module.ts` | 14-01 | ReviewsModule registered |
| `apps/api/src/generated/prisma/` | 14-01 | Regenerated with Review types |
| `apps/api/src/modules/email/email.service.ts` | 14-02 | ReviewInviteParams + sendReviewInvite + buildReviewInviteHtml |
| `apps/api/src/modules/email/email.service.spec.ts` | 14-02 | +6 tests (sendReviewInvite) |
| `apps/api/src/modules/night-audit/night-audit.service.ts` | 14-02 | ReviewsService injected + cron extended |
| `apps/api/src/modules/night-audit/night-audit.service.spec.ts` | 14-02 | +2 tests (Phase14 cron) |
| `apps/api/src/modules/night-audit/night-audit.module.ts` | 14-02 | ReviewsModule imported |
| `apps/api/src/modules/reviews/reviews.module.ts` | 14-02 | EmailModule + SystemConfigModule imported |
| `apps/web/src/router.tsx` | 14-03 + 14-05 | /review/submit public route + /reviews staff route |
| `apps/web/src/features/public-portal/components/ReviewsSection.tsx` | 14-04 | Rewritten self-contained + keepPreviousData |
| `apps/web/src/features/public-portal/components/skeletons.tsx` | 14-04 | ReviewsSectionSkeleton added |
| `apps/web/src/features/public-portal/public-portal.api.ts` | 14-04 | fetchPublicReviews added |
| `apps/web/src/features/public-portal/types.ts` | 14-04 | ApiReview + PublicReviewsResponse |
| `apps/web/src/features/public-portal/HotelHomePage.tsx` | 14-04 | REVIEWS import removed; ReviewsSection prop-less |
| `apps/web/src/features/public-portal/data/index.ts` | 14-04 | reviews re-export removed |
| `apps/web/src/components/layout/Sidebar.tsx` | 14-05 | MessageSquareText + Reseñas nav item |

### Deleted

| File | Plan | Reason |
|------|------|--------|
| `apps/web/src/features/public-portal/data/reviews.ts` | 14-04 | Replaced by real API (REV-05) |

---

## Key Decisions

| Decision | Rationale | Plan |
|----------|-----------|------|
| Dedicated `reviews-submit` throttler (5/IP/3600s) inside ReviewsModule | Avoids TTL collision with global `short` (60s) and `long` (3600s/100) throttlers | 14-01 |
| P2002 Prisma unique catch on `Reservation.reviewTokenJtiUsed` → 410 GoneException | DB-level atomic token replay protection without application-level locking | 14-01 |
| GET /public/reviews/validate-token registered before GET /public/reviews | NestJS route ambiguity pitfall — specific path before wildcard catch-all | 14-01 |
| `sendReviewInvite` re-throws on Resend failure (vs `sendBookingConfirmation` swallows) | Must not stamp `reviewInviteSentAt` on failed delivery — retry on next cron run | 14-02 |
| Fire-and-forget review invite batch at `scheduledNightAudit` level | Resend outage cannot block accounting day cycle | 14-02 |
| Fresh `axios.create()` for public review API | Shared `api` instance has auth interceptors incompatible with one-time review tokens | 14-03 |
| HTTP error mapping at `ReviewSubmitPage` level (not `ReviewForm`) | Page owns the token and maps 401/410/429 semantics; form is presentation-only | 14-03 |
| `ReviewsSection` self-contained (query inside component, zero props) | Eliminates prop drilling from HotelHomePage; keeps component encapsulated | 14-04 |
| `keepPreviousData` for reviews pagination | No meaningful static fallback for page 2+; prevents flash between pages | 14-04 |
| No inline role gate on `ReviewsModeratorPage` | REV-06 requires any staff; backend RolesGuard (empty @Roles()) is sole enforcement | 14-05 |
| Cross-cache invalidation on `useModerateReview.onSuccess` | Invalidates both `['admin','reviews']` AND `['public','reviews']` — portal reflects approval without 60s CDN wait | 14-05 |
| Hand-rolled `TabButton` over shadcn Tabs | `tabs.tsx` not present in components/ui/; 3-line pattern is cleaner than importing a library | 14-05 |
| Migration written manually (Railway P1001 intermittent) | SQL verified correct; `prisma migrate deploy` applies when DB available | 14-01 |

---

## Deviations from Plan

### Auto-fixed Issues (Rules 1-3)

**1. [Rule 1 - Bug] `jest.Mocked` usage in Vitest context (Plan 14-02)**
- **Found during:** Task 2 (TypeScript check after implementing `sendPendingReviewInvites`)
- **Issue:** `jest.Mocked<Pick<EmailService, ...>>` type not available in Vitest — `global.jest` namespace has no `Mocked` export
- **Fix:** Removed typed import; used plain `ReturnType` inference from builder functions
- **Commit:** `7dc5a44`

**2. [Rule 1 - Bug] Existing tests called 2-arg ReviewsService constructor after 14-02 added 2 more deps (Plan 14-02)**
- **Found during:** Task 2 (`tsc --noEmit` revealed 10 existing tests broken)
- **Issue:** `EmailService` + `SystemConfigService` injection changed constructor arity from 2 to 4
- **Fix:** Applied `buildMockEmailService()` and `buildMockSystemConfig()` in all 10 affected sites
- **Commit:** `7dc5a44`

**3. [Rule 3 - Blocking] Railway DB P1001 during Plan 14-01**
- **Found during:** Task 1 (Prisma migrate dev)
- **Issue:** `trolley.proxy.rlwy.net:43509` intermittently unreachable; empty migration applied before disconnect
- **Fix:** Preserved empty migration file; wrote migration SQL manually; ran `prisma generate` offline
- **Impact:** Migration must be applied with `prisma migrate deploy` when Railway DB is reachable
- **Commit:** `5a1632e`

**4. [Rule 2 - Minor] Minor TypeScript strictness improvement in ReviewSubmitPage (Plan 14-03)**
- **Found during:** Task 2 (TypeScript review)
- **Issue:** Plan suggested `err: any` in catch block; used `err: unknown` instead with explicit cast
- **Impact:** No functional change; tighter types

---

## Regression Gate Results (2026-05-18)

| Check | Result | Details |
|-------|--------|---------|
| `apps/api tsc --noEmit` | PASS | Exit 0, no type errors |
| `apps/api vitest run` | PASS | 47 files, 386 tests, 0 failures |
| `apps/web tsc --noEmit` | PASS | Exit 0, no type errors |
| `apps/web vitest run` | PASS | 14 files, 116 tests, 0 failures |
| Zero hex in `review-submit/` | PASS | 0 matches |
| Zero hex in `reviews-admin/` | PASS | 0 matches |
| `data/reviews.ts` absent | PASS | File deleted (Plan 14-04) |
| Orphan `from.*data/reviews` imports | PASS | 0 matches |

**Baseline comparison:**
- Backend before Phase 14: 33 tests → after Phase 14: 386 tests (+353, includes all accumulated phases)
- Frontend before Phase 14: 105 tests → after Phase 14: 116 tests (+11 new from Phase 14 portal tests)

**Note:** Backend console output during `vitest run` shows expected error-level logs from intentional failure-path tests (Resend mock throwing, DB connection lost in checkout listener). These are **intentional test scenarios**, not real failures. All 386 tests pass.

---

## Manual QA Results

Manual QA checklist: `.planning/phases/14-public-reviews-system/14-MANUAL-QA-CHECKLIST.md`

8 scenarios covering REV-01..08 — to be performed by user after regression gate passes.

**Status:** [ ] All 8 PASS (pending user sign-off)

---

## Known Gaps / Carry-Forward to v1.3+

| Item | Reason Deferred | Priority |
|------|-----------------|----------|
| Photo attachments in reviews | Schema and form change not in REV scope | Medium |
| Multi-language reviews (ES/EN) | i18n infrastructure not built yet | Low |
| Review responses by hotel staff | New endpoint + UI thread needed | Medium |
| Spam / fake-review detection | ML inference or rule engine — v2 feature | Low |
| Auto-publish reviews ≥4 stars | Business rule — hotel owner decision | Low |
| Guest editing a submitted review | Token re-use policy change required | Low |
| Email A/B testing | Marketing feature — v1.3+ | Low |
| DB migration applied to Railway | Requires DB connectivity; apply with `prisma migrate deploy` | Blocking for prod |
| Orphan R2 delete on guest account anonymization | Best-effort pattern established in Phase 13 | Low |

---

## Summary Commits (Phase 14)

| Commit | Plan | Description |
|--------|------|-------------|
| `5a1632e` | 14-01 | feat(14-01): migration — reviews table + Reservation token columns |
| `9669c28` | 14-01 | feat(14-01): ReviewsModule with 5 endpoints + JWT + dedicated throttler |
| `deb4d97` | 14-02 | feat(14-02): EmailService.sendReviewInvite + buildReviewInviteHtml |
| `7dc5a44` | 14-02 | feat(14-02): sendPendingReviewInvites full impl + NightAuditService cron extension |
| `bb28622` | 14-03 | feat(14-03): API client + useReviewToken + useSubmitReview + StarRatingInput |
| `f47eadd` | 14-03 | feat(14-03): ReviewForm + ReviewSubmitPage + /review/submit public route |
| `112edd4` | 14-04 | refactor(14-04): rewire ReviewsSection to TanStack Query + delete hardcoded reviews data |
| `8e1e944` | 14-05 | feat(14-05): API client + useAdminReviews + useModerateReview + ReviewQueueTable + ModerationButtons |
| `762163e` | 14-05 | feat(14-05): ReviewsModeratorPage + /reviews route + Sidebar Reseñas nav item |
