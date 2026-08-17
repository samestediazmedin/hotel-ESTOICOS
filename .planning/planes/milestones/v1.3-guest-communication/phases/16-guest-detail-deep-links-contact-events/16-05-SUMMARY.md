---
phase: 16-guest-detail-deep-links-contact-events
plan: 5
subsystem: frontend
tags: [react, tanstack-query, date-fns, react-router, guests, last-contact, navigation]
dependency_graph:
  requires: [16-02, 16-03]
  provides: [GuestsPage-ultimo-contacto-column, GuestsPage-row-navigation]
  affects: [apps/web/src/features/guests/GuestsPage.tsx, apps/web/src/features/guests/guests.api.ts]
tech_stack:
  added: []
  patterns: [date-fns formatDistanceToNow with es locale, react-router useNavigate for row click]
key_files:
  created:
    - apps/web/src/features/guests/GuestsPage.spec.tsx
  modified:
    - apps/web/src/features/guests/GuestsPage.tsx
    - apps/web/src/features/guests/guests.api.ts
decisions:
  - "lastContactEvent imported as LastContactEventSummary from ./types (defined by 16-03) — no type duplication"
  - "handleRowClick rewired to navigate(/guests/:id) — drawer retained exclusively for Nuevo huesped creation flow"
  - "formatLastContact helper uses try/catch to return — for malformed ISO dates from server"
  - "colSpan updated 5 → 6 on all three placeholder rows (loading/error/empty)"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-19"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  tests_added: 10
  tests_total_suite: 28
---

# Phase 16 Plan 5: GuestsPage "Último contacto" column + row navigation Summary

**One-liner:** Extended GuestsPage.tsx with a 6th column showing Spanish relative time via date-fns (`formatDistanceToNow` + `es` locale) and rewired row click from drawer-open to `navigate(/guests/:id)`.

## What Was Built

### Task 1: GuestResponseDto + GuestPublicDto extended in guests.api.ts

Added `import type { LastContactEventSummary } from './types'` and added the field to both interfaces:

```typescript
lastContactEvent: LastContactEventSummary | null;
```

`LastContactEventSummary` was already defined in `16-03` with shape `{ method: ContactMethod; createdAt: string; staffUserName: string | null }`. No type duplication — single source of truth in `types.ts`.

Both DTOs now match the backend 16-02 payload exactly.

### Task 2: GuestsPage.tsx — column + navigation

**Imports added:**
- `useNavigate` from `react-router-dom`
- `formatDistanceToNow` from `date-fns`
- `es` from `date-fns/locale`

**Helper added:**
```typescript
function formatLastContact(event: { createdAt: string } | null | undefined): string {
  if (!event) return 'Nunca';
  try {
    return formatDistanceToNow(new Date(event.createdAt), { locale: es, addSuffix: true });
  } catch {
    return '—';
  }
}
```

**handleRowClick rewired:**
```typescript
// BEFORE (opened drawer)
const handleRowClick = (guest: AnyGuestDto) => {
  setSelectedGuest(guest); setDrawerOpen(true);
};

// AFTER (navigates to detail)
const handleRowClick = (guest: AnyGuestDto) => {
  navigate(`/guests/${guest.id}`);
};
```

Drawer state and `handleNewGuest` / `handleDrawerClose` retained — drawer opens only from the "Nuevo huésped" button (create flow).

**Column added** (6th position, after Teléfono):
```tsx
<th>Último contacto</th>
// ...
<td>{formatLastContact(guest.lastContactEvent)}</td>
```

**colSpan** updated from 5 → 6 on all three placeholder rows.

### GuestsPage.spec.tsx (new file — 10 tests)

| # | Behavior | Result |
|---|----------|--------|
| 1 | 6 column headers including "Último contacto" | PASS |
| 2 | Guest with no events shows "Nunca" | PASS |
| 3 | Guest with event shows Spanish relative time (matches /hace/i) | PASS |
| 4 | Malformed date shows "—" (try/catch fallback) | PASS |
| 5 | Row click calls navigate("/guests/:id") | PASS |
| 6 | Row click does NOT open drawer | PASS |
| 7 | "Nuevo huésped" button opens drawer | PASS |
| 8 | Loading row has colSpan=6 | PASS |
| 9 | Error row has colSpan=6 | PASS |
| 10 | Empty row has colSpan=6 | PASS |

## Unchanged Behavior Confirmed

- Search debounce — no changes to `handleSearchChange` or `searchTimerRef`
- Pagination — `useGuests(debouncedSearch)` call unchanged
- HOUSEKEEPING role gate — `!isHousekeeping` guard on "Nuevo huésped" button unchanged
- `lastContactEvent` is part of `GuestPublicDto` (toPublicDto exposes it per 16-02 decision) — visible to HOUSEKEEPING role

## Deviations from Plan

None. Plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- `apps/web/src/features/guests/GuestsPage.tsx` — MODIFIED (navigate + formatLastContact + 6th column)
- `apps/web/src/features/guests/guests.api.ts` — MODIFIED (lastContactEvent on both DTOs)
- `apps/web/src/features/guests/GuestsPage.spec.tsx` — CREATED (10 tests)

Commits verified:
- `b34e664`: feat(16-05): extend GuestResponseDto + GuestPublicDto with lastContactEvent
- `2eeb4a1`: feat(16-05): GuestsPage Último contacto column + row navigation

Test results: 28/28 green (10 new + 18 pre-existing guests feature tests).
TypeScript: `tsc --noEmit` exit 0.
Zero hex colors in GuestsPage.tsx.
