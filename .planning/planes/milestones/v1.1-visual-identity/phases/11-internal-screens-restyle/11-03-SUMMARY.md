---
phase: 11-internal-screens-restyle
plan: 03
subsystem: frontend/reporting
tags: [dashboard, recharts, kpi-cards, css-variables, visual-restyle, tokens]
dependency_graph:
  requires:
    - phase-09 (globals.css tokens — warm-paper, warm-line, ink-*, terracotta, mustard, olive)
    - 11-01 (apps/web/src/lib/status-colors.ts — STATUS_COLORS map)
  provides:
    - apps/web/src/features/reporting/DashboardPage.tsx (Instrument Serif heading + bundle chrome)
    - apps/web/src/features/reporting/KpiCard.tsx (warm-paper bg + font-mono value + delta indicator)
    - apps/web/src/features/reporting/OccupancyBarChart.tsx (per-bar terracotta/mustard via shape prop)
    - apps/web/src/features/reporting/RoomStatusDonut.tsx (slices via STATUS_COLORS from lib)
  affects: []
tech_stack:
  added: []
  patterns:
    - Recharts v2 shape prop pattern for per-bar conditional fill (CSS var strings, not Tailwind classes)
    - statusKey discriminant added to donut data items (RoomStatus union) for type-safe STATUS_COLORS lookup
    - KpiCard tone prop retained for backward-compat, ignored in render — documented as deprecated
key_files:
  created: []
  modified:
    - apps/web/src/features/reporting/DashboardPage.tsx
    - apps/web/src/features/reporting/KpiCard.tsx
    - apps/web/src/features/reporting/OccupancyBarChart.tsx
    - apps/web/src/features/reporting/RoomStatusDonut.tsx
decisions:
  - "Recharts bar color uses shape prop (not Cell inside Bar) — Cell inside Bar is a Recharts v2 pitfall (ignored)"
  - "isToday computed from businessDate.slice(0,10) === todayIso — handles both ISO date and ISO datetime formats in snapshots"
  - "KpiCard prop kept as 'title' (not renamed to 'label') — DashboardPage.test.tsx queries by title text and renaming would break 8 tests"
  - "tone prop accepted but not rendered — backward-compat for any caller that still passes it; delta prop added for new delta indicator"
  - "Error banner uses inline style with CSS vars (terracotta-tint/terracotta-soft) — avoids arbitrary Tailwind values and keeps no-hex rule"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 4
---

# Phase 11 Plan 03: DashboardPage + KpiCard + Recharts Theming Summary

**One-liner:** Dashboard INT-02 restyled with Instrument Serif italic heading, font-mono KPI values on warm-paper cards, Recharts bars in terracotta (today) / mustard (others) via shape prop, and donut slices consuming shared STATUS_COLORS CSS variables.

## What Was Built

### Task 1: DashboardPage + KpiCard Restyle

**DashboardPage.tsx** — full token migration pass:
- Page background: `bg-bg-base` → `bg-warm-paper`
- Page heading: `text-2xl font-semibold text-text-primary "Dashboard"` → `font-display italic text-3xl text-ink-1 "Buen día"` (Instrument Serif italic, INT-02 contract)
- Subtitle: `text-text-muted` → `text-ink-3`
- Chart container panels: `bg-surface border-border-subtle shadow-sm` → `bg-warm-paper border-warm-line` (no shadow)
- Chart section headings: `text-text-secondary` → `text-ink-2`
- Skeleton: `bg-stone-200` (Tailwind palette) → `bg-warm-cream`
- Error banner: inline CSS vars instead of `bg-red-50 border-red-200 text-red-700`
- Added section divider (`border-t border-warm-line my-8`) between KPI grid and charts

**KpiCard.tsx** — full restyle:
- Container: `bg-surface border-border-subtle shadow-sm p-5` → `bg-warm-paper border-warm-line rounded-xl p-4` (shadow removed per Phase 9 decision)
- Label: `text-xs text-text-brand` → `text-[11px] uppercase tracking-widest text-ink-3`
- Value: `text-3xl font-semibold text-text-primary` → `font-mono text-3xl text-ink-1`
- Added `delta?: number` prop — renders `↑ N%` in `text-olive` or `↓ N%` in `text-terracotta`
- `tone` prop: accepted for backward-compat but not rendered (deprecated — `delta` replaces it)
- `subtitle` prop: preserved, now renders with `text-ink-3`

### Task 2: Recharts Charts Restyle

**OccupancyBarChart.tsx** — CSS variable color injection:
- Added `isToday: boolean` to chartData transform — compares `d.businessDate.slice(0,10)` with `todayIso`
- `<Bar fill="#c45a3a" />` → `shape` prop pattern (Recharts Pattern 2):
  ```tsx
  shape={(props: any) => (
    <rect ... fill={props.payload?.isToday ? 'var(--terracotta)' : 'var(--mustard)'} rx={4} />
  )}
  ```
- `CartesianGrid stroke="#e5e0d8"` → `stroke="var(--warm-line-strong)"`
- `XAxis` / `YAxis` tick fill → `var(--ink-3)`
- `Tooltip` contentStyle: `warm-white` bg + `warm-line` border + `ink-1` text
- Empty state: `text-text-muted` → `text-ink-3`
- Partial footnote: `text-text-muted` → `text-ink-3`

**RoomStatusDonut.tsx** — STATUS_COLORS import:
- Removed local `STATUS_COLORS: Record<string, string>` with 4 hex literals
- Added `import { STATUS_COLORS } from '@/lib/status-colors'`
- Data items now carry `statusKey: RoomStatus` discriminant:
  - `Ocupadas` → `statusKey: 'occupied'`
  - `Limpieza` → `statusKey: 'cleaning'`
  - `Mantenimiento` → `statusKey: 'maintenance'`
  - `Disponibles` → `statusKey: 'available'`
- `<Cell fill={STATUS_COLORS[entry.name] ?? '#9ca3af'}>` → `<Cell fill={STATUS_COLORS[entry.statusKey]}>`
- Tooltip contentStyle matches BarChart tokens
- Empty state: `text-text-muted` → `text-ink-3`

### Task 3: Regression Suite

All 21 tests in `src/features/reporting/` passed (includes `DashboardPage.test.tsx`, `OccupancyBarChart.test.tsx`, `ReportExportPage.test.tsx`).

## Deviations from Plan

### Minor — KpiCard prop name preserved (title, not label)

**Found during:** Task 1 read-first
**Issue:** Plan spec uses `label` as the KpiCard prop name, but the existing component uses `title` and `DashboardPage.test.tsx` (8 tests) queries by title text. Renaming would break the test suite.
**Fix:** Kept `title` prop name. Added `delta` prop as specified.
**Impact:** Zero — both prop names are semantically equivalent. Label vs title is a naming preference.
**Commit:** f8eb1b5

### Pre-existing TypeScript errors outside lane (not fixed)

**Found during:** Task 1 verification
**Issue:** `HousekeepingPage.tsx` has 2 TS errors (`elapsedLabel` property missing on `BoardRoomTask`) — not caused by this plan's changes, not in reporting lane.
**Action:** Logged as out-of-scope. Zero reporting-directory TypeScript errors confirmed.

## Self-Check: PASSED

Files exist on disk:
- `apps/web/src/features/reporting/DashboardPage.tsx` — FOUND
- `apps/web/src/features/reporting/KpiCard.tsx` — FOUND
- `apps/web/src/features/reporting/OccupancyBarChart.tsx` — FOUND
- `apps/web/src/features/reporting/RoomStatusDonut.tsx` — FOUND

Commits in git log:
- `f8eb1b5` refactor(11-03): restyle DashboardPage + KpiCard to bundle tokens — FOUND
- `45d1b44` feat(11-03): restyle Recharts charts with CSS variable color tokens — FOUND

Test results: 21/21 PASSED
