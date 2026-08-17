# Phase 14: Public Reviews System — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Source:** REQUIREMENTS.md (REV-01..08) + audit of Phase 4 night-audit cron + Phase 3 Resend integration

<domain>
## Phase Boundary

Replace **hardcoded reviews** in the portal with a real review system. Real guests submit reviews via post-checkout email link, admin moderates from staff page, published reviews display on `/booking` Reseñas section with aggregated rating.

**End-to-end flow:**
1. Reservation → `CHECKED_OUT` status
2. Night-audit cron (existing Phase 4) → enqueues review-invite email via Resend
3. Email contains link `/review/submit?token=...` (token = signed JWT valid 90 days, single-use)
4. Guest visits link → public submit form (5-star + comment)
5. Submission → review row created with `moderated=false`
6. Admin opens `/reviews` (any staff role) → moderation queue → approve/reject
7. Approved review → `moderated=true, publishedAt=now()` → appears in portal Reseñas
8. Portal `ReviewsSection.tsx` consumes real query, aggregated rating computed server-side

**What this phase delivers:**
- `reviews` Prisma table
- 4 backend endpoints: POST submit, GET public list, PATCH moderate, DELETE soft-reject
- Email enqueuing in night-audit cron + 1 new email template
- Frontend portal: ReviewsSection wired to real query (deletes `data/reviews.ts`)
- Frontend public: `/review/submit?token=...` form page
- Frontend staff: `/reviews` moderation queue

**Out of scope (deferred to v1.3+):**
- Review editing by guest after submission
- Review responses by hotel staff (public reply)
- Photo attachments in reviews
- Multi-language reviews (ES/EN)
- Review aggregation analytics dashboard
- Spam detection beyond rate-limit

</domain>

<decisions>
## Implementation Decisions (locked)

### Prisma schema

```prisma
model Review {
  id             String      @id @default(cuid())
  guestName      String
  rating         Int         // 1-5
  comment        String      @db.Text
  stayDate       DateTime    @db.Date
  reservationId  String?     // Optional FK — token validates this; review may persist if reservation deleted
  reservation    Reservation? @relation(fields: [reservationId], references: [id], onDelete: SetNull)
  moderated      Boolean     @default(false)
  publishedAt    DateTime?
  rejectedAt     DateTime?    // soft delete signal
  createdAt      DateTime    @default(now())
  
  @@index([moderated, publishedAt])
  @@index([reservationId])
}
```

- **Migration name**: `{timestamp}_phase14_public_reviews`
- **Rating constraint**: `CHECK (rating >= 1 AND rating <= 5)` enforced at DB level
- **One review per reservation**: NOT enforced via unique constraint (could rebuild from deleted token) — enforced via token single-use logic instead

### Token contract — `ReviewSubmitToken`

Signed JWT with payload:
```ts
{
  reservationId: string,
  guestName: string,
  stayDate: string,  // ISO date
  exp: number,       // 90 days from issuance
  iat: number,
  jti: string,       // UUID — single-use tracking
}
```

- **Signing**: `JWT_SECRET` env var (already exists from Phase 1 auth). NEW: separate `REVIEW_TOKEN_SECRET` recommended to avoid scope creep — fall back to `JWT_SECRET` if absent.
- **Single-use enforcement**: when review is submitted with token X, record `jti` in `Reservation.reviewTokenJtiUsed` column (new column, nullable). Re-use rejected with 410 Gone.
- **Expiry**: 90 days from `CHECKED_OUT` date. Email is sent 1 day after checkout (per REV-07).

### Backend endpoints

**Module placement**: NEW `apps/api/src/modules/reviews/` (clean separation; not nested in concierge or public-portal).

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| `POST` | `/api/public/reviews` | none + rate limit | `{token, rating, comment}` | 201 + review row OR 410 if jti used / 401 if invalid token |
| `GET` | `/api/public/reviews?page=N&limit=M` | none + Cache-Control 60s | — | `{reviews: [...], total, averageRating, totalPublished}` |
| `PATCH` | `/api/reviews/:id/moderate` | Auth + any staff role | `{action: 'approve' \| 'reject'}` | 200 + updated review |
| `GET` | `/api/reviews` (admin/staff queue) | Auth + any staff role | — | `{pending: [...], moderated: [...]}` |

- **POST validation** (Zod): rating 1-5 int, comment 10-2000 chars, token JWT format
- **POST rate limit**: 5 attempts per IP per hour via `@nestjs/throttler` (already in use for concierge — reuse pattern)
- **GET public**: filtered to `moderated=true && publishedAt IS NOT NULL`, sorted by `publishedAt DESC`, default 10 per page

### Email template + cron integration

- **NEW email template**: `apps/api/src/modules/email/templates/review-invite.tsx` (use existing `@react-email/components` pattern if installed; otherwise plain HTML string with Resend)
- Subject: `Cuéntanos sobre tu estadía en {hotelName}`
- Body: friendly Spanish text + big "Dejar mi reseña" button → `/review/submit?token={signedJwt}`
- **Cron trigger**: extend `apps/api/src/modules/night-audit/night-audit.service.ts` — after night audit runs, find reservations with `CHECKED_OUT` status AND `checkOutDate = yesterday` AND `reviewInviteSentAt IS NULL`. For each: sign JWT + send email + set `reviewInviteSentAt = now()`.
- **NEW column on Reservation**: `reviewInviteSentAt DateTime?`, `reviewTokenJtiUsed String?` — both nullable, added in Phase 14 migration alongside `reviews` table

### Frontend pages

**1. `/review/submit?token=...` (public, no auth)**
- New folder `apps/web/src/features/review-submit/`
- `ReviewSubmitPage.tsx` — fetches `GET /api/public/reviews/validate-token?token=...` on mount to verify token + get guest name + stay date for prefill
- Form: 5-star rating (interactive stars) + comment textarea (min 10 / max 2000) + submit button terracotta
- Submit → POST `/api/public/reviews`
- Success state: "Gracias por tu reseña" + link back to `/`
- Error states: invalid/expired token → "Este enlace ya no es válido"; submission failed → inline alert
- Layout: standalone page, no StaffLayout, no portal nav — just centered card with hotel logo + form
- `useForceLightTheme` hook from Phase 10 (prevents dark-mode leak)

**2. Portal `ReviewsSection.tsx` rewire (HotelHomePage)**
- Delete `apps/web/src/features/public-portal/data/reviews.ts` (if not already in 12-05 — verify)
- Component consumes `useReviews()` query (new hook) — TanStack Query GET `/api/public/reviews?page=1&limit=10`
- Aggregated rating + count from query response (computed server-side, not client)
- "Ver más reseñas" button paginates — load next page (or simple "load more" pattern)
- Empty state: "Aún no hay reseñas publicadas" (terracotta-tint card) when no published reviews
- Loading state: skeleton from existing `skeletons.tsx` (extend with `<ReviewsSectionSkeleton />`)

**3. Staff `/reviews` moderation queue**
- New folder `apps/web/src/features/reviews-admin/`
- `ReviewsModeratorPage.tsx` — accessible to any staff role (not ADMIN-only — receptionist can moderate)
- Layout: tabs at top "Pendientes (N)" | "Publicadas" | "Rechazadas"
- Each tab shows table or card grid of reviews with: rating + comment preview + guest name + stay date + reservation link
- Pending tab: each card has "Aprobar" (terracotta) + "Rechazar" (outline) buttons
- Click approve/reject → optimistic update + mutation
- Add sidebar nav item under "Administración" with lucide `MessageSquareText` icon, label "Reseñas"

### Hook + API structure

```
apps/web/src/features/
├── public-portal/
│   └── hooks/
│       └── useReviews.ts                    (public — paginated)
├── review-submit/
│   ├── ReviewSubmitPage.tsx
│   ├── review-submit.api.ts
│   └── hooks/
│       ├── useReviewToken.ts                (validate token on mount)
│       └── useSubmitReview.ts               (POST mutation)
└── reviews-admin/
    ├── ReviewsModeratorPage.tsx
    ├── reviews-admin.api.ts
    ├── hooks/
    │   ├── useAdminReviews.ts                (queue list)
    │   └── useModerateReview.ts              (PATCH mutation)
    └── components/
        ├── ReviewQueueTable.tsx
        └── ModerationButtons.tsx
```

### Cache invalidation patterns

- After submit (public): invalidate `['public', 'reviews']` (so portal sees its own review post-moderation eventually)
- After moderate (staff): invalidate BOTH `['admin', 'reviews']` AND `['public', 'reviews']`

### Aggregated rating computation (server-side)

`getPublicReviews()` returns:
```ts
{
  reviews: Review[],         // paginated
  total: number,             // total published
  averageRating: number,     // computed from ALL published, not just current page
  pages: number,             // total pages
}
```

This way the portal shows correct overall rating even when paginated (e.g., 4.84 ★ · 318 reseñas matches what was hardcoded in v1.1).

### Verification commands

1. `pnpm --filter api prisma migrate status` shows phase14 migration applied
2. `curl -X POST http://localhost:3011/api/public/reviews -d '{token, rating, comment}' -H "Content-Type: application/json"` → 201 (with valid token) / 410 (re-use) / 401 (invalid)
3. `curl http://localhost:3011/api/public/reviews` → 200 + `{reviews, total, averageRating}`
4. Admin moderates → portal shows new review within 60s
5. Submit form rejects rating > 5 or comment < 10 chars
6. `pnpm --filter web vitest run src/features/{public-portal,review-submit,reviews-admin}/` → all pass
7. Manual: end-to-end — create reservation → mark CHECKED_OUT → trigger cron (or wait) → check Resend dashboard or DB `reviewInviteSentAt`

### Claude's Discretion
- Exact email template visual style (use bundle warm palette where possible — terracotta CTA button, Instrument Serif heading)
- Whether `ReviewsSection` paginates inline or replaces visible reviews on "Ver más"
- Whether moderator queue uses Table primitive (exists from Phase 7) or card grid (more modern)
- Reservation FK behavior on review when reservation deleted: SetNull (review survives) vs Cascade (review deleted) — recommend SetNull, keep review for portal
- Token JTI tracking: column on Reservation vs separate `review_tokens_used` table — recommend column for simplicity (single-tenant, low volume)

</decisions>

<canonical_refs>
## Canonical References

### Existing backend code
- `apps/api/src/modules/night-audit/night-audit.service.ts` — extend to trigger review-invite emails
- `apps/api/src/modules/email/email.service.ts` — Resend wrapper, reuse `.send()`
- `apps/api/src/modules/public-booking/public-booking.controller.ts` — public controller pattern (no auth)
- `apps/api/src/modules/inventory/inventory.controller.ts` — staff-auth pattern with roles
- `apps/api/src/shared/guards/roles.guard.ts` — for staff endpoints
- `apps/api/src/auth/auth.service.ts` — JWT signing/verifying pattern (reuse if `REVIEW_TOKEN_SECRET` falls back to `JWT_SECRET`)
- `apps/api/prisma/schema.prisma` — Reservation model (add columns + Review relation)

### Existing frontend code
- `apps/web/src/features/public-portal/components/ReviewsSection.tsx` — REWIRE to consume hook
- `apps/web/src/features/public-portal/data/reviews.ts` — DELETE in this phase
- `apps/web/src/features/public-portal/components/skeletons.tsx` — extend with ReviewsSectionSkeleton
- `apps/web/src/router.tsx` — add `/review/submit` (public) + `/reviews` (staff) routes
- `apps/web/src/components/layout/Sidebar.tsx` — add "Reseñas" nav item
- `apps/web/src/components/ui/{table,card,button,badge,textarea,alert-dialog}.tsx` — Phase 9 + 13 primitives
- `apps/web/src/features/public-portal/hooks/useForceLightTheme.ts` — mount on ReviewSubmitPage

### Project requirements + roadmap
- `.planning/REQUIREMENTS.md` — REV-01..08
- `.planning/ROADMAP.md` — Phase 14 section: 7 success criteria

### Dependencies (already installed)
- `resend` v4 — emails
- `jsonwebtoken` — token signing
- `@nestjs/throttler` — rate limit
- `@tanstack/react-query` v5 — frontend queries

</canonical_refs>

<specifics>
## Specific Ideas

### Star rating input (interactive)
Custom component `apps/web/src/features/review-submit/components/StarRatingInput.tsx`:
- 5 button elements (one per star)
- Hover: stars 1..N highlight with `text-mustard`
- Selected: stars 1..N filled `fill-mustard text-mustard`
- Unselected: `text-warm-tan`
- Keyboard: arrow left/right to navigate, enter to select

### Email template (HTML + Resend)
Minimal HTML email — no MJML, no React Email if not installed:
```html
<div style="font-family: Geist, sans-serif; max-width: 600px; ...">
  <h1 style="font-family: 'Instrument Serif', serif; color: #2a221a;">¡Gracias por tu visita!</h1>
  <p>Hola {guestName}, esperamos que hayas disfrutado tu estadía en {hotelName}.</p>
  <p>Nos encantaría conocer tu opinión. Toma 2 minutos:</p>
  <a href="{reviewLink}" style="background: #c4623f; color: #faf7f2; padding: 12px 24px; border-radius: 8px;">Dejar mi reseña</a>
  <p style="font-size: 12px; color: #8a7d6e;">Este enlace expira en 90 días.</p>
</div>
```

### Reservation columns to add (Phase 14 migration)
```prisma
model Reservation {
  // ... existing fields
  reviewInviteSentAt   DateTime?
  reviewTokenJtiUsed   String?   @unique  // ensures token can only be used once
  reviews              Review[]
}
```

### Token validation endpoint (NEW — needed for prefill before submit)
```
GET /api/public/reviews/validate-token?token=...
→ 200 { guestName, stayDate, hotelName, alreadySubmitted: boolean }
→ 401 if invalid signature
→ 410 if expired or jti already used
```
This lets the submit form prefill guest name + show stay date for context BEFORE the actual POST.

### Pagination on portal
Simple "Ver más reseñas" button under the visible grid. Click → append next page. Show all loaded so far. No infinite scroll (overhead for ~10-50 reviews total).

</specifics>

<deferred>
## Deferred Ideas

- **Review responses by hotel staff** (public reply to a review) — v1.3+
- **Photo attachments in reviews** — v1.3+ (would need R2 + UI)
- **Multi-language reviews** (ES/EN) — v1.3+
- **Spam / fake review detection ML** — v2 (rate limit + jti single-use is enough for v1.2)
- **Review aggregation analytics dashboard** (trends, sentiment) — v2
- **Guest editing review post-submission** — v1.3
- **Email A/B testing for invite copy** — v2
- **Auto-publish below rating threshold** (e.g., 4+ stars auto-approve) — v1.3 if moderation load is high
- **Native mobile push notifications** — v2

</deferred>

---

*Phase: 14-public-reviews-system*
*Context gathered: 2026-05-18 — milestone v1.2 Phase 3 (closeout)*
