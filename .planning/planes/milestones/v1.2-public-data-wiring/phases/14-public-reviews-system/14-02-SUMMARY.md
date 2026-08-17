---
phase: 14-public-reviews-system
plan: "02"
subsystem: backend
tags: [reviews, email, night-audit, cron, resend, jwt, tdd]
dependency_graph:
  requires:
    - apps/api/src/modules/reviews/reviews.service.ts (Plan 14-01 — signReviewToken, stub)
    - apps/api/src/modules/email/email.service.ts (sendBookingConfirmation pattern)
    - apps/api/src/modules/night-audit/night-audit.service.ts (scheduledNightAudit extension point)
    - apps/api/src/system-config/system-config.service.ts (getHotelName)
    - apps/api/prisma/schema.prisma (Reservation.reviewInviteSentAt added in 14-01)
  provides:
    - EmailService.sendReviewInvite (re-throws on Resend failure — inverse of sendBookingConfirmation)
    - EmailService.buildReviewInviteHtml (warm palette, Instrument Serif heading, terracotta CTA)
    - ReviewInviteParams (exported interface)
    - ReviewsService.sendPendingReviewInvites (full implementation, sequential loop, per-reservation catch)
    - NightAuditService.scheduledNightAudit (extended with fire-and-forget review invite batch)
  affects:
    - apps/api/src/modules/reviews/reviews.module.ts (imports EmailModule + SystemConfigModule)
    - apps/api/src/modules/night-audit/night-audit.module.ts (imports ReviewsModule)
    - apps/api/.env.example (REVIEW_TOKEN_SECRET + FRONTEND_BASE_URL documented)
tech_stack:
  added:
    - date-fns/subDays (already installed — used for yesterday computation)
  patterns:
    - sendReviewInvite re-throws (vs sendBookingConfirmation swallows) — semantic difference tested
    - sequential for-loop with per-iteration try/catch for batch resilience
    - fire-and-forget .catch() at scheduledNightAudit level — review failure cannot block cron
    - reviewInviteSentAt stamped ONLY after confirmed Resend response (P1 pitfall avoidance)
key_files:
  created:
    - apps/api/.env.example (new file — REVIEW_TOKEN_SECRET + FRONTEND_BASE_URL)
  modified:
    - apps/api/src/modules/email/email.service.ts (ReviewInviteParams + sendReviewInvite + buildReviewInviteHtml)
    - apps/api/src/modules/email/email.service.spec.ts (6 new tests for sendReviewInvite)
    - apps/api/src/modules/reviews/reviews.service.ts (stub replaced with full implementation + EmailService + SystemConfigService injected)
    - apps/api/src/modules/reviews/reviews.service.spec.ts (6 new tests for sendPendingReviewInvites)
    - apps/api/src/modules/reviews/reviews.module.ts (EmailModule + SystemConfigModule imported)
    - apps/api/src/modules/night-audit/night-audit.service.ts (ReviewsService injected, scheduledNightAudit extended)
    - apps/api/src/modules/night-audit/night-audit.service.spec.ts (ReviewsService mock added, 2 new Phase14 tests)
    - apps/api/src/modules/night-audit/night-audit.module.ts (ReviewsModule imported)
decisions:
  - key: sendReviewInvite re-throws
    rationale: "Unlike sendBookingConfirmation (fire-and-forget, no re-throw), sendReviewInvite must re-throw so the cron loop skips updating reviewInviteSentAt. Stamp only on confirmed delivery — next cron run will retry failed reservations."
  - key: sequential loop over Promise.all
    rationale: "Single-tenant hotel has low CHECKED_OUT volume per night (<20 reservations). Sequential processing is simpler to reason about for partial failures and avoids rate-limiting Resend with burst sends."
  - key: fire-and-forget catch at scheduledNightAudit level
    rationale: "Review invites are non-critical to the accounting day cycle. A Resend outage must not mark the night audit as FAILED or prevent business date advancement."
  - key: SystemConfigModule imported explicitly
    rationale: "SystemConfigModule is not @Global. Added to ReviewsModule.imports alongside EmailModule. NightAuditModule already had SystemConfigModule — no duplication."
  - key: FRONTEND_BASE_URL default fallback
    rationale: "Falls back to http://localhost:5173 if env var unset to prevent NPE in development. Production Railway deployment must set FRONTEND_BASE_URL."
metrics:
  duration: "~30m"
  completed: "2026-05-18"
  tasks_completed: 2
  tests_added: 14
  tests_total_in_scope: 47
  files_modified: 8
  files_created: 1
---

# Phase 14 Plan 02: Night-audit cron extension + review-invite email (REV-07) Summary

REV-07 closed: post-checkout email pipeline fully functional. After night audit completes, CHECKED_OUT guests from yesterday receive a personalized review-invite email with a 90-day JWT single-use link.

## What Was Built

### EmailService (email.service.ts)

New exported interface `ReviewInviteParams` and method `sendReviewInvite()`:

```typescript
async sendReviewInvite(params: ReviewInviteParams): Promise<void>
// Re-throws on Resend failure — opposite of sendBookingConfirmation
```

Private `buildReviewInviteHtml()` generates inline HTML email:
- Heading: `¡Gracias por tu visita!` in Instrument Serif font, dark `#2a221a` background
- Body: guest name + hotel name + formatted stay date (es-CO locale)
- CTA button: terracotta `#c4623f` → `reviewLink`
- Footer: "Este enlace expira en 90 días"

### ReviewsService (reviews.service.ts)

Full implementation replacing the Plan 14-01 stub:

```typescript
async sendPendingReviewInvites(businessDate: Date): Promise<void>
```

Logic:
1. Query `reservation.findMany` — `CHECKED_OUT + checkOutDate=yesterday + reviewInviteSentAt=null + guest.email NOT NULL`
2. For each: `signReviewToken()` → compose `reviewLink` → `emailService.sendReviewInvite()`
3. On Resend success: `prisma.reservation.update({ reviewInviteSentAt: new Date() })`
4. On Resend failure: catch + log, continue to next reservation

New constructor dependencies injected: `EmailService`, `SystemConfigService`.

### NightAuditService (night-audit.service.ts)

`scheduledNightAudit()` extended after `detectAndAlertSkippedDays(bd)`:

```typescript
await this.reviewsService.sendPendingReviewInvites(bd).catch((err) => {
  this.logger.error('Review invite batch failed (non-critical)', err);
});
```

The `.catch()` at this level prevents review invite failures from propagating and blocking cron completion.

### Module wiring

- **ReviewsModule** now imports `EmailModule` + `SystemConfigModule`
- **NightAuditModule** now imports `ReviewsModule` (one-way, no circular dependency)
- Dependency graph: `NightAuditModule → ReviewsModule → EmailModule + SystemConfigModule`

### .env.example

Added at end of existing file:
```
REVIEW_TOKEN_SECRET=  # Falls back to JWT_ACCESS_SECRET if unset
FRONTEND_BASE_URL=http://localhost:5173  # Production: set to real frontend URL
```

## Test Coverage Delta

| File | Before | After | New tests |
|------|--------|-------|-----------|
| email.service.spec.ts | 3 | 9 | +6 (sendReviewInvite — success, re-throw, subject, href, content, palette) |
| reviews.service.spec.ts | 11 | 17 | +6 (sendPendingReviewInvites — query shape, happy path, stamp ordering, partial failure, empty, reviewLink) |
| night-audit.service.spec.ts | 19 | 21 | +2 (scheduledNightAudit calls order, error non-propagation) |
| **Total** | **33** | **47** | **+14** |

All 47 tests pass. Zero regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `jest.Mocked` usage in vitest context**
- **Found during:** Task 2 (TypeScript check after implementing `sendPendingReviewInvites`)
- **Issue:** `jest.Mocked<Pick<EmailService, ...>>` type is not available in vitest — `global.jest` namespace has no `Mocked` export
- **Fix:** Removed typed import and used plain `ReturnType` inference from builder functions (`buildMockEmailService()` and `buildMockSystemConfig()` infer their types automatically)
- **Files modified:** `reviews.service.spec.ts`
- **Commit:** 7dc5a44

**2. [Rule 1 - Bug] Updated existing tests to match new 4-argument constructor signature**
- **Found during:** Task 2 (`tsc --noEmit` revealed 10 existing tests still calling `new ReviewsService(prisma, jwt)`)
- **Issue:** Injecting `EmailService` and `SystemConfigService` into `ReviewsService` constructor changed the arity from 2 to 4 — existing direct-instantiation tests were passing only 2 arguments
- **Fix:** Applied `buildMockEmailService()` and `buildMockSystemConfig()` as 3rd and 4th arguments in all 10 affected test sites
- **Files modified:** `reviews.service.spec.ts`
- **Commit:** 7dc5a44

## Self-Check

### Files verified:
- [x] `apps/api/src/modules/email/email.service.ts` — FOUND (sendReviewInvite + buildReviewInviteHtml)
- [x] `apps/api/src/modules/reviews/reviews.service.ts` — FOUND (sendPendingReviewInvites full impl)
- [x] `apps/api/src/modules/night-audit/night-audit.service.ts` — FOUND (reviewsService injected, scheduledNightAudit extended)
- [x] `apps/api/src/modules/reviews/reviews.module.ts` — FOUND (EmailModule + SystemConfigModule imported)
- [x] `apps/api/src/modules/night-audit/night-audit.module.ts` — FOUND (ReviewsModule imported)
- [x] `apps/api/.env.example` — FOUND (REVIEW_TOKEN_SECRET + FRONTEND_BASE_URL added)

### Commits verified:
- [x] deb4d97 — feat(14-02): EmailService.sendReviewInvite + buildReviewInviteHtml
- [x] 7dc5a44 — feat(14-02): sendPendingReviewInvites full impl + NightAuditService cron extension

### Verification results:
- `npx tsc --noEmit` — exit 0
- `npx vitest run src/modules/reviews/ src/modules/email/ src/modules/night-audit/` — 47 passed

## Self-Check: PASSED
