---
phase: 16-guest-detail-deep-links-contact-events
plan: 0
subsystem: frontend-infra
tags: [toast, dependencies, sonner, date-fns, App.tsx]
dependency_graph:
  requires: []
  provides: [sonner-toast-globally-available, date-fns-relative-time-available]
  affects: [apps/web/src/App.tsx, apps/web/package.json]
tech_stack:
  added: [sonner@^2.0.7, date-fns@^4.1.0]
  patterns: [Toaster-at-app-root-singleton, fragment-sibling-pattern]
key_files:
  created: []
  modified:
    - apps/web/src/App.tsx
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "sonner ^2.0.7 chosen — shadcn-ecosystem default, ~3KB, drop-in API"
  - "date-fns ^4.1.0 — aligned with apps/api version (no duplication in lockfile)"
  - "Toaster placed as sibling to RouterProvider inside fragment — survives route changes, renders via portal above all content"
metrics:
  duration: "4 minutes"
  completed: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 16 Plan 0: Install sonner + date-fns + Mount Toaster Summary

**One-liner:** Wave 0 infra — sonner@2.0.7 + date-fns@4.1.0 installed in apps/web; Toaster mounted as App root singleton with richColors top-right.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install sonner + date-fns | a103da0 | apps/web/package.json, pnpm-lock.yaml |
| 2 | Mount Toaster in App.tsx | 4cd2760 | apps/web/src/App.tsx |

## Verification Results

| Check | Result |
|-------|--------|
| `sonner` in apps/web/package.json | ^2.0.7 |
| `date-fns` in apps/web/package.json | ^4.1.0 (matches apps/api) |
| `npx tsc --noEmit` | exit 0 — 0 errors |
| `npx vitest run` | 14 files, 116 tests — all pass |

## App.tsx Diff

**Before (6 lines):**
```tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

export default function App() {
  return <RouterProvider router={router} />;
}
```

**After (11 lines):**
```tsx
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './router';

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </>
  );
}
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] apps/web/package.json contains "sonner" and "date-fns"
- [x] apps/web/src/App.tsx contains `<Toaster`
- [x] Commits a103da0 and 4cd2760 exist
- [x] TypeScript clean (exit 0)
- [x] 116/116 tests green
