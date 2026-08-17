# Phase 14: Public Reviews System — Research

**Researched:** 2026-05-18
**Domain:** NestJS JWT token flow · Resend email integration · Night-audit cron extension · TanStack Query wiring · Public form UX
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Prisma schema — Review model:**
```prisma
model Review {
  id             String      @id @default(cuid())
  guestName      String
  rating         Int         // 1-5
  comment        String      @db.Text
  stayDate       DateTime    @db.Date
  reservationId  String?
  reservation    Reservation? @relation(fields: [reservationId], references: [id], onDelete: SetNull)
  moderated      Boolean     @default(false)
  publishedAt    DateTime?
  rejectedAt     DateTime?
  createdAt      DateTime    @default(now())

  @@index([moderated, publishedAt])
  @@index([reservationId])
}
```
Migration name: `{timestamp}_phase14_public_reviews`. Rating DB CHECK constraint (1–5).

**Token contract — ReviewSubmitToken (signed JWT):**
```ts
{
  reservationId: string,
  guestName: string,
  stayDate: string,   // ISO date
  exp: number,        // 90 days from issuance
  iat: number,
  jti: string,        // UUID — single-use tracking
}
```
Signing key: `REVIEW_TOKEN_SECRET` env var, fall back to `JWT_ACCESS_SECRET`. Single-use enforcement via `Reservation.reviewTokenJtiUsed @unique`.

**Backend endpoints (locked):**

| Method | Path | Auth |
|--------|------|------|
| `POST` | `/api/public/reviews` | none + rate limit |
| `GET` | `/api/public/reviews?page=N&limit=M` | none + Cache-Control 60s |
| `GET` | `/api/public/reviews/validate-token?token=...` | none |
| `PATCH` | `/api/reviews/:id/moderate` | JwtAuthGuard + any staff |
| `GET` | `/api/reviews` | JwtAuthGuard + any staff |

Module placement: `apps/api/src/modules/reviews/`.

**Reservation schema additions:**
```prisma
reviewInviteSentAt   DateTime?
reviewTokenJtiUsed   String?   @unique
reviews              Review[]
```

**Frontend pages (locked):**
1. `/review/submit?token=...` — public, no auth, standalone page, `useForceLightTheme`
2. Portal `ReviewsSection.tsx` rewire — delete `data/reviews.ts`, consume `useReviews()` hook
3. Staff `/reviews` — any staff role, moderation queue with tabs

**Cron integration:** extend `night-audit.service.ts` — after `CHECKED_OUT` + `checkOutDate = yesterday` + `reviewInviteSentAt IS NULL`. Mark `reviewInviteSentAt` only after Resend succeeds.

### Claude's Discretion
- Exact email template visual style (terracotta CTA, Instrument Serif heading)
- Whether `ReviewsSection` paginates inline or replaces visible reviews on "Ver más"
- Whether moderator queue uses Table primitive (shadcn Table exists) or card grid
- Reservation FK `onDelete: SetNull` (review survives) vs Cascade — recommend SetNull (locked in schema above)
- Token JTI tracking: column on Reservation vs separate table — column chosen (locked in schema above)

### Deferred Ideas (OUT OF SCOPE)
- Review editing by guest after submission
- Review responses by hotel staff
- Photo attachments in reviews
- Multi-language reviews (ES/EN)
- Review aggregation analytics dashboard
- Spam detection beyond rate-limit
- Auto-publish below rating threshold
- Email A/B testing
- Native mobile push notifications
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REV-01 | Prisma schema `reviews` table with required columns + index on `(moderated, publishedAt)` | Schema locked in CONTEXT.md; Reservation columns confirmed absent → add in migration |
| REV-02 | `POST /api/public/reviews` with one-time JWT token, 90-day expiry, rate-limit 1/token | JWT signing via `@nestjs/jwt` JwtService (same pattern as auth) confirmed; throttler pattern from concierge confirmed |
| REV-03 | `GET /api/public/reviews?page=N&limit=M` — paginated, moderated only, sorted desc | Pattern cloned from `public-booking.controller.ts` (ThrottlerGuard at class level) |
| REV-04 | `PATCH /api/reviews/:id/moderate` + `DELETE` — staff-auth, sets publishedAt | RolesGuard confirmed — no decorator needed for "any staff" (RolesGuard allows all authenticated when no @Roles set) |
| REV-05 | `ReviewsSection.tsx` rewires to `useReviews()` hook; server-side aggregated rating | Current component signature confirmed; `data/reviews.ts` EXISTS and must be deleted |
| REV-06 | Staff `/reviews` page — any staff role, moderation queue with approve/reject | Table primitive EXISTS at `apps/web/src/components/ui/table.tsx`; Sidebar ADMINISTRACIÓN section confirmed |
| REV-07 | Night-audit cron enqueues post-checkout email via Resend, 1 day after CHECKED_OUT | Cron runs at 03:00 Bogotá; extension point confirmed; EmailService pattern confirmed |
| REV-08 | `/review/submit?token=...` — public route, validates token, renders form, submits | Router pattern confirmed; `useForceLightTheme` hook location confirmed |
</phase_requirements>

---

## Summary

Phase 14 is a full-stack feature extending three existing systems: the night-audit cron (Phase 4), the email service (Phase 3), and the public portal (Phase 10). All three systems are well understood with clean extension points. No new infrastructure is needed — `resend`, `@nestjs/throttler`, and `@nestjs/jwt` are already installed and proven in production.

The primary research questions resolve cleanly. `@react-email/components` is **not installed** — the plain HTML inline pattern from `email.service.ts` is the only email approach available and must be followed for the review-invite template. The night-audit cron has a clean post-transaction extension point in `scheduledNightAudit()`. JWT signing follows the `token.service.ts` pattern with `jwtService.sign()` passing `secret` inline — no new auth module wiring needed.

The frontend has two clear boundary decisions: `useForceLightTheme` stays in `public-portal/hooks/` and is imported cross-feature by `ReviewSubmitPage` (acceptable — this is the same cross-feature import pattern already used by `ConciergePage` for `PublicConciergeLayout`). The `Table` primitive from Phase 7 exists and is the correct choice for the moderation queue.

**Primary recommendation:** Implement in 5 plans — (1) DB migration + Reservation columns, (2) ReviewsModule backend (4 endpoints + token service), (3) Night-audit cron extension + email template, (4) Frontend 3-surface wiring, (5) Regression gate + cleanup.

---

## Standard Stack

### Already Installed — No New Packages Needed

| Package | Confirmed Version | Purpose in Phase 14 |
|---------|------------------|----------------------|
| `resend` | `6.12.3` | Review-invite transactional email |
| `@nestjs/throttler` | `6.5.0` | Rate-limit `POST /api/public/reviews` (5/IP/hour) |
| `@nestjs/jwt` | `11.x` | Sign + verify ReviewSubmitToken |
| `@tanstack/react-query` | `5.x` | `useReviews()` + `useAdminReviews()` + `useModerateReview()` hooks |
| `zod` | `4.x` | Validate review submission payload (rating 1–5, comment 10–2000 chars, token) |
| `date-fns` | `4.x` | `subDays(new Date(), 1)` for "yesterday" filter in cron extension |
| `lucide-react` | current | `MessageSquareText` icon for Sidebar nav item |

**Verification:** `@react-email/components` is **NOT in `apps/api/package.json`**. Use plain HTML string (same as `email.service.ts::buildConfirmationHtml()`).

**No `npm install` step required for this phase.**

---

## Architecture Patterns

### Confirmed Code Patterns from Codebase

#### 1. NightAuditService Extension Point

The cron method `scheduledNightAudit()` is the clean entry:

```typescript
// apps/api/src/modules/night-audit/night-audit.service.ts (current)
@Cron('0 3 * * *', { name: 'night-audit', timeZone: 'America/Bogota' })
async scheduledNightAudit(): Promise<void> {
  const bd = await this.systemConfig.getHotelBusinessDate();
  if (!bd) { ... return; }
  await this.runForBusinessDate(bd);
  await this.detectAndAlertSkippedDays(bd);
  // ← EXTENSION POINT: add review invites here
}
```

Extension: inject `ReviewsService` (or a lean `ReviewInviteService`) and call:

```typescript
await this.detectAndAlertSkippedDays(bd);
// Review invites: fire-and-forget, OUTSIDE main $transaction
try {
  await this.reviewsService.sendPendingReviewInvites(bd);
} catch (err) {
  this.logger.error('Review invite batch failed', err);
}
```

`sendPendingReviewInvites(businessDate)` must be exposed as a **public testable method** — callers in tests pass a specific date rather than waiting for the real cron.

**Cron facts confirmed:**
- Expression: `'0 3 * * *'` — fires at 03:00 exactly
- Timezone: `'America/Bogota'` — Colombia UTC-5, no DST
- Runs AFTER `runForBusinessDate()` completes (sequential)
- `emitGapAlert()` is already fire-and-forget with try/catch — same pattern for invites
- NightAuditModule exports `NightAuditService` — AppModule can wire ReviewsModule into it

#### 2. JWT Token Signing Pattern

From `apps/api/src/auth/token.service.ts`:

```typescript
// Confirmed pattern — secret passed inline per sign call
const accessToken = this.jwtService.sign(
  { sub: userId, role: user.role },
  {
    expiresIn: '30m',
    secret: process.env.JWT_ACCESS_SECRET,
  },
);
```

`AuthModule` uses `JwtModule.register({})` with no default secret — each call supplies its own. `ReviewsModule` must do the same:

```typescript
// apps/api/src/modules/reviews/reviews.module.ts
@Module({
  imports: [JwtModule.register({})],  // same pattern as AuthModule
  ...
})
```

Sign review token:
```typescript
const token = this.jwtService.sign(
  { reservationId, guestName, stayDate, jti: randomUUID() },
  {
    expiresIn: '90d',
    secret: process.env.REVIEW_TOKEN_SECRET ?? process.env.JWT_ACCESS_SECRET,
  },
);
```

Verify review token (in `ReviewsService`):
```typescript
const payload = await this.jwtService.verifyAsync(token, {
  secret: process.env.REVIEW_TOKEN_SECRET ?? process.env.JWT_ACCESS_SECRET,
});
```

#### 3. EmailService Extension Pattern

Current `email.service.ts` has ONE method, ONE inline HTML builder. Follow exactly:

```typescript
// Add to EmailService — same interface style as sendBookingConfirmation
export interface ReviewInviteParams {
  to: string;
  guestName: string;
  stayDate: string;    // "YYYY-MM-DD"
  hotelName: string;
  reviewLink: string;  // full URL: https://hotel.co/review/submit?token=...
}

async sendReviewInvite(params: ReviewInviteParams): Promise<void> {
  try {
    await this.resend.emails.send({
      from: this.fromEmail,
      to: params.to,
      subject: `Cuéntanos sobre tu estadía en ${params.hotelName}`,
      html: this.buildReviewInviteHtml(params),
    });
  } catch (err) {
    // Same pattern: log, never throw
    this.logger.error(`Failed to send review invite to ${params.to}`, err);
    throw err; // Re-throw so caller can skip marking reviewInviteSentAt
  }
}
```

**CRITICAL difference vs booking confirmation:** review invite MUST re-throw on failure so the cron extension can skip marking `reviewInviteSentAt = now()`. Mark the timestamp only after `await sendReviewInvite(...)` succeeds.

#### 4. Throttler Pattern — Public Reviews Controller

From `public-booking.controller.ts` (confirmed):

```typescript
@Controller('public')
@UseGuards(ThrottlerGuard)           // IP-based limit for all public endpoints
export class ReviewsPublicController {

  @Post('reviews')
  @Throttle({ short: { limit: 5, ttl: 3_600_000 } })  // 5/IP/hour (1 hour TTL)
  async submitReview(@Body() body: unknown) { ... }

  @Get('reviews')
  async getReviews(@Query() query: unknown) { ... }

  @Get('reviews/validate-token')
  async validateToken(@Query('token') token: string) { ... }
}
```

The custom `IpThrottlerGuard` from the concierge module is NOT needed here — the standard `ThrottlerGuard` with `@Throttle` override is sufficient (same approach as `PublicBookingController`).

**Token tracker namespace:** reviews endpoints share the `ThrottlerModule` registered in `AppModule`. No custom tracker override needed — the default `ThrottlerGuard` tracks by IP via standard Express `req.ip`.

#### 5. RolesGuard Behaviour — Staff Endpoints

From `apps/api/src/shared/guards/roles.guard.ts` (confirmed):

```typescript
// No @Roles() decorator → allows any authenticated user
if (!requiredRoles || requiredRoles.length === 0) {
  return true;
}
```

Staff moderation endpoints need `@UseGuards(JwtAuthGuard, RolesGuard)` with **no `@Roles()` decorator** — this grants access to all 4 roles (ADMIN, MANAGER, RECEPTION, HOUSEKEEPING), matching REV-06.

#### 6. Public Controller Pattern (no auth)

From `public-booking.controller.ts`:
- No `JwtAuthGuard` anywhere
- `@Controller('public')` prefix maps to `/api/public/...`
- CSRF middleware can be skipped for GET + token-validated POST (token IS the CSRF equivalent for review submission — the JWT proves intent)

Reviews module uses `@Controller('public')` for public endpoints and `@Controller()` (no prefix) for staff endpoints — OR use a single controller with two route groups. Recommend TWO controllers: `ReviewsPublicController` and `ReviewsAdminController` for clean separation (matches Phase 13 pattern: `HotelPhotosModule` has admin-only controller, `PublicPortalController` has public-only).

#### 7. Frontend Route Pattern

From `apps/web/src/router.tsx` (confirmed):
- `/review/submit` → PUBLIC, goes in the outer `AppWrapper` children (same level as `/concierge`, `/booking`)
- `/reviews` → STAFF, goes inside `ProtectedRoute > StaffLayout` children

```typescript
// Public route (outside ProtectedRoute)
{ path: '/review/submit', element: <ReviewSubmitPage /> },

// Staff route (inside ProtectedRoute > StaffLayout)
{ path: 'reviews', element: <ReviewsModeratorPage /> },
```

Imports follow the "lazy imports at module level" pattern already in `router.tsx`.

#### 8. Sidebar Nav Item

Current ADMINISTRACIÓN section ends with:
```typescript
{ to: '/settings/hotel',          label: 'Configuración',  icon: SlidersHorizontal, roles: ['ADMIN'] },
{ to: '/admin/concierge/venues',  label: 'Concierge',      icon: Compass,           roles: ['ADMIN'] },
```

"Reseñas" has no role restriction (REV-06 — any staff). Insert BEFORE Configuración (it's more operational than admin-only items):

```typescript
{ to: '/reviews', label: 'Reseñas', icon: MessageSquareText },
// ↑ no `roles` — all staff can moderate
{ to: '/settings/hotel', label: 'Configuración', icon: SlidersHorizontal, roles: ['ADMIN'] },
{ to: '/admin/concierge/venues', label: 'Concierge', icon: Compass, roles: ['ADMIN'] },
```

`MessageSquareText` is available in `lucide-react` (already imported elsewhere in the project).

---

## Research Answers — Specific Questions

### Q1: `@react-email/components` installation status

**CONFIRMED ABSENT.** `apps/api/package.json` dependencies do not include `@react-email/components` or any `@react-email/*` package. The project uses `resend` v6.12.3 with plain HTML strings. The review-invite template must be built as an inline HTML string following the exact `buildConfirmationHtml()` pattern in `email.service.ts`.

### Q2: Existing email templates folder

**NO TEMPLATES FOLDER.** `apps/api/src/modules/email/` contains only:
- `email.module.ts`
- `email.service.ts`
- `email.service.spec.ts`

No `templates/` subdirectory. HTML is built inline via private builder methods. Add `buildReviewInviteHtml()` as a private method on `EmailService` — no new folder needed.

### Q3: Night-audit cron timing and extension point

**Confirmed facts:**
- (a) Cron expression: `'0 3 * * *'` — fires at 03:00 exactly (not 04:00 as one comment in code suggested — the annotation says 04:00 but the actual decorator says 03:00. The decorator wins.)
- (b) Timezone-aware: `{ timeZone: 'America/Bogota' }` — Colombia is permanently UTC-5, no DST
- (c) After audit completes: calls `detectAndAlertSkippedDays(bd)` — this is fire-and-forget outside `$transaction`
- (d) Clean extension point: `scheduledNightAudit()` after `detectAndAlertSkippedDays()` — add one more `try/catch` block calling `ReviewsService.sendPendingReviewInvites(bd)`. The main audit result is already committed at that point.

**The review invite query:**
```typescript
// Inside sendPendingReviewInvites(businessDate: Date)
const yesterday = subDays(businessDate, 1);  // date-fns — already imported

const reservations = await this.prisma.reservation.findMany({
  where: {
    status: 'CHECKED_OUT',
    checkOutDate: yesterday,
    reviewInviteSentAt: null,
    guest: { email: { not: null } },  // only guests with email
  },
  include: { guest: true },
});
```

### Q4: `Reservation` model current columns

**Confirmed columns (no Phase 14 additions yet):**

| Column | Type | Notes |
|--------|------|-------|
| `id` | `String @id @default(cuid())` | — |
| `guestId` | `String` | FK → Guest |
| `roomId` | `String?` | FK → Room (null until check-in) |
| `roomTypeId` | `String` | requested type |
| `checkInDate` | `DateTime @db.Date` | — |
| `checkOutDate` | `DateTime @db.Date` | — |
| `status` | `ReservationStatus` | enum: CONFIRMED/CHECKED_IN/**CHECKED_OUT**/CANCELLED/NO_SHOW/PENDING |
| `source` | `ReservationSource` | DIRECT/WALK_IN/OTA_FUTURE |
| `adults` | `Int` | — |
| `children` | `Int` | — |
| `notes` | `String?` | — |
| `totalNights` | `Int` | — |
| `createdAt` | `DateTime` | — |
| `updatedAt` | `DateTime` | — |

**Phase 14 adds:**
- `reviewInviteSentAt DateTime?` — nullable, set after successful email
- `reviewTokenJtiUsed String? @unique` — unique constraint prevents token replay
- `reviews Review[]` — relation back-reference

`CHECKED_OUT` status exists. `checkOutDate` exists. Safe to add nullable columns.

### Q5: JWT signing pattern

**Confirmed:** `TokenService` uses `this.jwtService.sign(payload, { expiresIn, secret: process.env.JWT_ACCESS_SECRET })`. The secret is passed **per-call** — `JwtModule.register({})` has no default secret configured. `ReviewsModule` follows the same pattern: import `JwtModule.register({})`, inject `JwtService`, call `.sign()` with `secret: process.env.REVIEW_TOKEN_SECRET ?? process.env.JWT_ACCESS_SECRET`.

**New env var to document:** `REVIEW_TOKEN_SECRET` (optional — falls back to `JWT_ACCESS_SECRET` if absent). Add to `.env.example`.

### Q6: `@nestjs/throttler` configuration

**Two patterns in use:**

**Pattern A (PublicBookingController):** `@UseGuards(ThrottlerGuard)` at class level + `@Throttle({ short: { limit: 5, ttl: 60_000 } })` per restrictive method. Named throttler `short` must match a throttler name registered in `ThrottlerModule.forRoot([ { name: 'short', ... } ])`.

**Pattern B (ConciergeController):** Custom `IpThrottlerGuard extends ThrottlerGuard` at method level, separate throttler config registered inside `ConciergeModule`.

For reviews: **use Pattern A** (simpler, no custom guard needed). Throttle the `POST /api/public/reviews` to `{ short: { limit: 5, ttl: 3_600_000 } }` (5 per IP per hour). The `short` throttler name must already be registered in `AppModule.ThrottlerModule`.

**Check needed when writing the plan:** verify the `short` throttler TTL in AppModule — it may be 60s (per-minute) not 3600s. If so, define a new throttler name `reviews-ip` in `ReviewsModule`'s own throttler config, or use the named `concierge-ip` pattern.

### Q7: Reservation FK relations

Current `Reservation` relations:
- `folio Folio?` — one-to-one (unique reservationId on Folio)
- `stays Stay[]` — one-to-many
- FK from Guest: `guestId`
- FK to Room: `roomId?`

Phase 14 adds `reviews Review[]`. Naming convention matches: `folio` (singular), `stays` (plural), `reviews` (plural). `onDelete: SetNull` on the Review side — review survives if reservation is deleted.

### Q8: Sidebar "Administración" section structure

Current ADMINISTRACIÓN items in order:
1. Tarifas (`/pricing/rate-plans`) — ADMIN, MANAGER
2. Temporadas (`/pricing/seasons`) — ADMIN, MANAGER
3. Reportes (`/reportes`) — ADMIN, MANAGER
4. Usuarios (`/users`) — ADMIN only
5. Configuración (`/settings/hotel`) — ADMIN only
6. Concierge (`/admin/concierge/venues`) — ADMIN only

"Reseñas" (no role restriction) should be inserted at position **4** — after Reportes, before the ADMIN-only items. Reasoning: it is operational (any staff can moderate) so it belongs with the broader-access items.

Final order:
1. Tarifas
2. Temporadas
3. Reportes
4. **Reseñas** ← insert here
5. Usuarios
6. Configuración
7. Concierge

### Q9: `useForceLightTheme` hook portability

The hook at `apps/web/src/features/public-portal/hooks/useForceLightTheme.ts` is already **used cross-feature** — `ConciergePage` (under `features/concierge/`) imports it from `public-portal/hooks/`. This means the cross-feature import pattern is established and acceptable.

**Recommendation:** Import from its current location in `ReviewSubmitPage`:
```typescript
import { useForceLightTheme } from '@/features/public-portal/hooks/useForceLightTheme';
```

Do NOT move the hook — moving it would break `ConciergePage` and the Phase 10 concierge import. The current location is correct.

### Q10: Star rating components in existing codebase

No star rating input component exists. `ReviewsSection.tsx` renders static `Star` icons from `lucide-react` (display only). `BogotaVenue` model has a `rating Decimal @db.Decimal(3,2)` field displayed as a number — no interactive star UI anywhere.

The `StarRatingInput` component is a **new component** to be built from scratch in `review-submit/components/`. The CONTEXT.md design spec is the source of truth:
- 5 `<button>` elements (one per star)
- Hover: stars 1..N highlight `text-mustard`
- Selected: `fill-mustard text-mustard`
- Unselected: `text-warm-tan`
- Keyboard: arrow left/right, enter to select
- `aria-label` on each button: `"Dar N estrellas"`

### Q11: Token validation endpoint recommendation

**Recommend backend `GET /api/public/reviews/validate-token?token=...`.** Reasons:
1. JTI check requires DB access (Reservation.reviewTokenJtiUsed) — must be server-side
2. Single source of truth — prevents client from trusting its own decode
3. Expiry and signature verification server-side = consistent behaviour
4. Returns `{ guestName, stayDate, hotelName, alreadySubmitted: boolean }` for form prefill — alreadySubmitted = `reservationId.reviewTokenJtiUsed IS NOT NULL`

Client-side decode (jose lib) is NOT recommended — it cannot check JTI reuse without a server call anyway.

### Q12: Pitfalls and Gotchas

**P1 — Email send failure must NOT mark `reviewInviteSentAt`:**
Unlike booking confirmation (which swallows errors silently), `sendReviewInvite()` should re-throw after logging. The cron loop should only mark `reviewInviteSentAt = now()` when Resend confirms success. Pattern:
```typescript
for (const reservation of reservations) {
  try {
    await this.emailService.sendReviewInvite(params);
    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { reviewInviteSentAt: new Date() },
    });
  } catch (err) {
    this.logger.error(`Review invite failed for reservation ${reservation.id}`, err);
    // Continue to next — don't abort entire batch
  }
}
```

**P2 — Reservation deletion preserves review (SetNull):**
`onDelete: SetNull` on `Review.reservationId`. When a reservation is deleted, `Review.reservationId` becomes null. The review still appears on the portal. This is correct — removing a reservation should not scrub published guest feedback.

**P3 — Aggregated rating must include ALL published reviews, not just current page:**
`getPublicReviews()` returns `averageRating` computed from `prisma.review.aggregate({ where: { moderated: true, publishedAt: { not: null } }, _avg: { rating: true }, _count: true })` — separate from the paginated `findMany`. Do NOT compute average from the returned page.

**P4 — Token replay race condition:**
Two concurrent POSTs with the same JTI → DB unique constraint on `Reservation.reviewTokenJtiUsed` rejects the second. The service catches `P2002` (Prisma unique constraint violation) and returns 410 Gone. This is correct atomic behaviour — no application-level locking needed.

**P5 — Guest with no email:**
The cron must filter: `guest.email IS NOT NULL`. Guests registered by staff via walk-in may have no email. Skip silently.

**P6 — Star rating accessibility:**
Each star button needs `aria-label="Dar N estrellas"` and `role="radio"` in a `role="radiogroup"`. Arrow keys must move focus and update selection. `tabIndex={rating === i + 1 ? 0 : -1}` for roving tabindex pattern.

**P7 — `validate-token` endpoint route order in NestJS:**
`GET /api/public/reviews/validate-token` must be registered BEFORE `GET /api/public/reviews/:id` (if that route exists) — otherwise NestJS matches `validate-token` as the `:id` param. Put `validate-token` first in the controller or ensure no conflicting parameterized route.

**P8 — Cache-Control 60s on GET public reviews:**
Add `@Header('Cache-Control', 'public, max-age=60')` (same as `PublicPortalController` pattern). Without this, Railway CDN won't cache the response and every portal load hits the DB.

**P9 — `reviews.ts` file deletion order:**
Delete `apps/web/src/features/public-portal/data/reviews.ts` in the SAME plan that rewires `ReviewsSection.tsx`. If deleted first, TypeScript build breaks. If rewired first without deletion, the dead file lingers.

**P10 — `ReviewsSection` signature change:**
Current props: `{ reviews: Review[], rating: number, reviewCount: number }`. After rewire: zero props — the component self-fetches via `useReviews()`. `HotelHomePage` removes the props it currently passes. This is a breaking change to the component interface — verify all usages of `<ReviewsSection` before removing the props.

### Q13: Files inventory

**Backend — NEW files:**
```
apps/api/src/modules/reviews/
├── reviews.module.ts
├── reviews-public.controller.ts
├── reviews-admin.controller.ts
├── reviews.service.ts
├── reviews.service.spec.ts
├── dto/
│   ├── submit-review.dto.ts       (Zod schema: token, rating, comment)
│   ├── moderate-review.dto.ts     (Zod schema: action 'approve'|'reject')
│   └── public-reviews-query.dto.ts (Zod schema: page, limit)
apps/api/prisma/migrations/{timestamp}_phase14_public_reviews/
└── migration.sql                  (Review table + Reservation columns)
```

**Backend — MODIFIED files:**
```
apps/api/prisma/schema.prisma      (Review model + Reservation columns)
apps/api/src/modules/email/email.service.ts   (+ sendReviewInvite + buildReviewInviteHtml)
apps/api/src/modules/email/email.service.spec.ts  (+ sendReviewInvite tests)
apps/api/src/modules/night-audit/night-audit.service.ts  (+ review invite loop)
apps/api/src/modules/night-audit/night-audit.service.spec.ts (+ invite tests)
apps/api/src/modules/night-audit/night-audit.module.ts   (import ReviewsModule)
apps/api/src/app.module.ts                    (import ReviewsModule)
apps/api/.env.example                         (+ REVIEW_TOKEN_SECRET=)
```

**Frontend — NEW files:**
```
apps/web/src/features/review-submit/
├── ReviewSubmitPage.tsx
├── review-submit.api.ts
├── hooks/
│   ├── useReviewToken.ts          (validate-token query)
│   └── useSubmitReview.ts         (POST mutation)
└── components/
    └── StarRatingInput.tsx        (interactive 5-star input)
apps/web/src/features/reviews-admin/
├── ReviewsModeratorPage.tsx
├── reviews-admin.api.ts
├── hooks/
│   ├── useAdminReviews.ts         (GET /api/reviews)
│   └── useModerateReview.ts       (PATCH mutation)
└── components/
    ├── ReviewQueueTable.tsx
    └── ModerationButtons.tsx
apps/web/src/features/public-portal/hooks/useReviews.ts  (public paginated query)
```

**Frontend — MODIFIED files:**
```
apps/web/src/features/public-portal/components/ReviewsSection.tsx  (rewire to useReviews)
apps/web/src/features/public-portal/components/skeletons.tsx       (+ ReviewsSectionSkeleton)
apps/web/src/features/public-portal/types.ts                       (update Review interface)
apps/web/src/components/layout/Sidebar.tsx                         (+ Reseñas nav item)
apps/web/src/router.tsx                                             (+ 2 routes)
```

**Frontend — DELETED files:**
```
apps/web/src/features/public-portal/data/reviews.ts
```

**Total blast radius:** ~15 new files + 11 modified + 1 deleted = 27 file touches.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT sign/verify | Custom HMAC signing | `@nestjs/jwt` JwtService (already installed) | Already wired in `AuthModule`; same `register({})` pattern |
| Email HTML | MJML / React Email templates | Plain HTML string (inline builder method) | No `@react-email/components` installed; existing pattern proven |
| Rate limiting | Custom Redis counter | `@nestjs/throttler` ThrottlerGuard (installed, configured) | Already in production for booking engine and concierge |
| DB unique enforcement for token replay | Application-level mutex/lock | `@unique` constraint on `Reservation.reviewTokenJtiUsed` | DB enforces atomicity — catch Prisma `P2002` error |
| Pagination | Custom offset logic | Prisma `skip/take` + `count` | Standard pattern; review service uses same as reporting module |

---

## Code Examples

### Night-Audit Extension — Post-Audit Hook
```typescript
// Source: apps/api/src/modules/night-audit/night-audit.service.ts pattern
@Cron('0 3 * * *', { name: 'night-audit', timeZone: 'America/Bogota' })
async scheduledNightAudit(): Promise<void> {
  const bd = await this.systemConfig.getHotelBusinessDate();
  if (!bd) { return; }
  await this.runForBusinessDate(bd);
  await this.detectAndAlertSkippedDays(bd);
  // Phase 14 — review invites (fire-and-forget, outside $transaction)
  try {
    await this.reviewsService.sendPendingReviewInvites(bd);
  } catch (err) {
    this.logger.error('Review invite batch failed (non-critical)', err);
  }
}
```

### ReviewSubmitToken — Sign
```typescript
// Source: token.service.ts signing pattern
const jti = randomUUID();
const token = this.jwtService.sign(
  { reservationId, guestName, stayDate: stayDate.toISOString().slice(0, 10), jti },
  {
    expiresIn: '90d',
    secret: process.env.REVIEW_TOKEN_SECRET ?? process.env.JWT_ACCESS_SECRET,
  },
);
```

### Token Replay — DB Unique Constraint Catch
```typescript
try {
  await this.prisma.reservation.update({
    where: { id: reservationId },
    data: { reviewTokenJtiUsed: jti },
  });
} catch (err: any) {
  if (err?.code === 'P2002') {  // Prisma unique constraint violation
    throw new GoneException('Este enlace de reseña ya fue utilizado');
  }
  throw err;
}
```

### Public Reviews Query — Server-Side Aggregation
```typescript
// Source: Prisma aggregate pattern (consistent with daily_snapshot computation)
const [reviews, totalCount, aggResult] = await this.prisma.$transaction([
  this.prisma.review.findMany({
    where: { moderated: true, publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  }),
  this.prisma.review.count({
    where: { moderated: true, publishedAt: { not: null } },
  }),
  this.prisma.review.aggregate({
    where: { moderated: true, publishedAt: { not: null } },
    _avg: { rating: true },
  }),
]);
const averageRating = Number(aggResult._avg.rating ?? 0);
```

### ReviewsSection Rewire — Self-Fetching Component
```typescript
// ReviewsSection.tsx becomes self-contained (no props)
export function ReviewsSection() {
  const { data, isLoading, fetchNextPage, hasNextPage } = useReviews();

  if (isLoading) return <ReviewsSectionSkeleton />;

  if (!data || data.pages[0].total === 0) {
    return (
      <section className="scroll-mt-20">
        <div className="rounded-2xl bg-terracotta-tint p-6 text-center text-ink-2">
          Aún no hay reseñas publicadas.
        </div>
      </section>
    );
  }
  // ...render reviews + "Ver más" button
}
```

### Sidebar Nav Addition
```typescript
// Source: apps/web/src/components/layout/Sidebar.tsx — ADMINISTRACIÓN section
import { MessageSquareText } from 'lucide-react'; // add to existing imports

// In NAV_SECTIONS ADMINISTRACIÓN items, before Usuarios:
{ to: '/reviews', label: 'Reseñas', icon: MessageSquareText },
// No `roles` property — all authenticated staff can moderate
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `REVIEWS` array in `data/reviews.ts` | Real reviews from DB via `GET /api/public/reviews` | Phase 14 | Portal shows real guest feedback; aggregated rating is live |
| Static `ReviewsSection` (props-driven) | Self-fetching `ReviewsSection` (internal `useReviews()`) | Phase 14 | `HotelHomePage` stops managing review data |
| No post-checkout guest engagement | Email invite 1 day after checkout | Phase 14 | Guest retention loop closed |

**Deprecated/outdated:**
- `apps/web/src/features/public-portal/data/reviews.ts` — deleted in Phase 14 (REV-05 completion)
- `Review` interface in `types.ts` (`authorName`, `authorInitial`, `date` fields) — replace with API-shaped interface (`guestName`, `rating`, `publishedAt`, `comment`)

---

## Open Questions

1. **ThrottlerModule `short` TTL in AppModule**
   - What we know: `PublicBookingController` uses `@Throttle({ short: { limit: 5, ttl: 60_000 } })` — TTL is 60 seconds (per-minute), not per-hour
   - What's unclear: Phase 14 wants 5 submissions per IP per **hour** (3_600_000ms TTL) — different from the existing `short` throttler
   - Recommendation: define a new named throttler `reviews-submit` inside `ReviewsModule` with `ttl: 3_600_000, limit: 5`, following the `ConciergeModule` pattern of registering its own throttler config

2. **Guest email availability**
   - What we know: `Guest.email` is `String?` (nullable) — staff-created walk-in guests may have no email
   - What's unclear: what percentage of CHECKED_OUT reservations have email? If low, the invite rate will disappoint
   - Recommendation: filter silently in cron (`guest.email: { not: null }`); no action needed architecturally

3. **`FRONTEND_BASE_URL` env var for review link**
   - What we know: the email must contain a full URL `https://{domain}/review/submit?token=...`
   - What's unclear: is `FRONTEND_BASE_URL` or `APP_URL` already in `.env` / `ConfigService`?
   - Recommendation: plan must add `FRONTEND_BASE_URL` to `.env.example` and use `config.get('FRONTEND_BASE_URL', 'http://localhost:5173')` in the token link builder

---

## Files to Create / Modify — Summary Table

| File | Action | Plan |
|------|--------|------|
| `apps/api/prisma/schema.prisma` | Modify — add Review model + Reservation columns | 14-01 |
| `apps/api/prisma/migrations/{ts}_phase14_public_reviews/migration.sql` | Create | 14-01 |
| `apps/api/src/modules/reviews/reviews.module.ts` | Create | 14-02 |
| `apps/api/src/modules/reviews/reviews.service.ts` | Create | 14-02 |
| `apps/api/src/modules/reviews/reviews.service.spec.ts` | Create | 14-02 |
| `apps/api/src/modules/reviews/reviews-public.controller.ts` | Create | 14-02 |
| `apps/api/src/modules/reviews/reviews-admin.controller.ts` | Create | 14-02 |
| `apps/api/src/modules/reviews/dto/*.ts` (3 files) | Create | 14-02 |
| `apps/api/src/app.module.ts` | Modify — import ReviewsModule | 14-02 |
| `apps/api/src/modules/email/email.service.ts` | Modify — add sendReviewInvite | 14-03 |
| `apps/api/src/modules/email/email.service.spec.ts` | Modify — add sendReviewInvite tests | 14-03 |
| `apps/api/src/modules/night-audit/night-audit.service.ts` | Modify — extend scheduledNightAudit | 14-03 |
| `apps/api/src/modules/night-audit/night-audit.service.spec.ts` | Modify — add invite tests | 14-03 |
| `apps/api/src/modules/night-audit/night-audit.module.ts` | Modify — import ReviewsModule or EmailModule | 14-03 |
| `apps/api/.env.example` | Modify — add REVIEW_TOKEN_SECRET, FRONTEND_BASE_URL | 14-03 |
| `apps/web/src/features/review-submit/ReviewSubmitPage.tsx` | Create | 14-04 |
| `apps/web/src/features/review-submit/review-submit.api.ts` | Create | 14-04 |
| `apps/web/src/features/review-submit/hooks/useReviewToken.ts` | Create | 14-04 |
| `apps/web/src/features/review-submit/hooks/useSubmitReview.ts` | Create | 14-04 |
| `apps/web/src/features/review-submit/components/StarRatingInput.tsx` | Create | 14-04 |
| `apps/web/src/features/reviews-admin/ReviewsModeratorPage.tsx` | Create | 14-04 |
| `apps/web/src/features/reviews-admin/reviews-admin.api.ts` | Create | 14-04 |
| `apps/web/src/features/reviews-admin/hooks/useAdminReviews.ts` | Create | 14-04 |
| `apps/web/src/features/reviews-admin/hooks/useModerateReview.ts` | Create | 14-04 |
| `apps/web/src/features/reviews-admin/components/ReviewQueueTable.tsx` | Create | 14-04 |
| `apps/web/src/features/reviews-admin/components/ModerationButtons.tsx` | Create | 14-04 |
| `apps/web/src/features/public-portal/hooks/useReviews.ts` | Create | 14-04 |
| `apps/web/src/features/public-portal/components/ReviewsSection.tsx` | Modify — self-fetching rewire | 14-04 |
| `apps/web/src/features/public-portal/components/skeletons.tsx` | Modify — add ReviewsSectionSkeleton | 14-04 |
| `apps/web/src/features/public-portal/types.ts` | Modify — update Review interface | 14-04 |
| `apps/web/src/features/public-portal/data/reviews.ts` | **Delete** | 14-04 |
| `apps/web/src/components/layout/Sidebar.tsx` | Modify — add Reseñas nav item | 14-04 |
| `apps/web/src/router.tsx` | Modify — add 2 routes | 14-04 |
| Phase 14 regression gate + vitest | Plan | 14-05 |

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `night-audit.service.ts`, `email.service.ts`, `token.service.ts`, `auth.module.ts`, `schema.prisma`, `public-booking.controller.ts`, `concierge.controller.ts`, `ip-throttler.guard.ts`, `roles.guard.ts`, `Sidebar.tsx`, `router.tsx`, `ReviewsSection.tsx`, `skeletons.tsx`, `useForceLightTheme.ts`, `types.ts`, `reviews.ts`, `package.json`, `night-audit.module.ts`, `night-audit.service.spec.ts`
- `.planning/phases/14-public-reviews-system/14-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md` — REV-01..08
- `.planning/config.json` — `nyquist_validation: false`

### Secondary (MEDIUM confidence)
- CLAUDE.md stack table — confirmed against actual package.json versions

### Tertiary (LOW confidence)
- None — all findings derived from direct file reads

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed installed via package.json
- Architecture patterns: HIGH — all patterns derived from direct codebase reads
- Extension points: HIGH — cron, email, JWT, throttler all confirmed in place
- Pitfalls: HIGH — derived from code analysis, not speculation
- Frontend wiring: HIGH — router.tsx, Sidebar.tsx, skeletons.tsx all read and confirmed

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (packages stable; only invalidated if NestJS/Prisma major version bumps)

---

## RESEARCH COMPLETE
