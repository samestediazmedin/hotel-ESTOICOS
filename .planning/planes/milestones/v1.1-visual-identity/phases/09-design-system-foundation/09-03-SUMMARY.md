---
phase: 09-design-system-foundation
plan: 03
subsystem: design-system
tags: [badge, status-pill, theme-toggle, use-theme, fouc, dark-mode, room-status]
dependency_graph:
  requires: [09-01, 09-02]
  provides: [badge-primitive, status-pill-component, use-theme-hook, theme-toggle-component, fouc-prevention]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [cva-variants-approach-a, css-variable-dark-mode, fouc-inline-script, localStorage-theme-persistence]
key_files:
  created:
    - apps/web/src/components/ui/badge.tsx
    - apps/web/src/components/ui/status-pill.tsx
    - apps/web/src/components/ui/theme-toggle.tsx
    - apps/web/src/hooks/useTheme.ts
  modified:
    - apps/web/index.html
decisions:
  - "Approach A (CVA + Tailwind utilities) over CSS attribute-selector for Badge variants — locks type-safety and IDE autocomplete; data-status forwarded as data attribute only for analytics/CSS hooks"
  - "STATUS_LABELS uses Spanish: Disponible, Reservada, Ocupada, Limpieza, Mantenimiento, Bloqueada — matches bundle tokens.jsx + Phase 5/6/7 UI language"
  - "CSP note: inline FOUC script needs nonce/hash exception if strict CSP added (ASVS 14.2) — flagged for Phase 11"
  - "ThemeToggle NOT mounted in StaffLayout — placement deferred to Phase 11 (Sidebar footer per CONTEXT.md)"
  - "useTheme removeAttribute('data-theme') for light mode (not setAttribute to 'light') — bundle .hos rule is light by default; dark mode is additive"
metrics:
  duration_minutes: 12
  completed_date: "2026-05-17"
  tasks_completed: 4
  files_modified: 5
---

# Phase 09 Plan 03: Badge + StatusPill + useTheme + ThemeToggle + FOUC inline script Summary

**One-liner:** Badge CVA primitive (7 variants) + StatusPill semantic wrapper (Spanish labels, dot indicator) + useTheme hook (localStorage + prefers-color-scheme) + ThemeToggle component + FOUC synchronous script — dark mode runtime fully wired.

---

## Goal

Deliver the three remaining design system primitives plus the complete dark-mode runtime: Badge (VIS-05 4th primitive), StatusPill (VIS-04 consumer surface for Phase 11 rooms), and ThemeToggle + useTheme + FOUC guard (VIS-03 full dark mode toggle stack with no flash on refresh).

---

## Changes

### Files Created (5 new)

| File | Role |
|------|------|
| `apps/web/src/components/ui/badge.tsx` | CVA primitive — 7 variants (default + 6 status), bundle token utilities only |
| `apps/web/src/components/ui/status-pill.tsx` | Semantic wrapper — typed `status` prop, Spanish labels, dot indicator |
| `apps/web/src/components/ui/theme-toggle.tsx` | Button ghost/icon — Sun (dark mode) / Moon (light mode), Spanish aria-label |
| `apps/web/src/hooks/useTheme.ts` | Hook — reads/writes localStorage('hos-theme'), sets data-theme on `<html>` |

### Files Modified (1 edit)

| File | Change |
|------|--------|
| `apps/web/index.html` | FOUC-prevention inline script added as first child of `<head>` |

---

## Decisions Made

### 1. Approach A: CVA Variants over CSS Attribute Selectors for Badge

**Decision:** Use CVA variant classes (`bg-status-available-bg text-status-available`) rather than CSS attribute selectors (`.hos-pill[data-status="available"]`).

**Why:** Type-safe, IDE autocomplete on `variant` prop, Tailwind-native, no extra CSS rules outside component file. The `data-status` attribute is still forwarded to the rendered `<span>` for external CSS targeting and analytics — but color comes exclusively from the CVA class.

**Locked in:** RESEARCH Pattern 5 "Approach A — CVA variants with Tailwind token utilities."

### 2. Spanish STATUS_LABELS

**Decision:** STATUS_LABELS record uses Spanish: `Disponible`, `Reservada`, `Ocupada`, `Limpieza`, `Mantenimiento`, `Bloqueada`.

**Why:** Matches bundle `tokens.jsx` lines 460-467 + project-wide Spanish UI convention established in Phase 5/6/7. The `label` prop on StatusPill allows override for English contexts if ever needed.

### 3. FOUC Script Placement

**Decision:** Script is the FIRST element inside `<head>`, before `<meta charset>`.

**Why:** Maximum synchronous execution before any layout/paint. The browser parses `<head>` top-to-bottom — placing it first means `data-theme` is set before the CSS is even parsed. This eliminates the flash for system-dark users who haven't yet stored a preference.

### 4. useTheme: removeAttribute for Light Mode

**Decision:** `root.removeAttribute('data-theme')` for light mode instead of `root.setAttribute('data-theme', 'light')`.

**Why:** The `.hos` CSS block defines light mode as the default — no attribute needed. The dark override is additive (`.hos[data-theme="dark"]`). Removing the attribute is semantically cleaner and avoids a potential specificity conflict if someone queries `[data-theme="light"]`.

### 5. ThemeToggle Mount Deferred

**Decision:** ThemeToggle component is created but NOT mounted anywhere.

**Why:** Phase 11 owns layout placement (Sidebar footer per CONTEXT.md "Specific Ideas"). Mounting it now in StaffLayout would be premature and outside Phase 9 scope. The component is ready to drop in with a single import.

---

## CSP Note (ASVS 14.2)

The inline `<script>` in `index.html` is required for FOUC prevention — it must execute synchronously before React mounts, which means it cannot be an external script (that would be deferred/async). If a strict Content-Security-Policy is added later (Phase 11 or infra setup), this script will need a **nonce** or **hash exception** in the CSP header:

```
Content-Security-Policy: script-src 'self' 'nonce-{RANDOM}' ...
```

or:

```
Content-Security-Policy: script-src 'self' 'sha256-{HASH_OF_SCRIPT}' ...
```

Flag for Phase 11 if CSP is introduced. The script content is static (no user input), so the hash approach is viable and stable.

---

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Type-check | `pnpm tsc --noEmit -p tsconfig.json` | EXIT 0 |
| Build passes | `pnpm vite build` | EXIT 0 (49.91 kB CSS) |
| Zero hex in new files | `rg "#[0-9a-fA-F]{3,6}" badge.tsx status-pill.tsx theme-toggle.tsx useTheme.ts` | 0 matches |
| Zero palette colors | `rg "text-(blue|red|...) -[0-9]" ...` | 0 matches |
| ThemeToggle wires useTheme | `rg "import.*useTheme.*from.*hooks/useTheme" theme-toggle.tsx` | 1 match |
| FOUC script present | `rg "localStorage.getItem\('hos-theme'\)" index.html` | 1 match |
| Script before charset | Line 4 = `<script>`, Line 14 = `<meta charset>` | CONFIRMED |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Self-Check: PASSED

All 5 modified files exist:
- `apps/web/src/components/ui/badge.tsx` — FOUND
- `apps/web/src/components/ui/status-pill.tsx` — FOUND
- `apps/web/src/components/ui/theme-toggle.tsx` — FOUND
- `apps/web/src/hooks/useTheme.ts` — FOUND
- `apps/web/index.html` — FOUND (modified)

All 4 task commits present:
- `a5d7a2f` feat(09-03): create Badge primitive with CVA + 7 variants
- `cf1f73c` feat(09-03): create StatusPill semantic wrapper over Badge
- `bb51582` feat(09-03): create useTheme hook + ThemeToggle component
- `8bb2a58` feat(09-03): add FOUC-prevention inline script to index.html
