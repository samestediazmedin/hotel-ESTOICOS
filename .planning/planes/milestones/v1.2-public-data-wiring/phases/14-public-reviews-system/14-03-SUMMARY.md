---
phase: 14-public-reviews-system
plan: "03"
subsystem: frontend
tags: [review-submit, public-form, star-rating, accessibility, tanstack-query, react-hook-form, zod]
dependency_graph:
  requires:
    - apps/api/src/modules/reviews/ (14-01 — validate-token + submit endpoints)
    - apps/web/src/features/public-portal/hooks/useForceLightTheme.ts
    - apps/web/src/components/ui/{button,textarea,card}.tsx
  provides:
    - ReviewSubmitPage (standalone public page at /review/submit)
    - StarRatingInput (accessible 5-star input with ARIA radiogroup)
    - ReviewForm (react-hook-form + zodResolver)
    - useReviewToken (TanStack Query validate-token)
    - useSubmitReview (useMutation POST /api/public/reviews)
  affects:
    - apps/web/src/router.tsx (/review/submit route added outside ProtectedRoute)
tech_stack:
  added: []
  patterns:
    - Fresh axios.create() instance for public API (no auth interceptor)
    - Cross-feature import of useForceLightTheme from public-portal/hooks
    - react-hook-form setValue + watch for controlled non-input component (StarRatingInput)
    - Roving tabIndex pattern for keyboard-navigable radiogroup
    - HTTP status → user message mapping at mutation caller level
key_files:
  created:
    - apps/web/src/features/review-submit/review-submit.api.ts
    - apps/web/src/features/review-submit/hooks/useReviewToken.ts
    - apps/web/src/features/review-submit/hooks/useSubmitReview.ts
    - apps/web/src/features/review-submit/components/StarRatingInput.tsx
    - apps/web/src/features/review-submit/components/ReviewForm.tsx
    - apps/web/src/features/review-submit/ReviewSubmitPage.tsx
  modified:
    - apps/web/src/router.tsx (added /review/submit public route)
decisions:
  - "Fresh axios.create() for public review API — shared api instance has request interceptor attaching Authorization header and response interceptor attempting silent refresh on 401; both behaviors are wrong for review tokens"
  - "useForceLightTheme imported cross-feature from public-portal/hooks — established pattern (ConciergePage does same), no duplication"
  - "HTTP error mapping in ReviewSubmitPage (not ReviewForm) — page owns the token and has enough context to map 401/410/429 semantics; form is presentation-only"
  - "retry: false on useReviewToken — token validity is deterministic (invalid/expired tokens won't become valid on retry, would just waste requests)"
  - "No cache invalidation in useSubmitReview — GET /public/reviews has 60s CDN Cache-Control; page transitions to success state so stale list is not visible to user"
metrics:
  duration_minutes: 30
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_created: 6
  files_modified: 1
---

# Phase 14 Plan 03: Public /review/submit Page + StarRatingInput + ReviewForm Summary

One-liner: Standalone public review submission page with accessible 5-star input (radiogroup + keyboard nav), react-hook-form + Zod validation, TanStack Query token validation, and route wired outside ProtectedRoute.

## What Was Built

### Task 1 — API client + hooks + StarRatingInput

**`review-submit.api.ts`**
- Fresh `axios.create()` instance — NOT the shared `api` from `lib/api.ts`
- The shared instance injects `Authorization: Bearer` headers and attempts silent refresh on 401. Neither is appropriate for one-time review tokens.
- Two functions: `validateReviewToken(token)` → GET validate-token, `submitReview(body)` → POST

**`hooks/useReviewToken.ts`**
- TanStack Query, `enabled: Boolean(token)`, `retry: false`
- `staleTime: 5min` — token validity doesn't change mid-session
- `queryKey: ['review-submit', 'validate-token', token]`

**`hooks/useSubmitReview.ts`**
- Simple `useMutation` wrapping `submitReview()`
- No `onSuccess` cache invalidation — caller handles state transitions

**`components/StarRatingInput.tsx`**
- `role="radiogroup"` container + 5 `role="radio"` buttons
- 6 `aria-label` attributes: 1 on group + 5 per star ("Dar N estrella/estrellas")
- Roving tabIndex: only active star (or first if none) has `tabIndex=0`
- Keyboard: `ArrowRight` → `Math.min(idx+1, 5)`, `ArrowLeft` → `Math.max(idx-1, 1)`, `Enter`/`Space` → select
- Hover state: local `hover` state drives `display = hover || value` for preview
- Visual: `fill-mustard text-mustard` when active, `text-warm-tan` when inactive

### Task 2 — ReviewForm + ReviewSubmitPage + router wiring

**`components/ReviewForm.tsx`**
- `react-hook-form` + `zodResolver(formSchema)`
- `rating`: `z.number().int().min(1).max(5)` — controlled via `setValue`/`watch` (not `register`, because `StarRatingInput` is not a native input)
- `comment`: `z.string().min(10).max(2000)`
- Button `variant="terracotta"`, disabled when `isSubmitting`
- `submitError` prop renders server-level error below form fields

**`ReviewSubmitPage.tsx`**
- `useForceLightTheme()` on mount — prevents dark-mode leak for guests
- Cross-feature import: `@/features/public-portal/hooks/useForceLightTheme`
- Standalone layout: `hos min-h-screen bg-warm-paper flex items-center justify-center`
- `Card` centered, max-w-lg
- State machine:
  1. No `?token` → "Falta el token de invitación"
  2. `validateQuery.isLoading` → animated skeleton placeholder
  3. `validateQuery.isError` → "Este enlace ya no es válido o ha expirado" + Link to `/`
  4. `tokenData.alreadySubmitted` → "Este enlace ya fue utilizado" + Link to `/`
  5. Valid token + not submitted → guestName greeting + `ReviewForm`
  6. `submitted === true` → "¡Gracias por tu reseña!" + Link to `/`

**HTTP error mapping in `handleSubmit`:**
| Status | Message |
|--------|---------|
| 401 | "Este enlace ya no es válido." |
| 410 | "Este enlace ya fue utilizado." |
| 429 | "Demasiados intentos. Inténtalo más tarde." |
| other | "No se pudo enviar tu reseña. Inténtalo de nuevo." |

**`router.tsx`**
- Route added outside `ProtectedRoute` at same level as `/concierge` and `/booking`
- Import at bottom following existing file convention (non-lazy, same as other public pages)

## Folder Structure

```
apps/web/src/features/review-submit/
├── ReviewSubmitPage.tsx          (standalone page, all layout states)
├── review-submit.api.ts          (2 axios fns, fresh public axios instance)
├── components/
│   ├── ReviewForm.tsx            (react-hook-form + zodResolver)
│   └── StarRatingInput.tsx       (accessible radiogroup, keyboard nav)
└── hooks/
    ├── useReviewToken.ts         (TanStack useQuery, validate-token)
    └── useSubmitReview.ts        (useMutation, POST /api/public/reviews)
```

## Deviations from Plan

None — plan executed exactly as written.

Minor implementation note: `err: unknown` type used in the catch block instead of `err: any` (the plan suggested `any`). This is a TypeScript strictness improvement — cast to `{ response?: { status?: number } }` for status extraction.

## Self-Check

### PASSED

Files verified:
- FOUND: `apps/web/src/features/review-submit/ReviewSubmitPage.tsx`
- FOUND: `apps/web/src/features/review-submit/review-submit.api.ts`
- FOUND: `apps/web/src/features/review-submit/hooks/useReviewToken.ts`
- FOUND: `apps/web/src/features/review-submit/hooks/useSubmitReview.ts`
- FOUND: `apps/web/src/features/review-submit/components/StarRatingInput.tsx`
- FOUND: `apps/web/src/features/review-submit/components/ReviewForm.tsx`

Commits verified:
- FOUND: `bb28622` feat(14-03): API client + useReviewToken + useSubmitReview + StarRatingInput
- FOUND: `f47eadd` feat(14-03): ReviewForm + ReviewSubmitPage + /review/submit public route

Verification commands passed:
- `npx tsc --noEmit` → exit 0
- `rg "role=\"radiogroup\""` → 1 match in StarRatingInput.tsx
- `rg "ArrowRight|ArrowLeft"` → 3 matches in StarRatingInput.tsx
- `rg "aria-label"` → 6+ matches in StarRatingInput.tsx
- `rg "path: '/review/submit'"` → 1 match in router.tsx (outside ProtectedRoute)
- `rg "@/features/public-portal/hooks/useForceLightTheme"` → 1 match in ReviewSubmitPage.tsx
