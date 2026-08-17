---
phase: 11-internal-screens-restyle
plan: 04
subsystem: frontend/reservations
tags: [calendar, room-rack, status-colors, tokens, inline-style]
dependency_graph:
  requires: [11-01 (RESERVATION_STATUS_TO_CSS from status-colors.ts)]
  provides:
    - apps/web/src/features/reservations/components/RoomRackTable.tsx (restyled)
    - apps/web/src/features/reservations/RoomRackCalendar.tsx (re-export — no change needed)
  affects: [ReservationsPage — any consumer of RoomRackCalendar]
tech_stack:
  added: []
  patterns:
    - Inline style for dynamic status color (CSS variable string from RESERVATION_STATUS_TO_CSS)
    - data-status attribute on reservation bars for future CSS hooks and analytics
    - Per-status opacity override (CANCELLED 0.6, NO_SHOW 0.75) via inline style merge
    - Fallback color var(--ink-4) for unmapped ReservationStatus values
key_files:
  created: []
  modified:
    - apps/web/src/features/reservations/components/RoomRackTable.tsx
decisions:
  - "Inline style (backgroundColor: CSS variable) chosen over data-status CSS rule approach per PLAN.md spec and CONTEXT decision #8 — enables dynamic status resolution at runtime without additional CSS rules"
  - "ReservationStatus import consolidated to @/lib/status-colors — previous import from reservations.api.ts was a parallel definition; cast (as ReservationStatus) resolves structural equivalence"
  - "CANCELLED and NO_SHOW bars use opacity inline style (0.6 / 0.75) rather than Tailwind opacity utilities — avoids conflict with the hover:opacity-90 transition"
  - "Fallback var(--ink-4) applied for undefined status values — prevents invisible transparent bars if backend adds new status values before frontend mapping is updated"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-17T22:10:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 1
---

# Phase 11 Plan 04: RoomRackTable Status-Tokened Bars (INT-03) Summary

**One-liner:** RoomRackTable calendar restyled with RESERVATION_STATUS_TO_CSS inline-style bars, font-mono headers, today-column terracotta highlight, and hover outline-terracotta states.

## What Was Built

### Task 1: Restyle RoomRackTable + RoomRackCalendar

**`apps/web/src/features/reservations/components/RoomRackTable.tsx`** (modified)

**Removed:**
- Local `STATUS_COLORS` record containing Tailwind palette classes (`bg-blue-500`, `bg-green-500`, `bg-gray-400`, `bg-yellow-400`, `bg-gray-200`, `bg-red-300`)
- All v1.0 tokens: `border-border-subtle`, `bg-surface-elevated`, `bg-surface`, `text-text-secondary`, `text-text-primary`, `text-text-muted`, `bg-brand-primary/10`, `text-brand-primary`, `hover:bg-blue-50`, `focus:ring-brand-primary`

**Added:**
- `import { RESERVATION_STATUS_TO_CSS, type ReservationStatus } from '@/lib/status-colors'`
- Date header row: `bg-warm-cream border-b border-warm-line` with `font-mono text-xs` day labels
- Today column: `bg-terracotta-tint text-terracotta-deep` conditional
- Room row headers: `font-mono text-sm text-ink-1`
- Reservation bars: `backgroundColor: RESERVATION_STATUS_TO_CSS[status as ReservationStatus] ?? 'var(--ink-4)'`
- Per-status opacity: CANCELLED = 0.6, NO_SHOW = 0.75 (inline style)
- `data-status` attribute on every bar for future CSS hooks
- Hover state: `hover:opacity-90 hover:outline hover:outline-2 hover:outline-terracotta`
- Empty cell: `bg-warm-white border-warm-line hover:bg-warm-cream`
- Focus ring: `focus:ring-terracotta`

**`apps/web/src/features/reservations/RoomRackCalendar.tsx`** (no change)
- Pure re-export wrapper — no JSX, no v1.0 tokens to migrate.

### Task 2: Regression — Reservations Tests

Zero test files found in `src/features/reservations/` — vitest exits 0 with `--passWithNoTests`. Consistent with PLAN.md note (line 176: "per RESEARCH line 118, there are no test files for RoomRackTable in v1.0").

## Acceptance Criteria — Verification

| Criterion | Result |
|-----------|--------|
| Zero hex literals in target files | PASS (0 matches) |
| Zero Tailwind palette bg-* classes | PASS (0 matches) |
| `from '@/lib/status-colors'` import present | PASS (1 match) |
| `RESERVATION_STATUS_TO_CSS[` used | PASS (1 match) |
| `font-mono` at least 2 matches | PASS (4 matches: header label, day number, month abbr, room number) |
| `bg-terracotta-tint` present (today/selected) | PASS (1 match) |
| `outline-terracotta` present (hover) | PASS (1 match) |
| TypeScript compiles without errors (target files) | PASS |
| Vitest reservations suite | PASS (no tests — exits 0) |

## Deviations from Plan

None — plan executed exactly as written. The `RoomRackCalendar.tsx` wrapper required no changes (pure re-export, as the plan anticipated on line 89: "apply only token renames (none likely needed)").

## Notes for Wave 3

- Pre-existing TypeScript error in `HousekeepingPage.tsx` (`Property 'elapsedLabel' does not exist on type 'BoardRoomTask'`) is out of scope — belongs to 11-06. Documented here to prevent false attribution.
- The `ReservationStatus` type from `reservations.api.ts` and `@/lib/status-colors` are structurally identical (same 6 string literals). The cast `as ReservationStatus` is a formality, not a type coercion risk.

## Self-Check: PASSED

- `apps/web/src/features/reservations/components/RoomRackTable.tsx` — exists and modified
- `apps/web/src/features/reservations/RoomRackCalendar.tsx` — exists (unchanged, as expected)
- Commit `fa5c402` present in git log
