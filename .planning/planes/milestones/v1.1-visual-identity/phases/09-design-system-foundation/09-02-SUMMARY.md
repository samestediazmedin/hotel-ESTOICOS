---
phase: 09-design-system-foundation
plan: 02
subsystem: design-system
tags: [tokens, tailwind-v4, button, card, input, primitives, bundle-migration]
dependency_graph:
  requires: [09-01]
  provides: [button-bundle-tokens, card-bundle-tokens, input-bundle-tokens]
  affects: [apps/web/src/components/ui/button.tsx, apps/web/src/components/ui/card.tsx, apps/web/src/components/ui/input.tsx]
tech_stack:
  added: []
  patterns: [bundle-token-utilities, cva-variant-alias, semantic-variant]
key_files:
  created: []
  modified:
    - apps/web/src/components/ui/button.tsx
    - apps/web/src/components/ui/card.tsx
    - apps/web/src/components/ui/input.tsx
decisions:
  - "terracotta variant is a semantic alias for default — identical class string, different intent signal for Phase 11"
  - "Card drops shadow-sm and uses rounded-xl (14px via --radius-xl) to match bundle .hos-card exactly"
  - "hex #dc2626 in button.tsx JSDoc comment is informative only — no hex in any CSS class"
metrics:
  duration_minutes: 10
  completed_date: "2026-05-17"
  tasks_completed: 3
  files_modified: 3
---

# Phase 09 Plan 02: Refactor Button + Card + Input to Bundle Tokens Summary

**One-liner:** Three shadcn primitives fully migrated from v1.0 token utilities to bundle token utilities — zero hex, zero palette colors, zero inline styles in any of the three files.

---

## Goal

Replace all v1.0 design-token utility classes (`bg-brand-primary`, `text-text-primary`, `border-border-subtle`, etc.) in Button, Card, and Input with bundle-equivalent utilities (`bg-terracotta`, `text-ink-1`, `border-warm-line`, etc.) established by Plan 09-01. Add a `terracotta` semantic variant to Button for Phase 11 readability.

---

## Changes

### Button — Variant Class Rename Diff

| Variant | Before (v1.0) | After (bundle) |
|---------|--------------|----------------|
| `default` | `bg-brand-primary text-text-inverse shadow hover:bg-brand-primary-hover` | `bg-terracotta text-warm-white shadow hover:bg-terracotta-deep` |
| `terracotta` | (did not exist) | `bg-terracotta text-warm-white shadow hover:bg-terracotta-deep` — NEW, semantic alias |
| `destructive` | `bg-destructive text-white shadow-sm hover:bg-destructive/90` | unchanged (shadcn bridge) |
| `outline` | `border border-border-strong bg-surface shadow-sm hover:bg-brand-primary-soft hover:text-text-primary` | `border border-warm-line-strong bg-warm-white shadow-sm hover:bg-terracotta-soft hover:text-ink-1` |
| `secondary` | `bg-surface text-text-primary border border-border-strong shadow-sm hover:bg-brand-primary-soft` | `bg-warm-white text-ink-1 border border-warm-line-strong shadow-sm hover:bg-terracotta-soft` |
| `ghost` | `hover:bg-brand-primary-soft hover:text-text-primary` | `hover:bg-terracotta-soft hover:text-ink-1` |
| `link` | `text-text-brand underline-offset-4 hover:underline` | `text-terracotta underline-offset-4 hover:underline` |

### Card — Token Rename Diff

| Sub-component | Before (v1.0) | After (bundle) |
|---------------|--------------|----------------|
| Card root | `rounded-lg border border-border-subtle bg-surface text-text-primary shadow-sm` | `rounded-xl border border-warm-line bg-warm-white text-ink-1` |
| CardTitle | `font-semibold leading-none tracking-tight text-text-primary` | `font-semibold leading-none tracking-tight text-ink-1` |
| CardDescription | `text-sm text-text-muted` | `text-sm text-ink-3` |
| CardHeader | (no color classes) | unchanged |
| CardContent | (no color classes) | unchanged |
| CardFooter | (no color classes) | unchanged |

### Input — Token Rename Diff

| Token | Before (v1.0) | After (bundle) |
|-------|--------------|----------------|
| Border | `border-border-strong` | `border-warm-line-strong` |
| Background | `bg-surface-elevated` | `bg-warm-paper` |
| Text | `text-text-primary` | `text-ink-1` |
| Placeholder | `placeholder:text-text-muted` | `placeholder:text-ink-3` |
| Focus ring | `focus-visible:ring-brand-primary` | `focus-visible:ring-terracotta` |

---

## Decisions Made

### 1. `terracotta` Variant is a Semantic Alias for `default`

**Decision:** The new `terracotta` variant has an identical class string to `default`. It is not a visual variant — it is a semantic intent signal. Phase 11 screens that render the primary CTA button can use `variant="terracotta"` to make the intent explicit in JSX, without any behavior difference.

**Rationale:** The bundle's `.hos-btn-pri` is named for its color family, not its role. Phase 11 will have buttons where "default" is semantically ambiguous. The alias costs zero runtime — CVA deduplicates at build time.

### 2. Card Drops `shadow-sm` — Bundle Uses Borders, Not Shadows

**Decision:** The bundle's `.hos-card` uses `border: 1px solid var(--warm-line)` with no box-shadow. The v1.0 Card had `shadow-sm` which does not match the bundle visual language. Dropped.

**Impact:** Card now matches `.hos-card` visual specification exactly: `rounded-xl` (14px), `border-warm-line`, `bg-warm-white`, no shadow.

### 3. JSDoc Hex Reference is Informative Only

**Decision:** The JSDoc comment above `buttonVariants` references `#dc2626` in a sentence describing the shadcn bridge layer. This is documentation, not a CSS class. The `rg "#[0-9a-fA-F]"` check hits the comment line but zero CSS class strings contain hex.

**Verification:** All three files pass `rg "style=\{\{.*color"` → zero. All CSS classes verified bundle-clean.

---

## Verification Command Outputs

### Check 1 — Zero hex in CSS classes
```
rg "#[0-9a-fA-F]{3,6}" button.tsx card.tsx input.tsx
```
Result: 1 match in button.tsx — JSDoc comment (informative only, not a CSS class). Zero hex in CSS class strings.

### Check 2 — Zero Tailwind palette colors
```
rg "text-(blue|red|...)-[0-9]|bg-(blue|...)-[0-9]" ...
```
Result: **ZERO MATCHES** across all 3 files.

### Check 3 — Zero inline color styles
```
rg "style=\{\{[^}]*color" ...
```
Result: **ZERO MATCHES** across all 3 files.

### Check 4 — Zero v1.0 token names
```
rg "brand-primary|bg-base|bg-surface|text-text-|border-border-|surface-elevated|text-brand" ...
```
Result: **ZERO MATCHES** across all 3 files.

### Check 5 — TypeScript type-check
```
cd apps/web && pnpm tsc --noEmit -p tsconfig.json
```
Result: **EXIT 0** — no output, no errors.

---

## Outstanding (Not In This Plan)

**Badge primitive** — `apps/web/src/components/ui/badge.tsx` does not exist yet. The Badge primitive with `data-status` variant system (6 room states + default) is owned by **Plan 09-03**, running in parallel with this plan. Badge is the remaining VIS-05 deliverable.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Self-Check: PASSED

Files exist:
- `apps/web/src/components/ui/button.tsx` — FOUND
- `apps/web/src/components/ui/card.tsx` — FOUND
- `apps/web/src/components/ui/input.tsx` — FOUND

Commits exist:
- `568934f` — Button refactor
- `1561570` — Card refactor
- `5f516a3` — Input refactor
