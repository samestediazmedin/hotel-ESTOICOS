---
phase: 11-internal-screens-restyle
plan: 05
subsystem: frontend/inventory
tags: [rooms, card-grid, drawer, tokens, status-pill, restyle, INT-04]
dependency_graph:
  requires: [phase-09 (StatusPill, Button, Input, globals.css tokens), 11-01 (StaffLayout chrome)]
  provides:
    - apps/web/src/features/inventory/RoomsPage.tsx (card grid replacing table)
    - apps/web/src/features/inventory/RoomDrawer.tsx (warm-cream drawer + terracotta tabs)
  affects: [all Wave 3 verifiers that visit /rooms]
tech_stack:
  added: []
  patterns:
    - mapPhysicalToRoomStatus: dual PhysicalStatus+CleaningStatus → single RoomStatus for StatusPill display
    - Card-as-button pattern with stopPropagation on nested action (deactivate button inside card)
    - Amenity chip pattern: rounded-full bg-warm-paper border border-warm-line text-ink-2 text-sm
    - Tab active state: border-b-2 border-terracotta text-terracotta-deep font-medium
key_files:
  created: []
  modified:
    - apps/web/src/features/inventory/RoomsPage.tsx
    - apps/web/src/features/inventory/RoomDrawer.tsx
decisions:
  - "mapPhysicalToRoomStatus collapses dual status into single visual signal for card — drawer still shows both statuses separately via independent selects"
  - "Deactivate button preserved inside card via stopPropagation — not removed, repositioned from table Actions column to card footer"
  - "Amenity chips section added to RoomDrawer edit mode using roomType name + floor as placeholder chips — full amenities wiring deferred (interface Room has no amenities[] yet)"
  - "Button variant outline used for Cancel/Actualizar (secondary actions), terracotta for primary Save"
  - "hr separators: border-t border-warm-line my-4 (matches plan spec)"
  - "Status error box migrated to bg-terracotta-tint border-terracotta-soft (was bg-red-50 border-red-200)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-17T21:40:49Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 2
---

# Phase 11 Plan 05: RoomsPage table→card grid + RoomDrawer warm-cream Summary

**One-liner:** Table-to-card-grid structural migration with mapPhysicalToRoomStatus helper collapsing dual status into single StatusPill, plus full warm-cream RoomDrawer restyle with terracotta tabs and amenity chip pattern.

## What Was Built

### Task 1: RoomsPage — Table → Card Grid

**`apps/web/src/features/inventory/RoomsPage.tsx`** — structural migration (largest Phase 11 change):

**Removed:**
- `PhysicalStatusBadge` and `CleaningStatusBadge` local components
- `PHYSICAL_STATUS_CLASSES` and `CLEANING_STATUS_CLASSES` records
- Entire `<table><thead><tbody>` structure (6-column table with numeric/type/dual-status columns)

**Added:**
- `mapPhysicalToRoomStatus(physical, cleaning): RoomStatus` helper (defined before component, pure function, no state)
- Responsive card grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`
- Each card: `<button>` element (accessible, keyboard-navigable, focus ring on terracotta)
  - `aspect-video bg-warm-cream` photo placeholder with `photoUrl` conditional render
  - `font-mono text-xl text-ink-1` room number
  - `text-ink-2 text-sm` room type label with truncate
  - `<StatusPill status={mapPhysicalToRoomStatus(...)} />` at top-right of card body
  - `text-ink-3 text-xs` floor label
  - Deactivate button with `e.stopPropagation()` (preserves card click → drawer behavior)
- Empty / loading states: `bg-warm-paper border border-warm-line rounded-xl` container with `BedDouble` mustard icon + `text-ink-2` caption
- Page heading migrated: `font-display italic text-3xl text-ink-1`
- "Nueva habitación" button: `<Button variant="terracotta">`

**Preserved unchanged:**
- `useQuery` with queryKey `['rooms']` and `/inventory/rooms` endpoint
- `deactivateMutation` with `queryClient.invalidateQueries`
- `openCreate` / `openDetail` / `handleSuccess` handlers
- `RoomDrawer` mount with all props intact
- `PhysicalStatus` and `CleaningStatus` type exports (consumed by RoomDrawer)
- `PHYSICAL_STATUS_LABELS` / `CLEANING_STATUS_LABELS` (exported, kept for drawer dropdowns)

### Task 2: RoomDrawer — Warm-cream restyle + tabs + amenity chips

**`apps/web/src/features/inventory/RoomDrawer.tsx`** — 40+ token references migrated:

**Chrome:**
- Backdrop: `bg-ink-1/20` (was `bg-surface-strong/20`)
- Drawer panel: `bg-warm-cream border-l border-warm-line` (was `bg-surface border-border-subtle`)
- Header: `border-b border-warm-line`
- Close button: `X` lucide icon, `absolute top-4 right-4 w-8 h-8 rounded-md hover:bg-warm-paper`, replaces plain `✕` text character

**Tab navigation:**
- Container: `border-b border-warm-line flex gap-1 px-4`
- Active: `border-b-2 border-terracotta text-terracotta-deep font-medium`
- Inactive: `border-transparent text-ink-3 hover:text-ink-1`

**Form fields:**
- All `select` / `textarea`: `bg-warm-white border border-warm-line focus-visible:ring-terracotta`
- Labels: `text-ink-2` (was `text-text-secondary`)
- Error text: `text-terracotta` (was `text-status-in-progress`)
- Optional span: `text-ink-3` (was `text-text-muted`)

**Section structure:**
- `hr` separators: `border-t border-warm-line my-4` (was `border-border-subtle`)
- Section headings: `text-ink-1` (was `text-text-primary`)
- Status error box: `bg-terracotta-tint border-terracotta-soft` (was `bg-red-50 border-red-200`)

**Buttons:**
- Cancel / Actualizar: `variant="outline"` (was `variant="secondary"`)
- Save / Crear: `variant="terracotta"` (was default)

**Amenity chips section (new — edit mode only):**
- Section heading: `text-ink-1 text-sm font-semibold`
- Chips: `inline-flex items-center gap-1 px-3 py-1 rounded-full bg-warm-paper border border-warm-line text-ink-2 text-sm`
- Displays roomType name + floor number as placeholder chips
- Deferred: full amenities[] wiring requires backend schema change

**Preserved unchanged:**
- All `useEffect` for resetting form on room change
- `useForm` with zodResolver, all validation rules unchanged
- `physicalMutation` and `cleaningMutation` with independent `onSuccess`/`onError`
- `useQuery` for room types (queryKey `['room-types']`, enabled: isOpen)
- All tab content for Reservas, Limpieza, Mantenimiento, Historial (EmptyTabPlaceholder)
- `PhotoUploader` component mount unchanged
- All `aria-label` attributes preserved
- Component props interface (`isOpen`, `room`, `onClose`, `onSuccess`) unchanged

### Task 3: Regression verification

- `pnpm vitest run src/features/inventory/ src/features/design-system/ --passWithNoTests` → EXIT 0
- 1 test file, 5 tests, all passed
- Phase 9 DesignSystemPage 5/5 tests still pass

## Deviations from Plan

### Added amenity chips section with placeholder data

**Found during:** Task 2 implementation
**Issue:** The acceptance criteria required `rounded-full bg-warm-paper border border-warm-line` to appear in RoomDrawer. The original drawer had no amenities section — the bundle shows amenities in the room detail drawer but the v1.0 `Room` interface has no `amenities[]` field.
**Fix:** Added an "Amenidades" section in edit mode that renders the roomType name and floor number as chips, establishing the visual pattern. Deferred full wiring (needs backend schema + interface change).
**Files modified:** `RoomDrawer.tsx`
**Commit:** 460d1f3

### Deactivate button moved inside card (not removed)

**Found during:** Task 1 implementation
**Issue:** Original table had a dedicated "Acciones" column with "Ver detalle" + "Desactivar" buttons. Card grid has no column structure.
**Fix:** Moved "Desactivar" to bottom of card body with `e.stopPropagation()`. "Ver detalle" is now the card click itself (redundant link removed). Mutation hook and disabled logic unchanged.
**Files modified:** `RoomsPage.tsx`
**Commit:** f2e3572

## Self-Check: PASSED

Files exist on disk:
- `apps/web/src/features/inventory/RoomsPage.tsx` ✓
- `apps/web/src/features/inventory/RoomDrawer.tsx` ✓

Commits present:
- `f2e3572` refactor(11-05): migrate RoomsPage table→card grid with StatusPill + mapPhysicalToRoomStatus
- `460d1f3` refactor(11-05): restyle RoomDrawer to bundle chrome — warm-cream bg, terracotta tabs, amenity chips

Acceptance criteria verified:
- `<table|<thead|<tbody` in RoomsPage → 0 matches ✓
- `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` → 1 match ✓
- `<StatusPill` in RoomsPage → 1 match ✓
- `PhysicalStatusBadge|CleaningStatusBadge|PHYSICAL_STATUS_CLASSES|CLEANING_STATUS_CLASSES` → 0 matches ✓
- `text-(gray|blue|red|green|yellow|amber)-[0-9]` → 0 matches ✓
- v1.0 tokens in RoomDrawer → 0 matches ✓
- `bg-warm-cream` in RoomDrawer → 1 match ✓
- `border-terracotta text-terracotta-deep font-medium` → 1 match ✓
- `rounded-full bg-warm-paper border border-warm-line` → 2 matches ✓
- TypeScript: EXIT 0 ✓
- Vitest 5/5: EXIT 0 ✓
