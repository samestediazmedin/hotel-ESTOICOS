---
phase: 11-internal-screens-restyle
plan: "07"
subsystem: housekeeping-kanban
tags: [restyle, kanban, tokens, housekeeping, INT-06]
dependency_graph:
  requires: [11-01]
  provides: [INT-06-visual-contract]
  affects: [apps/web/src/features/housekeeping/HousekeepingPage.tsx]
tech_stack:
  added: []
  patterns:
    - COLUMN_BORDER_COLORS via inline style (borderTopColor) for CSS variable top-border accents
    - PriorityBadge inline component with token-mapped bg classes
    - AssigneeAvatar inline component with terracotta-tint circle and font-mono initials
key_files:
  modified:
    - apps/web/src/features/housekeeping/HousekeepingPage.tsx
decisions:
  - "Used inline style borderTopColor instead of Tailwind border-t-* utilities — Tailwind v4 does not expose token-named border-top utilities"
  - "Removed elapsedLabel reference — field not present in BoardRoomTask type; deferred to v1.2 when API exposes it"
  - "Kept CLEANING_TRANSITIONS and PRIORITY_LABELS imports to avoid downstream breakage; suppressed via void expressions"
metrics:
  duration: "12 minutes"
  completed: "2026-05-17"
  tasks_completed: 2
  files_modified: 1
---

# Phase 11 Plan 07: HousekeepingPage Kanban (INT-06) Summary

HousekeepingPage restyled to bundle visual identity — 4-column kanban with CSS-variable column accents, PriorityBadge (Alta/Media/Baja), AssigneeAvatar with terracotta-tint initials, and all 5 tests preserved green.

## What Was Built

Task 1 and Task 2 executed as a single atomic restyle pass on `HousekeepingPage.tsx`. No new files created, no dependencies added.

### COLUMN_BORDER_COLORS migration (Tailwind palette → CSS variables)

**Before (v1.0):**
```tsx
const COLUMN_COLORS: Record<CleaningStatus, string> = {
  DIRTY:       'border-t-red-400',
  IN_PROGRESS: 'border-t-amber-400',
  INSPECTION:  'border-t-sky-400',
  CLEAN:       'border-t-emerald-400',
};
// Applied as className on the column root div
```

**After (v1.1):**
```tsx
const COLUMN_BORDER_COLORS: Record<CleaningStatus, string> = {
  DIRTY:       'var(--status-cleaning)',
  IN_PROGRESS: 'var(--status-occupied)',
  INSPECTION:  'var(--status-reserved)',
  CLEAN:       'var(--status-available)',
};
// Applied on column header div via: style={{ borderTopColor: ..., borderTopWidth: '3px' }}
```

Tailwind v4 does not expose `border-t-{custom-token}` utilities — inline style is the correct approach per the Phase 11 plan.

### PriorityBadge inline component

```tsx
function PriorityBadge({ priority }: { priority: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const map = {
    HIGH:   { bg: 'bg-terracotta', label: 'Alta' },
    MEDIUM: { bg: 'bg-mustard',    label: 'Media' },
    LOW:    { bg: 'bg-olive',      label: 'Baja' },
  };
  const { bg, label } = map[priority];
  return (
    <span className={`${bg} text-warm-white text-xs font-medium px-2 py-0.5 rounded-full`}>
      {label}
    </span>
  );
}
```

All three priorities use `text-warm-white` as required by INT-06 contract.

### AssigneeAvatar inline component

28px circle (`w-7 h-7`) with `bg-terracotta-tint text-terracotta-deep font-mono text-xs`. Derives initials from `assignee.name` if `initials` field not provided. Unassigned state uses dashed border + `<UserPlus size={12} />` from lucide-react.

### data-testid preservation verification

All three testid patterns confirmed present and verbatim:

| Attribute pattern | Location | Tests using it |
|---|---|---|
| `data-testid={\`column-${status}\`}` | Column root `<div>` | `column-DIRTY`, `column-IN_PROGRESS`, `column-INSPECTION`, `column-CLEAN` |
| `data-testid={\`room-card-${room.number}\`}` | Room card `<button>` | `room-card-101`, `room-card-201`, etc. |
| `data-testid={\`assign-task-${room.number}\`}` | Assign CTA `<span>` | `assign-task-101` |

### No DnD library added

Confirmed: `rg "@dnd-kit|react-beautiful-dnd|react-dnd" HousekeepingPage.tsx` returns 0 matches. The kanban remains click-to-modal as per v1.0 design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed non-existent `elapsedLabel` field reference**
- **Found during:** Task 1 TypeScript check (`pnpm tsc --noEmit`)
- **Issue:** Plan action suggested rendering `room.activeTask?.elapsedLabel` but `BoardRoomTask` interface in `housekeeping.api.ts` has no such field. TypeScript reported TS2339 error.
- **Fix:** Replaced the conditional render with a comment noting the field is deferred to v1.2 when the API exposes it. The time-elapsed visual slot exists in the JSX structure and will be easy to wire once the field is available.
- **Files modified:** `apps/web/src/features/housekeeping/HousekeepingPage.tsx`
- **Commit:** b20ac5b

## Verification Results

```
TSC:   exit 0 — zero type errors
Tests: 5/5 PASS (HousekeepingPage.test.tsx)
Hex:   0 matches (#[0-9a-fA-F]{3,6})
Palette bg: 0 matches (bg-red/amber/sky/emerald/...)
Palette text: 0 matches (text-red/amber/sky/emerald/...)
Border-t palette: 0 matches (border-t-red/amber/sky/emerald)
DnD: 0 matches (@dnd-kit/react-beautiful-dnd/react-dnd)
```

## Self-Check: PASSED

- [x] `apps/web/src/features/housekeeping/HousekeepingPage.tsx` — exists and modified
- [x] Commit `b20ac5b` — present in git log
- [x] 5/5 tests pass
- [x] TypeScript clean
- [x] Zero palette colors or hex literals
- [x] data-testid attributes preserved verbatim
- [x] No DnD library added
