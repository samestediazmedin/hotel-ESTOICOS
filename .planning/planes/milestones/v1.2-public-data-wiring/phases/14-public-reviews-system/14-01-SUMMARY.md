---
phase: 14-public-reviews-system
plan: "01"
subsystem: backend
tags: [reviews, migration, nestjs, jwt, throttler, prisma]
dependency_graph:
  requires:
    - apps/api/prisma/schema.prisma (Reservation model)
    - apps/api/src/prisma/prisma.module.ts
    - apps/api/src/shared/guards/jwt-auth.guard.ts
    - apps/api/src/shared/guards/roles.guard.ts
  provides:
    - ReviewsModule (reviews.module.ts)
    - ReviewsService (signReviewToken, validateToken, submitReview, getPublicReviews, getAdminReviews, moderateReview, sendPendingReviewInvites-stub)
    - ReviewsPublicController (POST /api/public/reviews, GET /api/public/reviews/validate-token, GET /api/public/reviews)
    - ReviewsAdminController (GET /api/reviews, PATCH /api/reviews/:id/moderate)
  affects:
    - apps/api/src/app.module.ts (ReviewsModule registered)
    - apps/api/prisma/schema.prisma (Review model + Reservation.reviewInviteSentAt + Reservation.reviewTokenJtiUsed)
    - apps/api/src/generated/prisma/ (regenerated with Review types)
tech_stack:
  added:
    - Review Prisma model (reviews table with CHECK constraint rating 1-5)
    - reviews-submit named ThrottlerModule (5/IP/hour, separate from global short/long)
  patterns:
    - JwtModule.register({}) with inline secret per call (identical to AuthModule)
    - P2002 catch → GoneException (token replay protection via DB unique constraint)
    - ThrottlerGuard at controller class + @Throttle override per method (PublicBookingController pattern)
    - RolesGuard with no @Roles() → any authenticated staff (REV-06)
    - Cache-Control header on GET public reviews (60s CDN cache)
key_files:
  created:
    - apps/api/prisma/migrations/20260518170000_phase14_public_reviews_schema/migration.sql (38 lines)
    - apps/api/src/modules/reviews/reviews.module.ts (38 lines)
    - apps/api/src/modules/reviews/reviews.service.ts (311 lines)
    - apps/api/src/modules/reviews/reviews-public.controller.ts (75 lines)
    - apps/api/src/modules/reviews/reviews-admin.controller.ts (55 lines)
    - apps/api/src/modules/reviews/reviews.service.spec.ts (270 lines)
    - apps/api/src/modules/reviews/dto/submit-review.dto.ts (10 lines)
    - apps/api/src/modules/reviews/dto/moderate-review.dto.ts (9 lines)
    - apps/api/src/modules/reviews/dto/public-reviews-query.dto.ts (10 lines)
  modified:
    - apps/api/prisma/schema.prisma (Review model + Reservation columns added)
    - apps/api/src/app.module.ts (ReviewsModule registered)
    - apps/api/src/generated/prisma/ (regenerated — Review types + Reservation columns)
decisions:
  - "Dedicated reviews-submit throttler (3_600_000ms / 5 req) registered inside ReviewsModule, NOT in AppModule global throttler — prevents TTL collision with short (60s) and long (3600s/100) throttlers"
  - "GET /public/reviews/validate-token registered before GET /public/reviews in controller to avoid NestJS route ambiguity (P7 pitfall from RESEARCH)"
  - "P2002 Prisma unique constraint catch on Reservation.reviewTokenJtiUsed → GoneException (410) — atomic token replay protection without application-level locking"
  - "sendPendingReviewInvites() is a stub returning Promise.resolve() — satisfies NightAuditService type contract; full implementation in Plan 14-03"
  - "Migration written manually (Prisma generate failed silently due to Railway connectivity issues) — SQL is correct and matches what prisma migrate would generate; applied via prisma migrate deploy when DB available"
  - "Prisma generate succeeded offline — schema valid, client regenerated with Review types + Reservation columns"
metrics:
  duration_minutes: 55
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_created: 11
  files_modified: 3
---

# Phase 14 Plan 01: ReviewsModule + Migration + 5 Endpoints Summary

One-liner: Prisma migration for reviews table (rating CHECK 1-5, single-use JTI token replay via DB unique) + ReviewsModule with 5 typed endpoints, dedicated throttler, and JWT sign/verify — full Wave 1 backend foundation.

## What Was Built

### Task 1 — Migration + Prisma Schema

Migration file at `apps/api/prisma/migrations/20260518170000_phase14_public_reviews_schema/migration.sql`:
- `CREATE TABLE "reviews"` with id (cuid), guestName, rating (INT), comment (TEXT), stayDate (DATE), reservationId (FK nullable SetNull), moderated, publishedAt, rejectedAt, createdAt
- `ADD CONSTRAINT reviews_rating_check CHECK ("rating" >= 1 AND "rating" <= 5)` — DB-level enforcement
- `CREATE INDEX reviews_moderated_publishedAt_idx` — public query optimization
- `CREATE INDEX reviews_reservationId_idx` — FK lookup
- `ALTER TABLE reservations ADD COLUMN "reviewInviteSentAt"` (nullable)
- `ALTER TABLE reservations ADD COLUMN "reviewTokenJtiUsed"` + `CREATE UNIQUE INDEX` — atomic token replay prevention

Prisma client regenerated with new types (`prisma generate` — no DB connection required).

### Task 2 — ReviewsModule (5 endpoints)

**Endpoint contract:**

| Method | Path | Auth | Response |
|--------|------|------|----------|
| `POST` | `/api/public/reviews` | none (5/IP/hour) | `{id, createdAt}` 201 / 401 invalid token / 410 token used |
| `GET` | `/api/public/reviews/validate-token?token=` | none | `{guestName, stayDate, alreadySubmitted}` / 401 |
| `GET` | `/api/public/reviews?page&limit` | none (Cache-Control: public, max-age=60) | `{reviews[], total, averageRating, pages}` |
| `GET` | `/api/reviews` | JwtAuthGuard + RolesGuard (any staff) | `{pending[], published[], rejected[]}` |
| `PATCH` | `/api/reviews/:id/moderate` | JwtAuthGuard + RolesGuard (any staff) | Updated review row |

**Files created:**
- `reviews.module.ts` — ThrottlerModule.forRoot([{name:'reviews-submit', ttl:3_600_000, limit:5}]) + JwtModule.register({}) + PrismaModule
- `reviews.service.ts` — signReviewToken, validateToken, submitReview (P2002 catch), getPublicReviews (server-side aggregate), getAdminReviews (3 groups), moderateReview, sendPendingReviewInvites (stub)
- `reviews-public.controller.ts` — @Controller('public') + @UseGuards(ThrottlerGuard)
- `reviews-admin.controller.ts` — @Controller('reviews') + @UseGuards(JwtAuthGuard, RolesGuard) — no @Roles() = any staff
- 3 Zod DTOs: submitReviewSchema, moderateReviewSchema, publicReviewsQuerySchema
- `reviews.service.spec.ts` — 11 unit tests (all pass)

**AppModule:** ReviewsModule added at end of imports array.

## Test Coverage

```
Test Files  1 passed (1)
     Tests  11 passed (11)
  Duration  624ms
```

Tests cover: signReviewToken JWT signing, validateToken invalid/expired, submitReview success + P2002 replay, getPublicReviews pagination + averageRating from ALL published (not just page), getAdminReviews 3 groups, moderateReview approve + reject.

## Deviations from Plan

### Railway DB Connectivity Issue (Rule 3 — Blocking)

**Found during:** Task 1
**Issue:** Railway PostgreSQL at `trolley.proxy.rlwy.net:43509` was unreachable intermittently. `prisma migrate dev --create-only` returned P1001. An empty migration (`20260518164531_phase14_public_reviews`) was applied to the DB before the connection dropped.
**Fix:** 
1. Restored the empty migration file to satisfy Prisma's local-vs-applied consistency check
2. Wrote the migration SQL manually (`20260518170000_phase14_public_reviews_schema/migration.sql`) — correct SQL that matches what `prisma migrate dev` would generate
3. Ran `prisma generate` offline (succeeds from schema alone, no DB needed) — Prisma client regenerated with Review types
4. Migration must be applied with `prisma migrate deploy` when Railway DB is available

**Impact:** TypeScript compilation and all 11 unit tests pass. The migration SQL is correct and ready to apply. No code changes needed after DB connectivity is restored.
**Commit:** `5a1632e`

## Self-Check

### PASSED

Files verified:
- FOUND: `apps/api/src/modules/reviews/reviews.module.ts`
- FOUND: `apps/api/src/modules/reviews/reviews.service.ts`
- FOUND: `apps/api/src/modules/reviews/reviews-public.controller.ts`
- FOUND: `apps/api/src/modules/reviews/reviews-admin.controller.ts`
- FOUND: `apps/api/src/modules/reviews/reviews.service.spec.ts`
- FOUND: `apps/api/src/modules/reviews/dto/submit-review.dto.ts`
- FOUND: `apps/api/src/modules/reviews/dto/moderate-review.dto.ts`
- FOUND: `apps/api/src/modules/reviews/dto/public-reviews-query.dto.ts`
- FOUND: `apps/api/prisma/migrations/20260518170000_phase14_public_reviews_schema/migration.sql`

Commits verified:
- FOUND: `5a1632e` feat(14-01): migration — reviews table + Reservation token columns
- FOUND: `9669c28` feat(14-01): ReviewsModule with 5 endpoints + JWT + dedicated throttler

Verification commands passed:
- `npx tsc --noEmit` → exit 0
- `npx vitest run src/modules/reviews/` → 11/11 passed
- `npx prisma validate` → schema valid
- `rg "ReviewsModule" apps/api/src/app.module.ts` → 1 match
- `rg "reviews-submit" apps/api/src/modules/reviews/reviews.module.ts` → 1 match
- `rg "P2002" apps/api/src/modules/reviews/reviews.service.ts` → 1 match

### Pending (requires Railway DB)

- `prisma migrate status` — migration `20260518170000_phase14_public_reviews_schema` pending apply
- `prisma migrate deploy` — applies the migration to Railway DB
- Smoke tests (5 curl commands) — require running server + applied migration

## Next Steps

**Before Wave 2 plans can proceed:**
1. Run `pnpm --filter api prisma migrate deploy` when Railway DB is reachable
2. Verify `prisma migrate status` shows "Database schema is up to date"
3. Run `pnpm --filter api start:dev` + smoke curl tests to confirm 5 endpoints respond

**Wave 2 plans unblocked after migration apply:**
- Plan 14-02: NightAudit cron extension + email template (calls `ReviewsService.sendPendingReviewInvites()` stub)
- Plan 14-03: Frontend — public submit form + portal ReviewsSection rewire + staff moderation queue
- Plan 14-04: Regression gate
