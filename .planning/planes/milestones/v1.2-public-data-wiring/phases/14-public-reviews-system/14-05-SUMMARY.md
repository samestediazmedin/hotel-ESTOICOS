---
phase: 14-public-reviews-system
plan: "05"
subsystem: frontend
tags: [reviews-admin, moderation, tanstack-query, sidebar-nav, cross-cache-invalidation]
dependency_graph:
  requires:
    - apps/api/src/modules/reviews/reviews-admin.controller.ts (14-01 — GET /api/reviews + PATCH /api/reviews/:id/moderate)
    - apps/web/src/lib/api.ts (authenticated axios instance)
    - apps/web/src/components/ui/table.tsx
    - apps/web/src/components/ui/button.tsx (terracotta + outline variants)
  provides:
    - ReviewsModeratorPage (/reviews — any staff role)
    - useAdminReviews (queryKey ['admin','reviews'])
    - useModerateReview (cross-cache invalidation)
    - ReviewQueueTable (table layout with showActions prop)
    - ModerationButtons (Aprobar + Rechazar)
  affects:
    - apps/web/src/router.tsx (/reviews route inside ProtectedRoute)
    - apps/web/src/components/layout/Sidebar.tsx (Reseñas nav item added)
tech_stack:
  added: []
  patterns:
    - Cross-cache invalidation: onSuccess invalidates ['admin','reviews'] AND ['public','reviews']
    - No inline role gate on page — backend RolesGuard (empty @Roles()) is the only enforcement
    - Hand-rolled TabButton (no shadcn Tabs) — tabs primitive not available, 3-line pattern is simpler
    - Token utilities only — bg-warm-cream, text-ink-3, fill-mustard, text-terracotta, border-warm-line
key_files:
  created:
    - apps/web/src/features/reviews-admin/ReviewsModeratorPage.tsx
    - apps/web/src/features/reviews-admin/reviews-admin.api.ts
    - apps/web/src/features/reviews-admin/hooks/useAdminReviews.ts
    - apps/web/src/features/reviews-admin/hooks/useModerateReview.ts
    - apps/web/src/features/reviews-admin/components/ReviewQueueTable.tsx
    - apps/web/src/features/reviews-admin/components/ModerationButtons.tsx
  modified:
    - apps/web/src/router.tsx (path 'reviews' inside ProtectedRoute > StaffLayout)
    - apps/web/src/components/layout/Sidebar.tsx (MessageSquareText + Reseñas nav item)
decisions:
  - "Hand-rolled TabButton over shadcn Tabs — verified tabs.tsx not present in components/ui/; 3-line implementation is cleaner than importing an external tabs library"
  - "No inline role gate on ReviewsModeratorPage — REV-06 requires any staff can moderate; backend is the only enforcement layer; adding an inline gate would contradict the requirement"
  - "Sidebar insertion at position 4 (after Reportes, before Usuarios) — natural grouping: Reportes+Reseñas are data-review activities visible to MANAGER+; Usuarios/Configuración/Concierge are ADMIN-only"
  - "api instance (authenticated) for reviews-admin.api.ts — staff endpoints require JWT; contrast with review-submit.api.ts which uses a fresh public axios instance"
metrics:
  duration_minutes: 20
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_created: 6
  files_modified: 2
---

# Phase 14 Plan 05: Staff Moderation Page + Sidebar Nav Summary

One-liner: Staff moderation queue at /reviews with 3-tab layout (Pendientes/Publicadas/Rechazadas), cross-cache invalidation on approve/reject, and Sidebar Reseñas nav item accessible to all staff roles.

## What Was Built

### Task 1 — API client + 2 hooks + 2 components

**`reviews-admin.api.ts`**
- Uses authenticated `api` axios instance from `@/lib/api` (JWT auto-attached via interceptor)
- `fetchAdminReviews()` → GET /api/reviews → `{pending, published, rejected}`
- `moderateReview(id, action)` → PATCH /api/reviews/:id/moderate → updated Review

**`hooks/useAdminReviews.ts`**
- TanStack Query, `queryKey: ['admin', 'reviews']`, `staleTime: 30_000`
- Invalidated by `useModerateReview.onSuccess`

**`hooks/useModerateReview.ts`**
- `useMutation` wrapping `moderateReview(id, action)`
- `onSuccess`: invalidates BOTH `['admin', 'reviews']` AND `['public', 'reviews']`
- Cross-cache invalidation critical — without it portal only updates after 60s Cache-Control TTL

**`components/ModerationButtons.tsx`**
- `Button variant="terracotta"` for Aprobar (Check icon)
- `Button variant="outline"` for Rechazar (X icon)
- Both disabled while `mutation.isPending` — prevents double-submit

**`components/ReviewQueueTable.tsx`**
- Uses Table/TableHeader/TableBody/TableRow/TableHead/TableCell from `@/components/ui/table`
- `showActions` prop — truthy only for Pendientes tab
- Empty state: `bg-warm-cream` rounded card with message
- `es-CO` locale for stayDate and createdAt formatting

### Task 2 — ReviewsModeratorPage + router route + Sidebar nav

**`ReviewsModeratorPage.tsx`**
- `<h1 className="font-display italic text-3xl text-ink-1">Moderación de reseñas</h1>`
- Tab navigation: hand-rolled `TabButton` (shadcn Tabs not available — see Decisions)
- Active tab: `border-b-2 border-terracotta text-terracotta` — inactive: `text-ink-3`
- Loading state: animated pulse skeleton (3 rows, `bg-warm-cream`)
- Error state: terracotta text, border-warm-line card
- No inline role gate — REV-06 allows any staff

**`router.tsx`**
- `path: 'reviews'` inside ProtectedRoute > StaffLayout children (after settings/hotel)
- Static import at bottom following established file convention
- Preserves existing `/review/submit` public route (14-03 work untouched)

**`Sidebar.tsx`**
- `MessageSquareText` added to lucide-react import
- `{ to: '/reviews', label: 'Reseñas', icon: MessageSquareText }` — NO `roles` property
- Inserted at position 4 in ADMINISTRACIÓN: after Reportes, before Usuarios
- Items without `roles` render unconditionally (filter: `!item.roles || item.roles.includes(role)`)

## Folder Structure Created

```
apps/web/src/features/reviews-admin/
├── ReviewsModeratorPage.tsx          (page — 3 tabs, any staff)
├── reviews-admin.api.ts              (2 fns — authenticated api instance)
├── hooks/
│   ├── useAdminReviews.ts            (TanStack useQuery)
│   └── useModerateReview.ts          (useMutation + cross-cache invalidation)
└── components/
    ├── ModerationButtons.tsx         (Aprobar + Rechazar buttons)
    └── ReviewQueueTable.tsx          (Table primitive, showActions prop)
```

## Deviations from Plan

None — plan executed exactly as written.

Minor note: the plan's acceptance criteria mentioned `rg "to: '/reviews'"` matching Sidebar — the actual data structure uses `to: '/reviews'` (with quotes as JS string literal), which matches correctly.

## Self-Check

### PASSED

Files verified:
- FOUND: `apps/web/src/features/reviews-admin/ReviewsModeratorPage.tsx`
- FOUND: `apps/web/src/features/reviews-admin/reviews-admin.api.ts`
- FOUND: `apps/web/src/features/reviews-admin/hooks/useAdminReviews.ts`
- FOUND: `apps/web/src/features/reviews-admin/hooks/useModerateReview.ts`
- FOUND: `apps/web/src/features/reviews-admin/components/ReviewQueueTable.tsx`
- FOUND: `apps/web/src/features/reviews-admin/components/ModerationButtons.tsx`

Commits verified:
- FOUND: `8e1e944` feat(14-05): API client + useAdminReviews + useModerateReview + ReviewQueueTable + ModerationButtons
- FOUND: `762163e` feat(14-05): ReviewsModeratorPage + /reviews route + Sidebar Reseñas nav item

Verification commands passed:
- `npx tsc --noEmit` → exit 0
- `rg "invalidateQueries.*public.*reviews"` → 1 match in useModerateReview.ts
- `rg "invalidateQueries.*admin.*reviews"` → 1 match in useModerateReview.ts
- `rg "MessageSquareText" Sidebar.tsx` → 2 matches (import + usage)
- `rg "path: 'reviews'" router.tsx` → 1 match (inside ProtectedRoute)
