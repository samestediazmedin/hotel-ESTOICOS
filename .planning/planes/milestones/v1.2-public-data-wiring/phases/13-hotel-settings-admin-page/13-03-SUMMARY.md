---
phase: 13-hotel-settings-admin-page
plan: 03
subsystem: web/settings
tags: [react, tanstack-query, react-hook-form, zod, radix-ui, shadcn, settings]
dependency_graph:
  requires: [13-01]
  provides: [settings-page, hotel-info-form, textarea-primitive, alert-dialog-primitive]
  affects: [apps/web/src/router.tsx, apps/web/src/components/layout/Sidebar.tsx]
tech_stack:
  added: ["@radix-ui/react-alert-dialog@^1.1.15"]
  patterns: [react-hook-form + zodResolver, TanStack Query GET + PATCH mutation, inline role gate, shadcn-style forwardRef primitives]
key_files:
  created:
    - apps/web/src/components/ui/textarea.tsx
    - apps/web/src/components/ui/alert-dialog.tsx
    - apps/web/src/features/settings/types.ts
    - apps/web/src/features/settings/hotel-settings.api.ts
    - apps/web/src/features/settings/hooks/useAdminSystemConfig.ts
    - apps/web/src/features/settings/hooks/useUpdateSystemConfig.ts
    - apps/web/src/features/settings/components/TagsInput.tsx
    - apps/web/src/features/settings/components/HotelInfoForm.tsx
    - apps/web/src/features/settings/HotelSettingsPage.tsx
  modified:
    - apps/web/src/router.tsx
    - apps/web/src/components/layout/Sidebar.tsx
decisions:
  - "Inline role gate in HotelSettingsPage (not router-level) — ProtectedRoute has no roles prop"
  - "SlidersHorizontal icon for Configuracion nav item — avoids collision with Settings icon used by Usuarios"
  - "Empty-string stripping in updateSystemConfig API call — avoids backend E.164 regex failure on blank phone"
  - "mutation.reset() called alongside reset(initial) in Cancel handler — clears error/success banner state"
metrics:
  duration_seconds: 350
  completed_date: "2026-05-18"
  tasks_completed: 3
  tasks_total: 3
  files_created: 9
  files_modified: 2
---

# Phase 13 Plan 03: Settings Page + HotelInfoForm + TagsInput + Sidebar Nav Summary

**One-liner:** Admin settings page at /settings/hotel with 6-field react-hook-form + zodResolver, TanStack Query GET/PATCH hooks that invalidate the public portal cache, TagsInput chip component, and two new shadcn primitives (Textarea + AlertDialog).

## What Was Built

Three tasks executed cleanly, all TypeScript-clean at exit.

### Task 1 — shadcn Primitives (commit 6e5bad0)

Created `textarea.tsx` as a `forwardRef` component matching the `input.tsx` token pattern (`border-warm-line-strong bg-warm-paper text-ink-1 focus-visible:ring-terracotta`). Created `alert-dialog.tsx` as a full Radix wrapper exposing all 9 named exports required by the Plan 13-03 artifacts contract. Installed `@radix-ui/react-alert-dialog@^1.1.15` as the Radix primitive backing.

### Task 2 — Settings Feature (commit 5dc74c2)

| File | Purpose |
|------|---------|
| `types.ts` | `HotelInfoSchema` (Zod v4) + `AdminSystemConfig` interface |
| `hotel-settings.api.ts` | `fetchAdminSystemConfig` + `updateSystemConfig` (strips empty strings before PATCH) |
| `useAdminSystemConfig.ts` | `queryKey: ['admin', 'system-config']`, staleTime 30s |
| `useUpdateSystemConfig.ts` | PATCH mutation; onSuccess sets admin cache + invalidates `['public', 'hotel-info']` |
| `TagsInput.tsx` | Chip input: Enter/comma adds tag, Backspace removes last, X removes chip |
| `HotelInfoForm.tsx` | 6 fields with zodResolver, inline success/error banners, Cancel resets to last-saved |

### Task 3 — Page + Router + Sidebar (commit 2e14710)

`HotelSettingsPage.tsx` mounts at `/settings/hotel` with an inline ADMIN role gate (403 surface for non-admins), skeleton loader, and error retry. Added `settings/hotel` route inside `ProtectedRoute > StaffLayout` children. Added `SlidersHorizontal` icon + `Configuración` nav item to the ADMINISTRACIÓN section in `Sidebar.tsx` — visible only when `user.role === 'ADMIN'`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing behavior] Empty string stripping in updateSystemConfig**
- **Found during:** Task 2 implementation
- **Issue:** PLAN.md threat model (section "Form submitting empty optional fields") flagged that blank phone `''` would fail the backend E.164 regex. The plan suggested transforming `'' → undefined` in the mutation hook. 
- **Fix:** Applied the transform in `hotel-settings.api.ts` (cleaner separation — API layer handles protocol concerns). Strips `tagline`, `description`, and `phone` if empty before the PATCH call.
- **Files modified:** `apps/web/src/features/settings/hotel-settings.api.ts`
- **Commit:** 5dc74c2

**2. [Rule 2 - Missing behavior] mutation.reset() in Cancel handler**
- **Found during:** Task 2 — reviewing Cancel button behavior
- **Issue:** Plan specified `reset(initial)` for Cancel. Without also calling `mutation.reset()`, a previous error/success banner would persist after the user clicks Cancel.
- **Fix:** Added `mutation.reset()` call alongside `reset(initial)` in the Cancel `onClick`.
- **Files modified:** `apps/web/src/features/settings/components/HotelInfoForm.tsx`
- **Commit:** 5dc74c2

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Inline role gate (not router-level) | `ProtectedRoute` has no `roles` prop — confirmed in research. Inline gate is Pattern 5 from RESEARCH.md. Backend is the actual security boundary. |
| `SlidersHorizontal` for Configuración | `Settings` icon already used by Usuarios. `SlidersHorizontal` is the first recommendation in RESEARCH.md Pitfall #7. |
| Empty-string stripping in API layer | Cleaner than transforming in the mutation hook. Backend Zod regex requires ≥7 chars OR field absent; empty string fails both. |
| `queryClient.setQueryData` + `invalidateQueries` in onSuccess | `setQueryData` avoids a redundant GET round-trip; `invalidateQueries` for public portal ensures cache-busting regardless of staleTime. |

## Success Criteria Verification

| Criterion | Status |
|-----------|--------|
| `/settings/hotel` route exists in router | PASS |
| Form prefills with admin GET endpoint data | PASS — `useAdminSystemConfig` + `useEffect(reset)` |
| Non-admin sees in-page 403 surface | PASS — inline `role !== 'ADMIN'` gate |
| After save, `['public', 'hotel-info']` invalidated | PASS — `useUpdateSystemConfig.onSuccess` |
| Sidebar shows "Configuración" only for ADMIN | PASS — `roles: ['ADMIN']` in `NAV_SECTIONS` |
| Sidebar uses `SlidersHorizontal` icon | PASS |
| `Textarea` primitive available for Plan 13-04 | PASS |
| `AlertDialog` primitive available for Plan 13-04 | PASS |
| `pnpm --filter web tsc --noEmit` exit 0 | PASS |

## Self-Check: PASSED

All 9 created files verified present. All 3 commits verified in git log. TypeScript exit 0 confirmed.
