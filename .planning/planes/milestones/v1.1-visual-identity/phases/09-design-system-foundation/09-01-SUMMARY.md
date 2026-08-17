---
phase: 09-design-system-foundation
plan: 01
subsystem: design-system
tags: [tokens, tailwind-v4, css-variables, google-fonts, bundle-migration]
dependency_graph:
  requires: []
  provides: [bundle-token-layer, hos-root-scope, google-fonts-loaded]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [tailwind-v4-theme-inline, hos-scoped-css-variables, tdd-red-green]
key_files:
  created: []
  modified:
    - apps/web/src/design/tokens.ts
    - apps/web/src/design/tokens.spec.ts
    - apps/web/src/styles/globals.css
    - apps/web/index.html
    - apps/web/src/components/layout/StaffLayout.tsx
decisions:
  - "warm-line + warm-line-strong are pre-composed rgba() — no Tailwind opacity modifiers"
  - "status-cleaning kept at #d4a23a (bundle var(--status-cleaning)) — #a8801c NOT adopted as token"
  - "token count is 33 (not 32 as PLAN said) — actual bundle count verified"
  - "router.tsx bg-bg-base/text-text-muted deferred to Phase 11"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-17"
  tasks_completed: 3
  files_modified: 5
---

# Phase 09 Plan 01: Token Migration + .hos Root + Google Fonts Summary

**One-liner:** Bundle token layer migrated verbatim from tokens.jsx — `@theme inline` CSS vars, `.hos` root scope, Instrument Serif/Geist/Geist Mono from Google Fonts, 42 TDD assertions passing.

---

## Goal

Replace the v1.0 design-token layer in `apps/web` with the canonical Claude Design bundle token layer (names + hex values), wire the `.hos` root scope onto `<html>`, load the three Google Fonts via `@import`, and fix StaffLayout's removed v1.0 token reference. This is the foundation Plans 09-02, 09-03, 09-04 depend on.

---

## Changes

### Token Names Renamed (v1.0 → Bundle)

| v1.0 Token | Bundle Token | Notes |
|------------|-------------|-------|
| `--brand-primary #c45a3a` | `--terracotta #c4623f` | Different hex — 2-nibble difference |
| `--brand-primary-hover #a8492e` | `--terracotta-deep #9d4a2e` | |
| `--brand-primary-soft #f4dccf` | `--terracotta-soft #f1d4c2` | |
| `--bg-base #f0eee9` | `--warm-paper #f4efe6` | |
| `--surface #faf8f3` | `--warm-white #faf7f2` | |
| `--surface-elevated #ffffff` | (removed — no direct bundle equivalent) | |
| `--border-subtle #e5e0d6` | `--warm-line rgba(58, 42, 28, 0.10)` | rgba, not hex |
| `--border-strong #c9bfa9` | `--warm-line-strong rgba(58, 42, 28, 0.18)` | rgba, not hex |
| `--text-primary #1a1612` | `--ink-1 #2a221a` | |
| `--text-secondary #5a544c` | `--ink-2 #5a4d3f` | |
| `--text-muted #8a8278` | `--ink-3 #8a7d6e` | |
| `--status-pending #d4a13a` | `--status-cleaning #d4a23a` | Reframed: cleaning state |
| `--status-in-progress #c45a3a` | `--status-occupied #c4623f` | Reframed: occupied state |

New bundle tokens with no v1.0 equivalent: `--warm-cream`, `--warm-tan`, `--ink-4`, `--mustard*`, `--olive*`, `--clay*`, `--terracotta-tint`, all 6 `--status-*-bg` tokens.

### Utility Class Renames (Tailwind)

| v1.0 Class | Bundle Class |
|------------|-------------|
| `bg-bg-base` | `bg-warm-paper` |
| `bg-surface` | `bg-warm-white` |
| `text-text-primary` | `text-ink-1` |
| `text-text-muted` | `text-ink-3` |
| `border-border-subtle` | `border-warm-line` |
| `border-border-strong` | `border-warm-line-strong` |
| `bg-brand-primary` | `bg-terracotta` |

---

## Decisions Made

### 1. `--warm-line` and `--warm-line-strong` are `rgba()` — No Tailwind Opacity Modifiers

**Decision:** Both tokens are pre-composed with their alpha value: `rgba(58, 42, 28, 0.10)` and `rgba(58, 42, 28, 0.18)`. Tailwind v4 opacity modifiers (`border-warm-line/50`) require channel-separable color formats (oklch, hex, rgb) and do NOT compose with `rgba()` syntax.

**Rule:** Always use `border-warm-line` or `border-warm-line-strong` directly. Never append `/opacity` to these two utilities. Documented in both `globals.css` (inline comment) and `tokens.ts` (JSDoc).

### 2. `--status-cleaning` FG stays at `#d4a23a` (Open Question #3 resolved)

**Decision:** Bundle `tokens.jsx` line 267 uses hardcoded `#a8801c` for cleaning pill foreground (a darker mustard). PLAN resolved this at planning time: adopt bundle's `var(--status-cleaning)` value (`#d4a23a`) rather than the one-off hardcoded value. This keeps the "zero hardcoded hex outside token source" invariant intact.

**Impact:** The cleaning pill will use `#d4a23a` (mustard) as foreground, slightly lighter than bundle line 267 shows. Visually very close; the difference is only visible on close inspection.

### 3. Token Count is 33 (Not 32 as PLAN Stated)

**Discovery:** PLAN frontmatter said 32 color tokens. Actual bundle palette count is 33: 4 warm-hex + 2 warm-rgba + 4 ink + 4 terracotta + 3 mustard + 2 olive + 2 clay + 6 status-fg + 6 status-bg = 33. The spec was corrected to assert 33.

---

## Out of Scope (Deferred)

### 33 Feature Files — Phases 10/11

Per RESEARCH § Hardcoded Color Blast Radius, 33 feature-screen files still reference v1.0 token names. These are intentionally untouched in Plan 09-01 — Phase 9's gate covers only `components/ui/`, `components/layout/StaffLayout.tsx`, `styles/globals.css`, `design/tokens*`, and `index.html`.

Categories deferred to Phase 10/11:
- Public booking (4 files), Reporting (4 files), Inventory (3 files), Reservations (6 files)
- Operations (4 files), Housekeeping (3 files), AI/Concierge (7 files), Admin (2 files)

### `router.tsx` ProtectedRoute Loading State

`apps/web/src/router.tsx` lines 29-31 use `bg-bg-base` and `text-text-muted` in the ProtectedRoute loading spinner. This is **out of scope for Plan 09-01** (and Phase 9) because:
1. It is a feature-router file — not in the Phase 9 primitive/layout scope
2. It falls under Phase 11 (internal screens restyle)

Phase 11 must update these two utility classes before the loading state renders correctly with bundle colors.

### `components/ui` Primitive Token Renames — Plan 09-02

`button.tsx`, `card.tsx`, `input.tsx`, and `table.tsx` still reference v1.0 token utility classes (`bg-brand-primary`, `border-border-subtle`, `text-text-primary`, etc.). These are the "In-Scope Primitives" for **Plan 09-02** (not this plan). Plan 09-01 only covers the token foundation layer; 09-02 applies the rename to the primitives.

---

## Verification

| Check | Result |
|-------|--------|
| `pnpm vitest run src/design/tokens.spec.ts` | 42/42 PASSED |
| `pnpm vite build` | EXIT 0 (48 KB CSS) |
| `var(--terracotta)` in built CSS | 1 match found |
| `brand-primary` in globals.css | 0 matches |
| `Source Serif 4` in globals.css | 0 matches |
| `@fontsource` in globals.css | 0 matches |
| Google Fonts `@import` URL present | 1 match |
| `--terracotta: #c4623f` in globals.css | 1 match |
| `@custom-variant dark` in globals.css | 1 match |
| `.hos[data-theme="dark"]` block in globals.css | 1 match |
| `<html lang="es" class="hos">` in index.html | 1 match |
| `bg-bg-base` in StaffLayout | 0 matches |
| `bg-warm-paper` in StaffLayout | 1 match |
| `bg-bg-base` in components/ui | 0 matches (Plan 09-01 scope) |
| v1.0 tokens in 09-01 modified files | 0 matches (test strings only) |

---

## Self-Check: PASSED

All 5 modified files exist. All 3 task commits present:
- `0546a08` feat(09-01): rewrite tokens.ts + tokens.spec.ts with bundle palette
- `75b8d18` feat(09-01): replace globals.css with bundle token layer + .hos scope
- `15d6b31` feat(09-01): add .hos root class to `<html>` + fix StaffLayout token rename
