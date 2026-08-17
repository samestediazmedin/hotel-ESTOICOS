---
phase: 11-internal-screens-restyle
plan: 01
subsystem: frontend/layout
tags: [layout, sidebar, collapse, theme-toggle, status-colors, tokens, chrome]
dependency_graph:
  requires: [phase-09 (globals.css tokens + ThemeToggle + StatusPill)]
  provides:
    - apps/web/src/lib/status-colors.ts (STATUS_COLORS, STATUS_BG_COLORS, RESERVATION_STATUS_TO_CSS)
    - apps/web/src/hooks/useSidebarCollapsed.ts
    - apps/web/src/components/layout/StaffLayout.tsx (topbar shell + bundle chrome)
    - apps/web/src/components/layout/Sidebar.tsx (collapse + accent bar + ThemeToggle)
  affects: [all Wave 2 plans 11-02..11-09 that render inside StaffLayout]
tech_stack:
  added: []
  patterns:
    - useSidebarCollapsed lazy-init pattern (localStorage read in useState initializer — no useEffect)
    - before: pseudo-element active accent bar via Tailwind arbitrary value [3px]
    - NavSection partition pattern (sections inline, NAV_ITEMS unchanged in structure)
key_files:
  created:
    - apps/web/src/lib/status-colors.ts
    - apps/web/src/hooks/useSidebarCollapsed.ts
  modified:
    - apps/web/src/components/layout/StaffLayout.tsx
    - apps/web/src/components/layout/Sidebar.tsx
    - apps/web/src/router.tsx
decisions:
  - "Sidebar uses flex layout (not CSS grid) per 11-RESEARCH Pattern 3 recommendation — avoids double-layer grid complexity"
  - "Nav partitioned into 3 sections inline (no NAV_ITEMS structural change) — cleaner than restructuring the existing flat array"
  - "useSidebarCollapsed: localStorage key 'sidebar-collapsed' (matches plan spec exactly; hos-sidebar-collapsed was the plan suggestion but task spec used sidebar-collapsed)"
  - "before: pseudo-element width set to 3px (plan mentions 2px in CONTEXT.md but 3px in task action spec — used 3px per action spec)"
  - "H mark collapsed branding implemented as inline span (not HotelBranding variant) — simpler, avoids prop changes to HotelBranding"
metrics:
  duration: "~35 minutes"
  completed: "2026-05-17T21:32:05Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 3
---

# Phase 11 Plan 01: Status Colors + Router Fix + StaffLayout + Sidebar Summary

**One-liner:** Bundle chrome with terracotta-tint active state + 200ms collapse + ThemeToggle footer, backed by shared STATUS_COLORS and RESERVATION_STATUS_TO_CSS maps for all Wave 2 consumers.

## What Was Built

### Task 1: Shared Utilities

**`apps/web/src/lib/status-colors.ts`** (new)
- `STATUS_COLORS: Record<RoomStatus, string>` — 6 room statuses → `var(--status-*)` CSS variables
- `STATUS_BG_COLORS: Record<RoomStatus, string>` — same keys → `var(--status-*-bg)` variants
- `ReservationStatus` type union (frontend-only — no Prisma import)
- `RESERVATION_STATUS_TO_CSS: Record<ReservationStatus, string>` — CONFIRMED→reserved, CHECKED_IN→occupied, CHECKED_OUT→maintenance, NO_SHOW→blocked, CANCELLED→ink-4, PENDING→cleaning
- Zero hex literals. All values reference CSS variables for dark mode compatibility.

**`apps/web/src/hooks/useSidebarCollapsed.ts`** (new)
- `useSidebarCollapsed(): { collapsed: boolean; toggle: () => void }`
- Initial state via `useState` lazy initializer — no `useEffect` needed
- `SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'` exported for tests
- Toggle writes to localStorage before state update

### Task 2: router.tsx ProtectedRoute Token Fix

Closed Phase 9 deferred debt (09-04-SUMMARY documented the deferral):
- `bg-bg-base` → `bg-warm-paper`
- `text-text-muted` → `text-ink-3`

### Task 3: StaffLayout + Sidebar Restyle

**StaffLayout.tsx:**
- Wrapped with `.hos` class for CSS variable scope
- Added 56px empty topbar shell: `h-14 shrink-0 bg-warm-white border-b border-warm-line`
- `min-w-0` on inner flex column prevents overflow during collapse animation
- ChatPanel mount preserved unchanged

**Sidebar.tsx — full restyle:**
- Collapse: `w-60 ↔ w-16` via `transition-[width] duration-200 ease-in-out`
- State: `useSidebarCollapsed()` hook (localStorage-persisted)
- Active nav: `bg-terracotta-tint text-terracotta-deep` + `before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:bg-terracotta before:rounded-r`
- Inactive nav: `text-ink-2 hover:bg-warm-cream hover:text-ink-1`
- Icons: `h-4 w-4 shrink-0` with active/inactive color inherited from parent text color
- Nav sections: PRINCIPAL (Dashboard, Reservas, Huéspedes) / OPERACIÓN (Housekeeping, Habitaciones, Tipos de hab.) / ADMINISTRACIÓN (Tarifas, Temporadas, Reportes, Usuarios, Concierge)
- Section labels hidden when collapsed
- Collapsed: H mark only (inline span `bg-terracotta text-warm-white rounded-lg`)
- Footer: `ThemeToggle` (Phase 9) + logout with `LogOut` icon + label hidden when collapsed
- All v1.0 tokens eliminated (`bg-surface`, `border-border-subtle`, `bg-terracota/10`, `text-text-secondary`, `text-text-muted`, `hover:bg-surface-hover`)

## Deviations from Plan

### Minor spec discrepancy — accent bar width

**Found during:** Task 3 implementation
**Issue:** CONTEXT.md (line 130) specifies `before:w-[2px]` but the task action spec (line 243) specifies `before:w-[3px]`.
**Resolution:** Used `3px` per the task action spec (the more specific, later-stage document). Visually negligible — 1px difference.
**Impact:** None on behavior. Wave 2 plans inherit this decision.

### Plan-consistent variation — localStorage key

**Found during:** Task 1 implementation
**Issue:** The `<rules>` block in the execution context mentions `hos-sidebar-collapsed` as the key, but the task action text (line 151) specifies `'sidebar-collapsed'`.
**Resolution:** Used `'sidebar-collapsed'` per the task action spec (task details take precedence over parent rule hints).
**Impact:** None on behavior. SIDEBAR_COLLAPSED_KEY constant exported for tests — any test that checks the key will use the constant.

## Self-Check: PASSED

All created files exist on disk. All 3 commits present in git log:
- `c5a26dc` feat(11-01): create status-colors lib with room + reservation mappings
- `dbbf108` fix(11-01): rename v1.0 tokens to bundle tokens in router ProtectedRoute
- `f90c41b` feat(11-01): restyle StaffLayout + Sidebar to bundle chrome identity
