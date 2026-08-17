---
phase: 10-public-portal
plan: 04
subsystem: frontend/public-portal
tags: [reservation-widget, react-day-picker, responsive, mobile-bar, desktop-sidebar]
requirements: [PUB-10, PUB-12]

dependency-graph:
  requires:
    - apps/web/src/features/public-portal/hooks/useReservationDraft.ts (10-01)
    - apps/web/src/features/public-portal/data/roomTypes.ts (10-01)
    - apps/web/src/components/ui/button.tsx (phase 9)
    - apps/web/src/lib/date.ts (pre-existing, extended)
  provides:
    - apps/web/src/features/public-portal/components/ReservationWidget.tsx
    - apps/web/src/features/public-portal/components/ReservationDatePicker.tsx
    - apps/web/src/lib/date.ts (extended with fromLocalISODate + formatShortDateEs)
  affects:
    - 10-02 (HotelHomePage shell) — imports ReservationWidget twice (sidebar + mobile bar)

tech-stack:
  added: []
  patterns:
    - react-day-picker v10 range mode with es locale (react-day-picker/locale — no date-fns)
    - CSS import colocated in component (not global) to avoid .rdp-* leak
    - variant prop switches layout (same React tree, CSS-driven — PUB-12)
    - URL-param-backed state via useReservationDraft (shared when mounted twice)
    - iOS safe-area inset via pb-[env(safe-area-inset-bottom)]

key-files:
  created:
    - apps/web/src/features/public-portal/components/ReservationDatePicker.tsx
    - apps/web/src/features/public-portal/components/ReservationWidget.tsx
  modified:
    - apps/web/src/lib/date.ts (added fromLocalISODate + formatShortDateEs)

decisions:
  - "formatDate.ts NOT created — toLocalISODate already existed in apps/web/src/lib/date.ts; extended that file with fromLocalISODate + formatShortDateEs instead of duplicating"
  - "Mobile picker is inline expandable (not a Popover/Dialog) — avoids adding shadcn Popover dep; UX equivalent for a bottom bar context"
  - "GuestCounter clamps 1..10 via hook setAdults (which already clamps with Math.max/min) — component adds disabled prop on buttons as secondary guard"
  - "rangeForPicker handles partial selection (checkIn set, checkOut not yet) by passing { from, to: undefined } to DayPicker — prevents the picker from losing the from selection mid-interaction"

metrics:
  duration: "~20 min"
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 10 Plan 04: ReservationWidget + ReservationDatePicker + date helpers Summary

Reservation widget — two layout variants from a single React component. Captures check-in/check-out + guest count and navigates to `/booking/rooms` with URL params.

## What Was Built

### `ReservationDatePicker.tsx`

Thin wrapper over react-day-picker v10:

```tsx
import { DayPicker } from 'react-day-picker';
import { es } from 'react-day-picker/locale';       // NOT date-fns
import 'react-day-picker/dist/style.css';             // colocated, not global

<DayPicker
  mode="range"
  selected={range}
  onSelect={onChange}
  disabled={{ before: new Date() }}
  numberOfMonths={numberOfMonths}   // 1 (mobile) or 2 (desktop)
  locale={es}
  classNames={{ range_start, range_end, range_middle, day_button, today }}
/>
```

Token utilities only in `classNames`. No hex. No date-fns dependency.

### `ReservationWidget.tsx`

| Variant | Layout | DayPicker months | Notes |
|---------|--------|-----------------|-------|
| `desktop-sidebar` | Rounded card, flex-col | 2 | Opened inline via toggle button |
| `mobile-bar` | `fixed bottom-0`, `lg:hidden` | 1 | `pb-[env(safe-area-inset-bottom)]` for iOS notch |

Both variants:
- Share state via `useReservationDraft()` (URL params — refresh-safe, shareable)
- `GuestCounter` component: `-` / `+` buttons, 1..10 range, lucide icons
- Price: `Desde $280k / noche` from `getCheapestRoom().pricePerNight`
- `Button variant="terracotta"` disabled when `!canCommit`
- `onClick={commit}` → navigates to `/booking/rooms?checkIn=X&checkOut=Y&adults=N`

### `apps/web/src/lib/date.ts` (extended)

Added two helpers:

```typescript
export function fromLocalISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);   // LOCAL midnight — not UTC
}

export function formatShortDateEs(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(date);
}
```

## Decisions Made

### Decision 1: Extend `lib/date.ts` instead of creating `formatDate.ts`

`apps/web/src/lib/date.ts` already exported `toLocalISODate` with full timezone documentation. Adding `fromLocalISODate` and `formatShortDateEs` to the same file avoids duplicating the timezone-safety comments and keeps all date helpers in one discoverable location.

`formatDate.ts` under `utils/` was NOT created — the `utils/` directory was created but left empty (can be removed or populated by other plans).

### Decision 2: Inline expandable picker on mobile (no Popover/Dialog)

The mobile bottom bar opens the DayPicker inline via a `pickerOpen` state toggle, expanding the bar upward with `max-h-[60vh] overflow-y-auto`. This avoids adding shadcn/ui `Popover` as a dependency and matches the natural UX of a bottom sheet on mobile.

### Decision 3: Partial range support in `rangeForPicker`

When only `checkIn` is set (user picked start, hasn't picked end yet), `rangeForPicker` passes `{ from: Date, to: undefined }` rather than `undefined`. This preserves the DayPicker's visual "start selected" state during mid-selection interaction.

### Decision 4: URL params as shared state between two mounted instances

When `HotelHomePage` mounts `ReservationWidget` twice (desktop sidebar + mobile bar), both instances call `useReservationDraft()` which reads from `useSearchParams()`. Because both instances read the same URL, changes in one immediately reflect in the other — no additional state sync needed.

## Variant API

```typescript
<ReservationWidget variant="desktop-sidebar" />
// → Rendered inside <aside class="hidden lg:block"><div class="sticky top-20">

<ReservationWidget variant="mobile-bar" />
// → Rendered at the bottom of HotelHomePage JSX, renders fixed bottom bar
```

Both are mounted in `HotelHomePage` (implemented by plan 10-02). State is shared automatically via URL params.

## Commits

| Hash | Description |
|------|-------------|
| `6cfae4a` | feat(10-04): add ReservationDatePicker + extend lib/date with fromLocalISODate + formatShortDateEs |
| `79a4629` | feat(10-04): create ReservationWidget with desktop-sidebar and mobile-bar variants |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notable Reuse

**[Reuse] `toLocalISODate` from `@/lib/date` instead of new `utils/formatDate.ts`**
- Found during: Task 1
- `apps/web/src/lib/date.ts` already exported the required function
- Extended with `fromLocalISODate` + `formatShortDateEs` rather than creating a duplicate file
- Commit: `6cfae4a`

## Self-Check

Files verified:
- apps/web/src/features/public-portal/components/ReservationDatePicker.tsx — FOUND
- apps/web/src/features/public-portal/components/ReservationWidget.tsx — FOUND
- apps/web/src/lib/date.ts (extended) — FOUND

Commits verified:
- 6cfae4a — FOUND
- 79a4629 — FOUND

TypeScript: `pnpm tsc --noEmit` → exit 0
No hex colors: `rg "#[0-9a-fA-F]{3,6}"` → 0 matches in both files

## Self-Check: PASSED
