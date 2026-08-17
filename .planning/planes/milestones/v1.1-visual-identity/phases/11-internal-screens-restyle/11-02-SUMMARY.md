---
phase: 11-internal-screens-restyle
plan: 02
subsystem: frontend/auth
tags: [login, split-panel, layout, tokens, auth, int-01]
dependency_graph:
  requires: [phase-11-01 (StaffLayout chrome + status-colors)]
  provides:
    - apps/web/src/features/auth/LoginPage.tsx (INT-01 split-panel design)
  affects: [first impression for all staff accessing /login]
tech_stack:
  added: []
  patterns:
    - Split-panel grid (lg:grid-cols-2) with decorative left panel hidden on mobile
    - Radial-gradient blobs via inline style (CSS variable references — no hex)
    - font-mono on email Input via className prop forwarding (Phase 9 Input pattern)
    - Three-stat strip hardcoded for v1.1 (42 habitaciones, 78% ocupación, 12 check-ins hoy)
key_files:
  created: []
  modified:
    - apps/web/src/features/auth/LoginPage.tsx
    - apps/web/src/features/auth/LoginPage.spec.tsx
decisions:
  - "Three-stat strip hardcoded per CONTEXT specifics decision — real /api/login-stats endpoint deferred to v1.2"
  - "Inline style for radial-gradient blobs: CSS custom properties (var(--terracotta), var(--mustard)) inside style attribute — no hex literals, dark mode compatible"
  - "spec button query updated from /ingresar/i to /entrar/i — test aligned with new button copy, not a logic change"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-17T21:46:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
---

# Phase 11 Plan 02: LoginPage Split-Panel (INT-01) Summary

**One-liner:** INT-01 split-panel restyle — decorative ink-1 left panel with terracotta/mustard blobs and Instrument Serif headline; warm-white right panel with existing auth form wired to terracotta Button variant.

## What Was Built

### Task 1: Restyle LoginPage as split-panel

**`apps/web/src/features/auth/LoginPage.tsx`** (modified)

Rewrote the JSX return from centered-card (`bg-bg-base flex items-center justify-center`) to the INT-01 split-panel layout.

**Structure:**
- Root: `<div className="hos min-h-screen grid lg:grid-cols-2 bg-warm-paper">` — `.hos` class ensures CSS variable scope for this non-StaffLayout route
- Left `<aside className="hidden lg:flex ...">`: only visible at lg+ breakpoints. Contains decorative radial-gradient blobs (terracotta top-left, mustard bottom-right at 30% opacity), H mark logo + hotelName in Instrument Serif, headline `Hospitalidad, <i>operada con inteligencia</i>`, and three-stat strip with `font-mono` numbers in `text-mustard`
- Right `<main className="flex items-center justify-center bg-warm-white p-8">`: HotelBranding component, email/password inputs, auth error alert, submit button with `variant="terracotta"`, `<Link to="/">` for "Ir al sitio del hotel"

**Preserved verbatim (zero logic changes):**
- `loginSchema`, `LoginFormData` type
- `useAuth()` destructure (`login`, `isLoading`, `error`)
- `useState('Hotel Sumapaz')` + `useEffect` fetching `/system-config/public`
- `useForm` config with `zodResolver(loginSchema)`
- `register`, `handleSubmit`, `formState.errors` wiring
- Both field registrations (`email`, `password`) with their `autocomplete` attributes

**Token migration (v1.0 → bundle):**
- `bg-bg-base` → `bg-warm-paper` (root) / `bg-warm-white` (right panel)
- `bg-surface border border-border-subtle` → removed (card wrapper eliminated by split-panel)
- `text-text-secondary` → `text-ink-2` (labels)
- `text-status-in-progress` → `text-terracotta` (field errors)
- `bg-brand-primary-soft text-text-primary` → `bg-terracotta-soft text-ink-1` (auth error alert)
- Added `variant="terracotta"` on submit Button
- Button text: "Ingresar" → "Entrar"

**Email input:** `className="font-mono"` added — Input component forwards className (Phase 9 pattern), placeholder changed to `admin@hotelsumapaz.co`

### Task 2: Regression — full suite

Ran `pnpm vitest run` in `apps/web`. All 14 test files, 116 tests — green. No regressions.

## Deviations from Plan

### Spec update — button text in LoginPage.spec.tsx

**Found during:** Task 2 verification
**Issue:** `LoginPage.spec.tsx` tests for button with name `/ingresar/i` and the INT-01 design changes button copy to "Entrar". Running tests without updating spec would cause a regression from this plan's own change.
**Fix:** Updated two `getByRole('button', { name: /ingresar/i })` calls to `/entrar/i` in LoginPage.spec.tsx. This is a test alignment to the new copy — not a logic change, not a behavior regression.
**Rule applied:** Rule 1 (auto-fix — broken test from this plan's own changes)
**Files modified:** `apps/web/src/features/auth/LoginPage.spec.tsx`
**Commit:** `6ea26c2` (included in same commit as LoginPage.tsx)

### Pre-existing TypeScript error in HousekeepingPage.tsx (out of scope)

**Found during:** Task 1 TSC check
**Issue:** `HousekeepingPage.tsx(193,41): error TS2339: Property 'elapsedLabel' does not exist on type 'BoardRoomTask'` — pre-existing error from concurrent Wave 2 agent (11-06)
**Action:** Confirmed no TS errors on LoginPage.tsx specifically. Logged here, not fixed. Out of scope for this plan.

## Self-Check: PASSED

Files exist on disk:
- `apps/web/src/features/auth/LoginPage.tsx` — FOUND
- `apps/web/src/features/auth/LoginPage.spec.tsx` — FOUND
- `.planning/phases/11-internal-screens-restyle/11-02-SUMMARY.md` — FOUND

Commit exists: `6ea26c2` — feat(11-02): restyle LoginPage as INT-01 split-panel design
