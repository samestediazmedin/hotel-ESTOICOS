---
phase: 09-design-system-foundation
plan: 04
subsystem: design-system
tags: [demo-route, vitest, smoke-test, design-system, dev-only-route, theme-toggle]
dependency_graph:
  requires: [09-01, 09-02, 09-03]
  provides: [design-system-demo-route, vitest-smoke-coverage, phase-9-closeout]
  affects: [apps/web/src/features/design-system, apps/web/src/router.tsx]
tech_stack:
  added:
    - "@testing-library/user-event ^14.6.1 (devDep — was missing)"
  patterns: [dev-only-route-conditional-spread, matchmedia-polyfill-setup, tdd-green]
key_files:
  created:
    - apps/web/src/features/design-system/DesignSystemPage.tsx
    - apps/web/src/features/design-system/DesignSystemPage.test.tsx
  modified:
    - apps/web/src/router.tsx
    - apps/web/src/test-setup.ts
    - apps/web/package.json (devDep added)
    - pnpm-lock.yaml
decisions:
  - "Demo route is dev-only via import.meta.env.DEV conditional spread — production builds tree-shake the DesignSystemPage import entirely"
  - "matchMedia polyfill added to test-setup.ts (global) — not per-test-file, so it covers useTheme in any future component test"
  - "5 test cases: render, status-pill x6 with Spanish labels, data-theme toggle, localStorage persistence, button variant labels x7"
  - "@testing-library/user-event installed as devDep (was absent — Rule 3 auto-fix)"
metrics:
  duration_minutes: 5
  completed_date: "2026-05-17"
  tasks_completed: 3
  files_modified: 6
---

# Phase 09 Plan 04: Dev-only /design-system Route + Vitest Smoke (VIS-01..05) Summary

**One-liner:** Dev-only `/design-system` demo route rendering all Phase 9 primitives (Button x7 variants, Card, Input, Badge x7, StatusPill x6, ThemeToggle) with 5/5 Vitest smoke tests passing — Phase 9 vertical slice verified end-to-end.

---

## Goal

Provide the MVP vertical slice verification surface for Phase 9: a single dev-only route mounting every primitive, every status variant, and the theme toggle on one page. Proves the foundation works before Phase 10/11 consume it. Also delivers Vitest smoke coverage (VIS-03, VIS-04, VIS-05 test assertions).

---

## Changes

### Files Created (2 new)

| File | Role |
|------|------|
| `apps/web/src/features/design-system/DesignSystemPage.tsx` | Named export `DesignSystemPage` — 6 sections: Botones, Tarjetas, Inputs, Badges, Estados de habitación, Tipografía y paleta cálida |
| `apps/web/src/features/design-system/DesignSystemPage.test.tsx` | 5 Vitest smoke tests — render, status pills, data-theme toggle, localStorage, button variants |

### Files Modified (4 edits)

| File | Change |
|------|--------|
| `apps/web/src/router.tsx` | Added `devRoutes` conditional spread + `DesignSystemPage` import; route at `/design-system` outside ProtectedRoute |
| `apps/web/src/test-setup.ts` | Added `window.matchMedia` polyfill for jsdom compatibility |
| `apps/web/package.json` | Added `@testing-library/user-event ^14.6.1` as devDep |
| `pnpm-lock.yaml` | Lock file updated for new devDep |

---

## Decisions Made

### 1. Demo Route: `devRoutes` Conditional Spread

**Decision:** Used the `devRoutes` array pattern (declare before `createBrowserRouter`, spread with `...devRoutes`) rather than an inline ternary inside `children`.

**Why:** The inline spread pattern `...(import.meta.env.DEV ? [...] : [])` required a TypeScript `as const` cast that produced a `readonly RouteObject[]` vs `RouteObject[]` mismatch in some TypeScript strict mode setups. The named-array pattern is cleaner, equally tree-shakeable by Vite/Rollup, and reads more clearly at the call site.

**Production verification:** `pnpm vite build` exits 0 (4.18s). The production bundle was not inspected for the `DesignSystemPage` identifier — the Vite static `import.meta.env.DEV === false` branch elimination is a documented guarantee.

### 2. matchMedia Polyfill in test-setup.ts (Global)

**Decision:** Added polyfill to `apps/web/src/test-setup.ts` (the shared Vitest `setupFiles` entry), not per-test-file.

**Why:** `useTheme` calls `window.matchMedia('(prefers-color-scheme: dark)')` in `getInitialTheme`. jsdom does not implement `matchMedia`. Any future component test that mounts `ThemeToggle` (or any component using `useTheme`) would fail without the polyfill. Placing it globally prevents future footguns. The polyfill always returns `matches: false` — consistent with light mode as default.

### 3. 5 Test Cases — Minimal Smoke Coverage

**Decision:** 5 tests: (a) render, (b) status pills x6 Spanish labels, (c) data-theme flip, (d) localStorage persistence, (e) button variant labels x7.

**Why:** The PLAN specified exactly these 5. They cover the three highest-value behavioral invariants of Phase 9: theme toggle wiring (VIS-03), status pill set (VIS-04), and component renders (VIS-05). This is smoke coverage — not exhaustive. The tests are fast (1.33s total), idempotent, and isolated via `beforeEach` localStorage + attribute reset.

### 4. @testing-library/user-event Installed (Rule 3)

**Decision:** Auto-installed `@testing-library/user-event ^14.6.1` as devDependency.

**Why:** The package was referenced in the PLAN and required by the test but was not present in `apps/web/package.json`. The existing tests (`HousekeepingPage.test.tsx`, etc.) do not use `userEvent` — they use `fireEvent`. This plan introduces `userEvent` for the first time (needed for accurate `click` simulation with event bubbling for the toggle button).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Missing Dep] Installed @testing-library/user-event**
- **Found during:** Task 2 — Vitest run failed with `Failed to resolve import "@testing-library/user-event"`
- **Fix:** `pnpm add -D @testing-library/user-event` in `apps/web`
- **Files modified:** `apps/web/package.json`, `pnpm-lock.yaml`
- **Commit:** `8b2f202`

**2. [Rule 3 - Missing Polyfill] Added matchMedia stub to test-setup.ts**
- **Found during:** Task 2 — second test run failed with `TypeError: window.matchMedia is not a function`
- **Root cause:** `useTheme.getInitialTheme()` calls `window.matchMedia` synchronously in `useState` initializer. jsdom does not implement this API.
- **Fix:** Added mock returning `{ matches: false }` in `apps/web/src/test-setup.ts`
- **Files modified:** `apps/web/src/test-setup.ts`
- **Commit:** `8b2f202`

---

## matchMedia Polyfill: Applied

Polyfill was required and applied to `test-setup.ts`. See Decision #2 above.

---

## Verification

| Check | Command | Result |
|-------|---------|--------|
| 5/5 tests pass | `pnpm vitest run src/features/design-system/DesignSystemPage.test.tsx` | 5 PASSED |
| TypeScript clean | `pnpm tsc --noEmit -p tsconfig.json` | EXIT 0 |
| Production build | `pnpm vite build` | EXIT 0 (4.18s) |
| Zero hex in Phase 9 scope | `rg "#[0-9a-fA-F]{3,6}" components/ui components/layout/StaffLayout.tsx hooks features/design-system` | 0 matches in CSS classes (1 match in JSDoc comment — informative only) |
| Route outside ProtectedRoute | Line check `router.tsx` | `/design-system` at L52, ProtectedRoute at L100 |
| Route has import.meta.env.DEV guard | `rg "import.meta.env.DEV" router.tsx` | 1 match |

---

## Phase 9 Closeout — Safe to Import in Phase 10/11

All of the following are now verified by the demo page rendering without runtime errors:

| Export | File | Verified by |
|--------|------|-------------|
| `Button`, `buttonVariants` | `@/components/ui/button` | Demo page renders 7 variants × 4 sizes |
| `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent` | `@/components/ui/card` | Demo page full composition |
| `Input` | `@/components/ui/input` | Demo page 3 inputs |
| `Badge`, `badgeVariants` | `@/components/ui/badge` | Demo page 7 variants |
| `StatusPill`, `STATUS_LABELS`, `type RoomStatus` | `@/components/ui/status-pill` | Demo page + test asserts all 6 |
| `ThemeToggle` | `@/components/ui/theme-toggle` | Demo page + test asserts data-theme flip |
| `useTheme`, `type Theme`, `STORAGE_KEY` | `@/hooks/useTheme` | Test asserts localStorage persistence |

---

## Outstanding Tech Debt (Deferred)

### 1. ProtectedRoute Loading State — Deferred to Phase 11

`apps/web/src/router.tsx` lines 29-31 (ProtectedRoute component) still use `bg-bg-base` and `text-text-muted` — v1.0 token names that no longer exist in the bundle. These classes silently fail (no utility generated), rendering a transparent background + invisible text during session restore.

**Deferred to Phase 11** (internal screens restyle). Fix: rename to `bg-warm-paper` and `text-ink-3`.

### 2. 33 Feature-Page Files — Deferred to Phase 10/11

As documented in Plan 09-01 SUMMARY, 33 feature-screen files still reference v1.0 token names. Phase 9's scope covered only `components/ui/`, `components/layout/StaffLayout.tsx`, `styles/globals.css`, `design/tokens*`, `index.html`, and `features/design-system/`.

Categories deferred to Phase 10/11:
- Public booking (4 files), Reporting (4 files), Inventory (3 files), Reservations (6 files)
- Operations (4 files), Housekeeping (3 files), AI/Concierge (7 files), Admin (2 files)

---

## Self-Check: PASSED

Files exist:
- `apps/web/src/features/design-system/DesignSystemPage.tsx` — FOUND
- `apps/web/src/features/design-system/DesignSystemPage.test.tsx` — FOUND
- `apps/web/src/router.tsx` (modified) — FOUND
- `apps/web/src/test-setup.ts` (modified) — FOUND

Commits exist:
- `000308b` feat(09-04): create DesignSystemPage demo component
- `8b2f202` test(09-04): Vitest smoke test for DesignSystemPage — 5 passing
- `de7ff50` feat(09-04): mount /design-system route (dev-only, import.meta.env.DEV)
