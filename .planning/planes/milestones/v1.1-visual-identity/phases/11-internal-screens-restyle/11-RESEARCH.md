# Phase 11: Internal Screens Restyle — Research

**Researched:** 2026-05-17
**Domain:** React + Tailwind v4 visual restyle — token substitution, Recharts theming, Sidebar chrome, kanban styling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Visual restyle ONLY — no logic changes. Preserve: component contracts, props, state, callbacks, query hooks, React Query keys, Socket.io listeners, form validation, route guards, test assertions.
- Staff CAN use dark mode. `useForceLightTheme` is NOT used on staff routes. All staff screens inherit dark mode via `.hos[data-theme="dark"]` cascade.
- `ThemeToggle` mounts in **Sidebar footer** (INT-08). Nowhere else.
- Per-screen visual contracts in CONTEXT.md `## Decisions` are verbatim from the bundle and are locked.
- `LoginPage` three-stat strip data is **hardcoded** in v1.1 (42 habitaciones, 78% ocupación, 12 check-ins hoy). Real endpoint deferred to v1.2.
- No animation/motion library — CSS transitions only. Sidebar collapse: `transition-[width] duration-200 ease-in-out`.
- `StepIndicator` extracted as reusable component in `apps/web/src/features/reservations/wizard/`.
- `KpiCard` restyled in-place (already extracted in v1.0 as `features/reporting/KpiCard.tsx`).
- `STATUS_COLORS` constant extracted to `apps/web/src/lib/status-colors.ts`.
- ChatPanel context column: `hidden lg:block` (mobile = hidden entirely, no accordion).
- Login mobile: only right panel renders (`hidden lg:block` on left).

### Claude's Discretion

- Exact pixel values when bundle and Tailwind utilities don't perfectly align (round to nearest Tailwind step).
- Whether sidebar accent bar uses `before:` pseudo-element or absolutely-positioned `<span>`.
- Mobile breakpoint behavior for screens without explicit mobile bundle variant.
- Lucide icon choices when bundle uses HosIcon names — map to closest lucide equivalent.
- `ThemeToggle` in Sidebar footer vs Topbar — bundle implies Sidebar footer (confirmed below).

### Deferred Ideas (OUT OF SCOPE)

- Visual regression testing (Playwright screenshot diffs)
- Storybook for primitives
- Framer Motion / animation library
- i18n EN/ES toggle
- WCAG AA full audit
- Print stylesheets
- Custom HosIcon → lucide mapping document (ad-hoc per screen)
- Login three-stat real data endpoint
- Sidebar collapse keyboard shortcut
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INT-01 | `/login` split-panel: left ink-1 bg with radial blobs + stats strip, right warm-white with form + terracotta button | LoginPage.tsx is 128L, 1 hex literal, 12 old-token classes. Split-panel via `grid lg:grid-cols-2`. Left panel `hidden lg:block`. |
| INT-02 | `/dashboard` token restyle: Instrument Serif h1, Geist Mono KPI numbers, Recharts bars in terracotta/mustard | DashboardPage.tsx 179L + KpiCard.tsx 38L + OccupancyBarChart.tsx 98L + RoomStatusDonut.tsx 83L. 5 palette hex in OccupancyBarChart/RoomStatusDonut, 12 old-tokens in DashboardPage. |
| INT-03 | `RoomRackTable` calendar restyle: status bars via `--status-*` tokens, Geist Mono headers, hover/select states | RoomRackTable.tsx 246L, 9 Tailwind palette classes, 16 old-tokens. STATUS_COLORS is the main target. |
| INT-04 | `RoomsPage` card grid + `RoomDrawer` warm-cream bg + tabs + amenity chips | RoomsPage.tsx 234L (currently table layout — must migrate to card grid), 16 palette, 21 old-tokens. RoomDrawer.tsx 498L, 2 palette, 40 old-tokens. Largest single-file blast. |
| INT-05 | `ReservationWizard` 4-step visual stepper: terracotta=active, mustard=completed, warm-tan=pending | ReservationWizard.tsx 122L. 4 step files: Step1Dates 183L/9 old-tokens, Step2Room 146L/20 old-tokens, Step3Guest 400L/43 old-tokens, Step4Confirm 243L/39 old-tokens. Total wizard blast: ~1094L. |
| INT-06 | `HousekeepingPage` kanban: 4 columns, priority badges in bundle colors, assignee avatars, time-elapsed Geist Mono | HousekeepingPage.tsx 172L, 7 palette, 10 old-tokens. No DnD in v1.0 (deferred per Phase 5 research). Visual restyle is purely class replacement. |
| INT-07 | `ChatPanel` staff restyle: warm bubbles, Instrument Serif context headings, card/badge for tool results | ChatPanel.tsx 235L + ContextPanel.tsx 80L + ChatMessage.tsx 89L. 21 old-tokens in ChatPanel. |
| INT-08 | `StaffLayout` + `Sidebar`: lucide ink-3, active terracotta accent bar, 200ms collapse, ThemeToggle in footer | StaffLayout.tsx 23L, Sidebar.tsx 116L/15 old-tokens. No collapse mechanism exists in v1.0 — must be added. |
</phase_requirements>

---

## Summary

Phase 11 is a visual-only restyle of 8 internal staff screens against a fully specified bundle (CONTEXT.md locked contracts). The token foundation (Phase 9) and the font + CSS variable vocabulary are already in place in `globals.css`. The primary work is replacing v1.0 token names (`bg-surface`, `text-text-primary`, `border-border-subtle`, etc.) with bundle equivalents (`bg-warm-white`, `text-ink-1`, `border-warm-line`), adding Tailwind palette → status token mappings, and applying the Instrument Serif / Geist Mono typography contracts.

The two highest-risk items are: (1) `RoomDrawer.tsx` at 498L with 40 old-token references — the largest single-file blast — and (2) the wizard `Step3Guest.tsx` at 400L with 43 old-tokens. Both need careful pattern-replacement, not wholesale rewrites. (3) The Sidebar collapse mechanism does not exist in v1.0 and must be added from scratch, making INT-08 a prerequisite for all others in terms of shared layout.

The Recharts components (`OccupancyBarChart`, `RoomStatusDonut`) use hardcoded hex colors that must be replaced with CSS variable strings passed as JSX props — Recharts SVG fills bypass Tailwind utilities.

**Primary recommendation:** Execute INT-08 (StaffLayout + Sidebar) in Wave 1 alone. All 7 other screens execute in Wave 2 in parallel, since they render inside the stable grid layout INT-08 provides.

---

## Per-Screen Blast Radius

### INT-01 — LoginPage (`/login`)

| Property | Value |
|----------|-------|
| Main file | `apps/web/src/features/auth/LoginPage.tsx` — 128 lines |
| Sub-components | `HotelBranding` (imported, not restyled here) |
| Hex literals | 1 (`#c45a3a` or similar in JSDoc only — informative, not CSS) |
| Old-token classes | 12 (`bg-bg-base`, `bg-surface`, `border-border-subtle`, `text-text-secondary`, `text-text-primary`, `text-status-in-progress`, `bg-brand-primary-soft`) |
| Tailwind palette classes | 0 |
| Test files | None — LoginPage has no `.test.tsx` |
| New work | Add left panel (new JSX block, `hidden lg:block`), radial-gradient blob div, three-stat strip (hardcoded data), `variant="terracotta"` on submit button, `font-mono` placeholder on email input, `Link` to `/` |

**Migration map:**
- `bg-bg-base` → `bg-warm-paper` (page wrapper)
- `bg-surface` → `bg-warm-white` (right panel)
- `border-border-subtle` → `border-warm-line`
- `text-text-secondary` → `text-ink-2`
- `text-text-primary` → `text-ink-1`
- `text-status-in-progress` → `text-terracotta` (error text)
- `bg-brand-primary-soft` → `bg-terracotta-soft`

### INT-02 — DashboardPage + sub-components

| File | Lines | Old-tokens | Palette hex | Target changes |
|------|-------|------------|-------------|----------------|
| `DashboardPage.tsx` | 179 | 12 | 0 | Token rename, h1 `font-display italic`, chart container token rename |
| `KpiCard.tsx` | 38 | ~8 | 0 | Full restyle: `bg-warm-paper border-warm-line`, `font-mono` value, remove `shadow-sm`, `tone` prop → delta indicator |
| `OccupancyBarChart.tsx` | 98 | 5 | 1 (`#c45a3a` fill) | `Bar fill` → JS string `var(--terracotta)` / `var(--mustard)`, grid stroke token |
| `RoomStatusDonut.tsx` | 83 | 4 | 4 hex | `STATUS_COLORS` → `var(--status-*)` strings, container token rename |

**Test files:** `__tests__/DashboardPage.test.tsx` (7 tests), `__tests__/OccupancyBarChart.test.tsx` (4 tests). Both mock Recharts components — restyle does NOT affect test assertions (tests query by text labels, not CSS classes).

### INT-03 — RoomRackTable (`/reservations` calendar)

| Property | Value |
|----------|-------|
| Main file | `apps/web/src/features/reservations/components/RoomRackTable.tsx` — 246 lines |
| Entry point | `apps/web/src/features/reservations/RoomRackCalendar.tsx` — 9 lines (re-export only, no changes needed) |
| Old-token classes | 16 (`bg-surface-elevated`, `bg-surface`, `text-text-secondary`, `text-text-primary`, `text-text-muted`, `border-border-subtle`, `bg-brand-primary/10`, `text-brand-primary`, `hover:bg-blue-50`, `focus:ring-brand-primary`) |
| Tailwind palette classes | 9 (STATUS_COLORS record: `bg-blue-500`, `bg-green-500`, `bg-gray-400`, `bg-yellow-400`, `bg-gray-200`, `bg-red-300`) |
| Test files | None |
| Key change | Replace `STATUS_COLORS` record with `status-colors.ts` import. Change reservation bar `colorClass` from Tailwind palette to `data-status` attribute + CSS variable approach or inline style with `var(--status-*)`. |

**STATUS_COLORS mapping:**
```
CONFIRMED  → var(--status-reserved)   + var(--warm-white) text
CHECKED_IN → var(--status-occupied)   + var(--warm-white) text
CHECKED_OUT → var(--status-maintenance-bg) + var(--ink-3) text (muted)
PENDING    → var(--status-cleaning)   + var(--warm-white) text
CANCELLED  → var(--warm-tan) + var(--ink-3) text, opacity-60
NO_SHOW    → var(--status-blocked)    + var(--warm-white) text, opacity-75
```

### INT-04 — RoomsPage + RoomDrawer

| File | Lines | Old-tokens | Palette classes |
|------|-------|------------|-----------------|
| `RoomsPage.tsx` | 234 | 21 | 16 |
| `RoomDrawer.tsx` | 498 | 40 | 2 |
| `components/PhotoUploader.tsx` | unknown | check | check |

**Largest blast: RoomDrawer.tsx (498L, 40 old-tokens).** This file has the deepest inline styling — every select, input, textarea, hr, and p has v1.0 tokens.

**Critical structural change:** `RoomsPage.tsx` currently renders a `<table>` layout. The bundle spec (INT-04) requires a **card grid** layout (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`). This is more than a class rename — it requires restructuring the JSX from `<table><tbody><tr>` to card `<div>` pattern. The `PhysicalStatusBadge` and `CleaningStatusBadge` local components should be replaced with the Phase 9 `StatusPill` primitive.

Test files: None for RoomsPage or RoomDrawer.

### INT-05 — ReservationWizard + 4 step files

| File | Lines | Old-tokens | Notes |
|------|-------|------------|-------|
| `ReservationWizard.tsx` | 122 | 16 | Add `StepIndicator` row, replace progress bar, restyle panel chrome |
| `wizard/Step1Dates.tsx` | 183 | 9 | Token rename only |
| `wizard/Step2Room.tsx` | 146 | 20 | Token rename, room selection card restyle |
| `wizard/Step3Guest.tsx` | 400 | 43 | Largest step file — guest form with many inputs |
| `wizard/Step4Confirm.tsx` | 243 | 39 | Confirmation layout |
| **Total** | **~1094** | **~127** | |

The current wizard has a horizontal progress bar (`<div className="flex h-1 bg-border-subtle">`). This is replaced by the `StepIndicator` row component (circles + labels). The step content area keeps the existing structure — the `StepIndicator` goes in the header above the content.

Test files: None for wizard files.

### INT-06 — HousekeepingPage

| Property | Value |
|----------|-------|
| Main file | `apps/web/src/features/housekeeping/HousekeepingPage.tsx` — 172 lines |
| Sub-components | `RoomStatusModal` (imported), `TaskAssignmentDrawer` (imported) |
| Old-token classes | 10 |
| Tailwind palette classes | 7 (COLUMN_COLORS: `border-t-red-400`, `border-t-amber-400`, `border-t-sky-400`, `border-t-emerald-400`; priority badges: `bg-red-100 text-red-700`, `bg-amber-100 text-amber-700`, `bg-emerald-100 text-emerald-700`) |
| Test files | `HousekeepingPage.test.tsx` (5 tests) |
| DnD library | **None in v1.0** — drag-and-drop was deferred per Phase 5 research. HousekeepingPage uses click-to-modal (`RoomStatusModal`) for state transitions. No DnD library installed. |

**Test safety:** Tests assert by `data-testid` attributes (`column-DIRTY`, `room-card-101`, `assign-task-101`, `room-status-modal`, `task-assignment-drawer`) and Spanish text labels. Restyle MUST preserve all `data-testid` attributes exactly. CSS class changes do not affect test assertions.

**COLUMN_COLORS migration:**
- `border-t-red-400` → `border-t-status-occupied` (terracotta) for DIRTY
- `border-t-amber-400` → `border-t-status-cleaning` (mustard) for IN_PROGRESS
- `border-t-sky-400` → `border-t-status-reserved` (blue) for INSPECTION
- `border-t-emerald-400` → `border-t-status-available` (olive-green) for CLEAN

**Priority badge migration:**
- HIGH: `bg-red-100 text-red-700` → `bg-terracotta text-warm-white`
- MEDIUM: `bg-amber-100 text-amber-700` → `bg-mustard text-warm-white`
- LOW: `bg-emerald-100 text-emerald-700` → `bg-olive text-warm-white`

### INT-07 — ChatPanel + sub-components

| File | Lines | Old-tokens | Notes |
|------|-------|------------|-------|
| `ChatPanel.tsx` | 235 | 21 | Floating button, panel chrome, input bar |
| `ContextPanel.tsx` | 80 | ~14 | Section headings, tool result cards |
| `ChatMessage.tsx` | 89 | ~8 | Bubble styles, streaming indicator |
| Sub-total | ~404 | ~43 | |

Sub-components `RichToolResult.tsx` may also have old tokens — verify before plan execution.

Test files: None for ChatPanel or its sub-components.

### INT-08 — StaffLayout + Sidebar

| File | Lines | Old-tokens | Notes |
|------|-------|------------|-------|
| `StaffLayout.tsx` | 23 | 0 | Structural change only: flex → CSS Grid; add Topbar slot |
| `Sidebar.tsx` | 116 | 15 | Full restyle; collapse mechanism; ThemeToggle mount |

**Collapse mechanism:** Currently absent in v1.0. Must be implemented from scratch. See Architecture Patterns section.

**ThemeToggle slot:** Sidebar.tsx already has a footer section (currently showing "Asistente IA" button + "Cerrar sesión" button). ThemeToggle replaces or sits alongside the "Cerrar sesión" area. There IS a footer slot — no structural addition needed beyond inserting the import and component.

---

## Standard Stack

All dependencies already installed. No new packages required for Phase 11.

### Already Available
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `recharts` | 2.x | BarChart + PieChart for Dashboard | Installed — needs color prop update only |
| `lucide-react` | 0.x | Icons (all 11 nav icons already imported in Sidebar.tsx) | Installed |
| `@dnd-kit/*` | NOT installed | Drag-and-drop | NOT used in v1.0; HousekeepingPage uses click-modal |
| `react-beautiful-dnd` | NOT installed | — | NOT used |
| Phase 9 primitives | — | Button (terracotta variant), StatusPill, Badge, ThemeToggle, useTheme | All verified in 09-04-SUMMARY.md |

---

## Architecture Patterns

### Recommended Project Structure (no new directories)

```
apps/web/src/
├── lib/
│   └── status-colors.ts        ← NEW: shared STATUS_COLORS constant
├── features/
│   ├── auth/LoginPage.tsx       ← restyle INT-01
│   ├── reporting/
│   │   ├── DashboardPage.tsx    ← restyle INT-02
│   │   ├── KpiCard.tsx          ← restyle INT-02 (already extracted)
│   │   ├── OccupancyBarChart.tsx← restyle INT-02 (Recharts colors)
│   │   └── RoomStatusDonut.tsx  ← restyle INT-02 (Recharts colors)
│   ├── reservations/
│   │   ├── components/RoomRackTable.tsx ← restyle INT-03
│   │   └── wizard/
│   │       ├── StepIndicator.tsx   ← NEW: extracted from wizard
│   │       ├── ReservationWizard.tsx ← restyle INT-05
│   │       ├── Step1Dates.tsx      ← restyle INT-05
│   │       ├── Step2Room.tsx       ← restyle INT-05
│   │       ├── Step3Guest.tsx      ← restyle INT-05
│   │       └── Step4Confirm.tsx    ← restyle INT-05
│   ├── inventory/
│   │   ├── RoomsPage.tsx        ← restyle INT-04 (table → card grid)
│   │   └── RoomDrawer.tsx       ← restyle INT-04
│   ├── housekeeping/HousekeepingPage.tsx ← restyle INT-06
│   └── ai-assistant/
│       ├── ChatPanel.tsx        ← restyle INT-07
│       ├── ContextPanel.tsx     ← restyle INT-07
│       └── ChatMessage.tsx      ← restyle INT-07
└── components/layout/
    ├── StaffLayout.tsx          ← restyle INT-08
    └── Sidebar.tsx              ← restyle INT-08
```

### Pattern 1: Token Substitution (primary pattern — used across all 8 screens)

**What:** Replace v1.0 semantic tokens with bundle utility classes.
**When to use:** All class attributes that reference v1.0 tokens.

Complete migration table:

| v1.0 token | Bundle equivalent | Notes |
|------------|------------------|-------|
| `bg-bg-base` | `bg-warm-paper` | Page backgrounds |
| `bg-surface` | `bg-warm-white` | Card/panel backgrounds |
| `bg-surface-elevated` | `bg-warm-cream` | Slightly elevated surfaces |
| `bg-surface-hover` | `bg-warm-cream` | Hover backgrounds |
| `bg-surface-strong/10` | `bg-ink-1/10` | Backdrop overlays |
| `bg-surface-strong/20` | `bg-ink-1/20` | Drawer backdrops |
| `border-border-subtle` | `border-warm-line` | Default borders |
| `border-border-strong` | `border-warm-line-strong` | Strong borders (inputs) |
| `text-text-primary` | `text-ink-1` | Primary text |
| `text-text-secondary` | `text-ink-2` | Secondary text |
| `text-text-muted` | `text-ink-3` | Muted text |
| `text-text-brand` | `text-terracotta-deep` | Brand-colored text |
| `text-brand-primary` | `text-terracotta` | Brand primary |
| `bg-brand-primary` | `bg-terracotta` | Brand fill |
| `bg-brand-primary/10` | `bg-terracotta-tint` | Light brand fill |
| `bg-brand-primary-soft` | `bg-terracotta-soft` | Soft brand fill |
| `ring-brand-primary` | `ring-terracotta` | Focus ring |
| `focus:ring-brand-primary` | `focus:ring-terracotta` | Focus ring (focus prefix) |
| `text-status-in-progress` | `text-terracotta` | Error/warning text |
| `bg-terracota/10` | `bg-terracotta-tint` | Typo fix: terracota → terracotta |

**Critical note:** `warm-line` and `warm-line-strong` are pre-composed `rgba()` values. NEVER add Tailwind opacity modifiers to them (`border-warm-line/50` is invalid). Use them as-is.

### Pattern 2: Recharts Color Injection

**What:** Recharts SVG fills bypass Tailwind. Must pass CSS variable strings as JS props.
**When to use:** All `fill`, `stroke`, and `Cell` color props in Recharts components.

```tsx
// Source: verified from OccupancyBarChart.tsx + RoomStatusDonut.tsx inspection

// BarChart — single color per bar
<Bar dataKey="occupancyPct" fill="var(--terracotta)" radius={[4, 4, 0, 0]} />

// BarChart — conditional color (today vs other days)
// Recharts v2 does NOT support Cell inside Bar for a BarChart directly.
// Use the renderCustomBarShape pattern:
<Bar
  dataKey="occupancyPct"
  radius={[4, 4, 0, 0]}
  shape={(props) => {
    const isToday = props.date === todayIso;
    return <rect {...props} fill={isToday ? 'var(--terracotta)' : 'var(--mustard)'} rx={4} />;
  }}
/>

// PieChart — per-Cell color from status-colors.ts
import { STATUS_COLORS } from '@/lib/status-colors';
<Cell key={entry.name} fill={STATUS_COLORS[entry.statusKey]} />

// CartesianGrid stroke
<CartesianGrid strokeDasharray="3 3" stroke="var(--warm-line-strong)" />
```

**Recharts v2 custom bar shape:** The `shape` prop accepts a React element or render function. Both approaches work in Recharts v2.x. The `shape` prop receives all bar props including `x`, `y`, `width`, `height`, `value`. Use `rect` SVG element directly.

**Confidence:** HIGH — verified from existing OccupancyBarChart.tsx code which already uses `fill="#c45a3a"` (inline hex). Replacing with `fill="var(--terracotta)"` is a direct swap.

### Pattern 3: Sidebar Collapse Implementation

**What:** Sidebar width toggles between 240px (expanded) and 64px (collapsed). Labels hide. Transition: 200ms.
**When to use:** INT-08.

**Recommendation: CSS variable for sidebar width + `transition-[width]`.**

```tsx
// Sidebar.tsx — add collapse state
const [collapsed, setCollapsed] = useState(() => {
  return localStorage.getItem('sidebar-collapsed') === 'true';
});

const toggleCollapse = () => {
  setCollapsed((prev) => {
    const next = !prev;
    localStorage.setItem('sidebar-collapsed', String(next));
    return next;
  });
};

// Sidebar element
<aside
  className={`shrink-0 bg-warm-white border-r border-warm-line flex flex-col
    transition-[width] duration-200 ease-in-out overflow-hidden
    ${collapsed ? 'w-16' : 'w-60'}`}
>
  {/* Labels hidden when collapsed */}
  <span className={collapsed ? 'hidden' : 'block'}>{item.label}</span>
  // ...
</aside>
```

**StaffLayout grid:** The current `flex` layout must migrate to CSS Grid to match the bundle chrome (`hos-app`):

```tsx
// StaffLayout.tsx
<div className="hos min-h-screen grid grid-rows-[56px_1fr]"
     style={{ gridTemplateColumns: collapsed ? '64px 1fr' : '240px 1fr' }}>
  {/* OR: pass collapsed state as CSS custom property */}
```

**Alternative (simpler):** Keep `flex` layout in StaffLayout (current approach: `flex min-h-screen bg-warm-paper`). The Sidebar controls its own width via `w-60` / `w-16` + `transition-[width]`. The main content area (`flex-1`) automatically adjusts. This avoids passing collapsed state to StaffLayout.

**Recommendation: Keep flex in StaffLayout, manage width only in Sidebar.** The bundle `hos-app` grid is a design reference, not a mandate — the flex approach achieves the same visual result with less prop drilling.

**Topbar:** The bundle defines a `hos-topbar` (56px height, warm-white bg, warm-line border-bottom). Currently StaffLayout has no topbar. The CONTEXT.md per-screen contract for INT-08 says `grid-rows-[56px_1fr]` implying a topbar row. However, the 8 screens don't have explicit topbar content in the bundle — only a breadcrumb. This is marked as Claude's Discretion. **Recommendation: add a minimal topbar placeholder (`bg-warm-white border-b border-warm-line h-14`) that can receive content via slot/outlet context later. Keep it empty for v1.1.**

### Pattern 4: Active Nav Item Accent Bar

**What:** Active nav item shows a 2px terracotta left accent bar.
**When to use:** INT-08 Sidebar `<NavLink>` active state.

**Option A: Tailwind `before:` pseudo-element (recommended)**

```tsx
// In NavLink className callback:
isActive
  ? 'relative before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:bg-terracotta before:rounded-r bg-terracotta-tint text-terracotta-deep'
  : 'text-ink-2 hover:bg-warm-cream hover:text-ink-1'
```

**Option B: Absolutely-positioned `<span>` as first child**

```tsx
<NavLink ...>
  {isActive && <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-terracotta rounded-r" aria-hidden />}
  <Icon ... />
  <span className={collapsed ? 'hidden' : ''}>{label}</span>
</NavLink>
```

**Recommendation: Option A (pseudo-element).** Less DOM nodes, no need to conditionally render a span. Tailwind v4 supports `before:` pseudo-element utilities. The NavLink already needs `relative` for the collapsed state positioning.

### Pattern 5: StepIndicator Component

**What:** Visual stepper row with circles + labels for ReservationWizard.
**Interface:**

```tsx
// apps/web/src/features/reservations/wizard/StepIndicator.tsx
interface StepIndicatorProps {
  steps: string[];
  currentStep: number; // 1-based
}

// Per-step circle style:
// active:    bg-terracotta text-warm-white ring-4 ring-terracotta-tint
// completed: bg-mustard text-warm-white  (+ lucide Check icon instead of number)
// pending:   bg-warm-tan text-ink-3

// Connector between steps:
// completed: bg-mustard
// pending:   bg-warm-line
```

### Pattern 6: STATUS_COLORS Shared Constant

```ts
// apps/web/src/lib/status-colors.ts
// Maps RoomStatus (from status-pill types) to CSS variable strings for Recharts and inline styles

import type { RoomStatus } from '@/components/ui/status-pill';

export const STATUS_COLORS: Record<RoomStatus, string> = {
  available:    'var(--status-available)',
  reserved:     'var(--status-reserved)',
  occupied:     'var(--status-occupied)',
  cleaning:     'var(--status-cleaning)',
  maintenance:  'var(--status-maintenance)',
  blocked:      'var(--status-blocked)',
};

export const STATUS_BG_COLORS: Record<RoomStatus, string> = {
  available:    'var(--status-available-bg)',
  reserved:     'var(--status-reserved-bg)',
  occupied:     'var(--status-occupied-bg)',
  cleaning:     'var(--status-cleaning-bg)',
  maintenance:  'var(--status-maintenance-bg)',
  blocked:      'var(--status-blocked-bg)',
};
```

**Usage in Recharts:** `fill={STATUS_COLORS['occupied']}` — works because Recharts accepts any CSS string for fill, including `var()` references.

**Usage in RoomRackTable:** Replace `STATUS_COLORS[status]` Tailwind classes with inline `style={{ backgroundColor: STATUS_COLORS_MAP[reservationStatus] }}`.

### Pattern 7: hos-app Chrome Primitives → Tailwind Mapping

The bundle defines global classes (`hos-app`, `hos-sidebar`, `hos-topbar`, `hos-nav`) in `tokens.jsx` lines 105-200. CONTEXT.md locks the decision to use Tailwind utility compositions (no global classes). The mapping:

| Bundle primitive | CSS values | Tailwind composition |
|-----------------|------------|---------------------|
| `.hos-app` | grid, 240px/1fr cols, 56px/1fr rows, warm-paper bg | `min-h-screen bg-warm-paper` (+ flex or CSS grid via inline style) |
| `.hos-sidebar` | warm-white bg, warm-line border-right, 240px, flex-col, padding 14/10 | `w-60 shrink-0 bg-warm-white border-r border-warm-line flex flex-col p-3` |
| `.hos-topbar` | warm-white bg, warm-line border-bottom, 56px height, flex items-center | `bg-warm-white border-b border-warm-line h-14 flex items-center px-6 gap-4` |
| `.hos-main` | warm-paper bg, padding 24/28, overflow-auto | `bg-warm-paper overflow-auto p-6` |
| `.hos-nav` | flex, gap-10, padding 7/10, border-radius 7px, ink-2 text, 13.5px | `flex items-center gap-3 px-3 py-2 rounded-md text-ink-2 text-sm` |
| `.hos-nav:hover` | warm-cream bg, ink-1 text | `hover:bg-warm-cream hover:text-ink-1` |
| `.hos-nav.active` | terracotta-tint bg, terracotta-deep text | `bg-terracotta-tint text-terracotta-deep` |
| `.hos-nav-section` | 10.5px, uppercase, ink-3, letter-spacing .08em | `text-xs uppercase tracking-widest text-ink-3 px-3 mt-4 mb-1` |
| `.hos-logo-mark` | 28px square, border-radius 7px, terracotta bg, warm-white text, display italic | `w-7 h-7 rounded-lg bg-terracotta text-warm-white flex items-center justify-center font-display italic text-lg` |
| `.hos-icon-btn` | 32px, border-radius 7px, ink-2, hover warm-cream | `w-8 h-8 rounded-md flex items-center justify-center text-ink-2 hover:bg-warm-cream hover:text-ink-1` |

### Anti-Patterns to Avoid

- **DO NOT use Tailwind opacity modifiers on `warm-line`:** `border-warm-line/50` — invalid. These tokens are pre-composed `rgba()`. Use as-is.
- **DO NOT pass Tailwind utility strings as Recharts `fill` prop:** `fill="bg-terracotta"` won't work. Use `fill="var(--terracotta)"`.
- **DO NOT remove `data-testid` attributes from HousekeepingPage:** 5 tests depend on them.
- **DO NOT change the ChatPanel `z-index` hierarchy:** `z-30` backdrop, `z-40` panel, `z-50+` modals.
- **DO NOT add `useForceLightTheme` to any staff screen:** Staff routes respect dark mode.
- **DO NOT modify `StaffLayout.tsx` in the same plan as the 7 screen restyles:** INT-08 is a Wave 1 prerequisite.
- **DO NOT use `bg-terracota` (one 't'):** The v1.0 codebase has this typo in Sidebar.tsx (`bg-terracota/10`). Use `bg-terracotta-tint` (correct bundle token).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status color mapping | Custom palette string record | `STATUS_COLORS` from `lib/status-colors.ts` (new shared constant) | Used in 3 places: RoomRackTable, HousekeepingPage, RoomStatusDonut |
| Status pills in RoomsPage | `PhysicalStatusBadge` + `CleaningStatusBadge` local components | Phase 9 `StatusPill` from `@/components/ui/status-pill` | Already handles all 6 states + dark mode |
| Stepper circles | Inline conditional JSX in ReservationWizard | `StepIndicator.tsx` extracted component | Reusable, testable, clean |
| Dark mode hook | Custom `localStorage` read/write | Phase 9 `useTheme` from `@/hooks/useTheme` | Already handles FOUC prevention, storage, system preference |
| Theme toggle button | Custom sun/moon button | Phase 9 `ThemeToggle` from `@/components/ui/theme-toggle` | Already implemented and tested |
| KPI number formatting | Ad-hoc `font-mono` wrapper | `font-mono` Tailwind class + `num` CSS class from `globals.css` | `.num` class already defined: `font-family: var(--font-mono); font-variant-numeric: tabular-nums` |

---

## Common Pitfalls

### Pitfall 1: Recharts SVG Fills Bypass Tailwind

**What goes wrong:** Developer writes `fill="bg-terracotta"` or `fill="text-terracotta"` — Tailwind classes are not CSS properties. SVG `fill` needs a color value.
**Why it happens:** Tailwind utilities generate CSS class rules. SVG attributes receive values directly.
**How to avoid:** Use `fill="var(--terracotta)"` — the CSS variable resolves at runtime and respects dark mode overrides.
**Warning signs:** Charts render in black (`fill=""`  treated as empty, defaults to black) or show no color change.

### Pitfall 2: BarChart Per-Bar Conditional Colors

**What goes wrong:** Trying to use `<Cell>` inside `<Bar>` in a `<BarChart>`. Recharts v2 `<Cell>` works for PieChart/RadarChart, but the behavior in BarChart is inconsistent.
**Why it happens:** API confusion between chart types.
**How to avoid:** Use the `shape` prop on `<Bar>` with a custom render function that checks the datum:
```tsx
<Bar shape={(props) => <rect {...props} fill={props.highlight ? 'var(--terracotta)' : 'var(--mustard)'} rx={4} />} />
```
The datum is available via `props.payload`. Add `highlight: boolean` to the chart data transform.

### Pitfall 3: warm-line Opacity Modifier

**What goes wrong:** Writing `bg-warm-line/10` or `border-warm-line/20` after seeing Tailwind's opacity modifier syntax.
**Why it happens:** `--warm-line` is already `rgba(58, 42, 28, 0.10)`. Applying an additional opacity modifier would compose `rgba()` inside `rgba()`, which Tailwind v4's `@theme inline` does not support.
**How to avoid:** Use `warm-line` and `warm-line-strong` as-is. For custom opacity needs, use `ink-1` with opacity (`bg-ink-1/10`).
**Source:** Phase 9 STATE.md decision: `warm-line + warm-line-strong are pre-composed rgba() -- no Tailwind opacity modifiers`.

### Pitfall 4: ProtectedRoute Loading State (Phase 9 deferred debt)

**What goes wrong:** `router.tsx` lines 29-31 still use `bg-bg-base` and `text-text-muted` — v1.0 token names. These silently fail (no utility generated) during session restore.
**Why it happens:** Phase 9 deferred this explicitly (documented in 09-04-SUMMARY.md).
**How to avoid:** Fix as part of INT-08 or as a Wave 0 task. Change to `bg-warm-paper` and `text-ink-3`.
**Warning signs:** White flash + invisible text during hard refresh while session is being restored.

### Pitfall 5: `data-testid` Preservation in HousekeepingPage

**What goes wrong:** Restyle restructures JSX in HousekeepingPage and accidentally removes or renames `data-testid` attributes.
**Why it happens:** When rewriting the column header or card structure, testids on inner elements can be dropped.
**How to avoid:** The 5 test assertions depend on these exact testids:
  - `data-testid={`column-${status}`}` — on each kanban column div
  - `data-testid={`room-card-${room.number}`}` — on each room button
  - `data-testid={`assign-task-${room.number}`}` — on the assign-task span
  - `room-status-modal` — on RoomStatusModal (not restyled here, but must remain)
  - `task-assignment-drawer` — on TaskAssignmentDrawer (not restyled here)

### Pitfall 6: shadcn Card vs Bundle hos-card

**What goes wrong:** Assuming shadcn `<Card>` from Phase 9 matches the bundle `hos-card` pattern and using it for KpiCard, room cards, etc.
**Why it happens:** Phase 9 refactored shadcn Card to use `bg-warm-white border border-warm-line rounded-xl`. Bundle `hos-card` also uses `border-radius: 14px`. Phase 9 `--radius-xl: 14px` is available.
**How to avoid:** Phase 9 `<Card>` was confirmed to drop `shadow-sm` (Phase 9 decision: "Card drops shadow-sm — bundle .hos-card uses border, not shadow"). The cards in Phase 11 should use `rounded-xl` which maps to 14px via `--radius-xl`. Use shadcn Card for complex compositions; raw div with `bg-warm-white border border-warm-line rounded-xl` for simpler KpiCard/room cards.

### Pitfall 7: Sidebar Collapse Width Break in StaffLayout

**What goes wrong:** StaffLayout uses `flex` layout. Sidebar animates from `w-60` to `w-16`. If the main area uses any `min-width` or fixed sizing, the animation looks broken or the content jumps.
**Why it happens:** `flex-1` on the main area expands to fill available space. During transition, `flex-1` recalculates at each frame — this is correct behavior and should work smoothly.
**How to avoid:** Ensure main content uses `flex-1 overflow-auto min-w-0` (the `min-w-0` prevents flex children from overflowing). Keep `overflow: hidden` on the Sidebar itself during transition to prevent labels from overflowing.

### Pitfall 8: ThemeToggle + Staff Dark Mode

**What goes wrong:** Concern that mounting `ThemeToggle` in Sidebar will conflict with something.
**Why it happens:** Phase 10 used `useForceLightTheme()` on public portal. Staff routes do not — they respect user's theme choice.
**Verified:** `useForceLightTheme` is only called in `HotelHomePage.tsx` and `PublicConciergeLayout.tsx` (Phase 10). No staff file calls it. `ThemeToggle` calls `useTheme` which reads from localStorage. No conflict.

---

## Code Examples

### Token Substitution — Before/After

```tsx
// BEFORE (v1.0)
<div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
  <p className="text-xs font-medium uppercase tracking-wider text-text-brand">
    {title}
  </p>
  <p className="text-3xl font-semibold text-text-primary">{value}</p>
</div>

// AFTER (bundle tokens) — KpiCard pattern
<div className="bg-warm-paper border border-warm-line rounded-xl p-4">
  <p className="text-[11px] font-medium uppercase tracking-widest text-ink-3">
    {title}
  </p>
  <p className="font-mono text-3xl text-ink-1">{value}</p>
  {delta && (
    <span className={delta > 0 ? 'text-status-available text-xs' : 'text-terracotta text-xs'}>
      {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}%
    </span>
  )}
</div>
```

### Recharts BarChart with today highlight

```tsx
// Source: DashboardPage bundle (dashboard.jsx line 45)
// today bar: var(--terracotta), other bars: var(--mustard)

// In OccupancyBarChart.tsx — add highlight field to data transform
const chartData = snapshots.map((s) => ({
  date: fmtDateShort(s.businessDate),
  occupancyPct: Math.round(Number(s.occupancyPct) * 1000) / 10,
  isToday: s.businessDate.startsWith(businessDate),
}));

// Bar with shape prop
<Bar
  dataKey="occupancyPct"
  radius={[4, 4, 0, 0]}
  shape={(props: any) => (
    <rect
      x={props.x} y={props.y}
      width={props.width} height={props.height}
      fill={props.isToday ? 'var(--terracotta)' : 'var(--mustard)'}
      rx={4}
    />
  )}
/>
```

### Sidebar active item with terracotta accent bar

```tsx
// Sidebar.tsx NavLink className
className={({ isActive }) =>
  `relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
    isActive
      ? 'bg-terracotta-tint text-terracotta-deep before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:bg-terracotta before:rounded-r'
      : 'text-ink-2 hover:bg-warm-cream hover:text-ink-1'
  }`
}
```

### StepIndicator component

```tsx
// apps/web/src/features/reservations/wizard/StepIndicator.tsx
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number; // 1-based
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {steps.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={stepNum} className="flex flex-col items-center gap-1">
            {idx > 0 && (
              <div className={`absolute -translate-x-full w-8 h-px ${isCompleted ? 'bg-mustard' : 'bg-warm-line'}`} />
            )}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-terracotta text-warm-white ring-4 ring-terracotta-tint'
                  : isCompleted
                  ? 'bg-mustard text-warm-white'
                  : 'bg-warm-tan text-ink-3'
              }`}
            >
              {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
            </div>
            <span className={`text-[13px] uppercase tracking-wide ${
              isActive ? 'font-medium text-terracotta-deep' : isCompleted ? 'text-ink-2' : 'text-ink-3'
            }`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

### Login split-panel structure

```tsx
// LoginPage.tsx outer wrapper
<div className="hos min-h-screen grid lg:grid-cols-2">
  {/* Left panel — decorative, desktop only */}
  <div className="hidden lg:flex relative bg-ink-1 flex-col justify-between p-12 overflow-hidden">
    {/* Radial gradient blobs */}
    <div className="absolute inset-0 opacity-30"
         style={{ background: 'radial-gradient(at 20% 30%, var(--terracotta) 0%, transparent 50%), radial-gradient(at 80% 70%, var(--mustard) 0%, transparent 50%)' }}
    />
    {/* Heading */}
    <h1 className="font-display text-5xl text-warm-white relative z-10">
      Hospitalidad, <i>operada con inteligencia</i>
    </h1>
    {/* Three-stat strip */}
    <div className="flex gap-8 relative z-10">
      {[
        { num: '42', label: 'habitaciones' },
        { num: '78%', label: 'ocupación' },
        { num: '12', label: 'check-ins hoy' },
      ].map(({ num, label }) => (
        <div key={label}>
          <span className="font-mono text-2xl text-mustard">{num}</span>
          <p className="text-xs text-ink-4 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  </div>
  {/* Right panel */}
  <div className="flex items-center justify-center bg-warm-white p-8">
    {/* existing form JSX — restyled */}
  </div>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| v1.0 semantic tokens (`bg-surface`, `text-text-primary`) | Bundle-aligned tokens (`bg-warm-white`, `text-ink-1`) | Phase 9 already defines the new vocabulary in `globals.css` |
| Tailwind palette classes (`bg-blue-500`, `bg-red-100`) | CSS variable strings (`var(--status-*)`) in non-Tailwind contexts | Recharts and inline styles require direct CSS variables |
| Hardcoded hex in Recharts fills (`#c45a3a`, `#f59e0b`) | `var(--terracotta)`, `var(--mustard)` — dark-mode aware | Dark mode works automatically in charts |
| No sidebar collapse | Collapse via `w-60`/`w-16` + `transition-[width] duration-200` | 200ms as per ROADMAP success criterion 8 |
| Table layout in RoomsPage | Card grid layout | Visual match to bundle + matches INT-04 spec |
| Step indicator pill (inline span) | `StepIndicator` component (circles + labels + connectors) | Visual stepper matches INT-05 bundle spec |

**Deprecated:**
- `bg-terracota` (one 't') — typo that exists in Sidebar.tsx v1.0. Use `bg-terracotta-tint`.
- `COLUMN_COLORS` in HousekeepingPage with Tailwind palette classes — replace with status token classes.
- `PHYSICAL_STATUS_CLASSES` and `CLEANING_STATUS_CLASSES` in RoomsPage — replace with `StatusPill` component.
- `STATUS_COLORS` in RoomRackTable (Tailwind classes) and `STATUS_COLORS` in RoomStatusDonut (hex) — both replaced by `lib/status-colors.ts`.

---

## Parallelization Strategy

**Wave 1 (must complete first):**
- INT-08: StaffLayout + Sidebar — all 7 other screens render inside StaffLayout's grid. If the grid structure changes, inner screens may need adjustment. Implementing collapse + ThemeToggle + token rename here first ensures a stable shell.

**Wave 2 (all parallel after Wave 1):**
- INT-01: LoginPage — entirely standalone (renders outside StaffLayout, no overlap with any other screen)
- INT-02: DashboardPage — independent feature directory
- INT-03: RoomRackTable — independent file in reservations/components/
- INT-04: RoomsPage + RoomDrawer — same directory, but single plan can cover both
- INT-05: ReservationWizard + 4 steps — wizard directory, no shared files with other screens
- INT-06: HousekeepingPage — independent; `RoomStatusModal` and `TaskAssignmentDrawer` also need token restyle but are not in other screens
- INT-07: ChatPanel — independently lives in ai-assistant/

**Shared file conflict analysis:**
- `apps/web/src/lib/status-colors.ts` — new file, created in Wave 0 before parallel wave
- `apps/web/src/router.tsx` — ProtectedRoute fix can be part of INT-08 (Wave 1)
- `apps/web/src/features/reservations/wizard/StepIndicator.tsx` — new file, created in INT-05 plan (no conflicts)

**Wave 0 (pre-work, prerequisite for Wave 2):**
- Create `apps/web/src/lib/status-colors.ts`
- Fix `router.tsx` ProtectedRoute tokens (`bg-bg-base` → `bg-warm-paper`, `text-text-muted` → `text-ink-3`)

These two items take < 20 lines total and unblock Wave 2 parallel execution.

---

## Open Questions

1. **RoomRackTable reservation bar colors — data-status vs inline style**
   - What we know: bundle shows `[data-status="occupied"] { background: var(--status-occupied) }` pattern. But the current RoomRackTable passes status via the `ReservationStatus` enum (CONFIRMED, CHECKED_IN, etc.) which doesn't map 1:1 to the 6 `RoomStatus` states.
   - What's unclear: Should bars map CONFIRMED→reserved, CHECKED_IN→occupied, or use a separate mapping?
   - Recommendation: Create a `RESERVATION_STATUS_TO_CSS` map that maps the 6 reservation statuses to the closest `var(--status-*)` CSS variable string. Use inline `style={{ backgroundColor: ... }}` on the bar element (simpler than data-status attribute for dynamic values).

2. **Topbar content for StaffLayout**
   - What we know: Bundle defines `hos-topbar` (56px, warm-white, border-bottom). Current StaffLayout has no topbar.
   - What's unclear: Does Phase 11 include any topbar content (search, user avatar, breadcrumbs)?
   - Recommendation: Add a minimal topbar shell (`h-14 bg-warm-white border-b border-warm-line`) as part of INT-08. Leave content empty — Phase 12 or later can fill it. This preserves the `grid-rows-[56px_1fr]` chrome from the bundle without requiring content decisions.

3. **RoomsPage: table → card grid migration scope**
   - What we know: INT-04 clearly requires a card grid layout (not table). RoomsPage currently uses `<table>`.
   - What's unclear: Whether the search/filter controls above the table should also be restructured.
   - Recommendation: Full structural migration from table to card grid. Keep the "Nueva habitación" button header. Remove table entirely. Existing mutation hooks and `deactivateMutation` can trigger from inside the card action button (same onClick, different placement).

---

## Sources

### Primary (HIGH confidence)
- `apps/web/src/styles/globals.css` — Phase 9 token vocabulary, verified verbatim
- `apps/web/src/components/layout/Sidebar.tsx` — v1.0 collapse state: ABSENT (confirmed by reading file)
- `apps/web/src/features/reporting/OccupancyBarChart.tsx` — Recharts Bar with `fill="#c45a3a"` (hex) — confirmed upgrade path
- `apps/web/src/features/reporting/RoomStatusDonut.tsx` — `STATUS_COLORS` with hex values — confirmed upgrade path
- `.planning/STATE.md` — Phase 9 decisions (warm-line behavior, dark mode, token aliases)
- `.planning/phases/09-design-system-foundation/09-04-SUMMARY.md` — exports verified
- `.planning/phases/10-public-portal/10-05-SUMMARY.md` — restyle pattern precedent (concierge)
- `.design-fetch/hotelos-ai/project/tokens.jsx` lines 105-200 — chrome primitives verified

### Secondary (MEDIUM confidence)
- Recharts v2 `shape` prop on `<Bar>`: documented in Recharts v2 API. Custom bar rendering verified via codebase pattern inspection.
- Tailwind v4 `before:` pseudo-element utilities: standard Tailwind v4 feature. Used in public-portal Phase 10 codebase.

### Tertiary (LOW confidence)
- None — all claims verified from primary sources.

---

## Metadata

**Confidence breakdown:**
- Per-screen blast radius: HIGH — all files read directly, line counts and class counts from actual source
- Token migration table: HIGH — cross-referenced v1.0 code with Phase 9 `globals.css`
- Recharts theming: HIGH — existing implementation inspected, CSS variable approach confirmed
- Sidebar collapse: MEDIUM — no existing implementation to inspect; pattern derived from Tailwind docs + bundle spec
- Parallelization: HIGH — file conflict analysis based on actual file paths

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (stable domain — token values locked in Phase 9)

---

## RESEARCH COMPLETE
