---
phase: 11-internal-screens-restyle
plan: "06"
subsystem: reservations/wizard
tags: [restyle, stepper, token-migration, wizard]
dependency_graph:
  requires: [11-01]
  provides: [INT-05]
  affects: [reservations/wizard]
tech_stack:
  added: []
  patterns:
    - StepIndicator component with 3 visual states (active/completed/pending)
    - Connector lines between step dots (mustard when completed, warm-line otherwise)
    - terracotta-tint for error backgrounds instead of red-50
key_files:
  created:
    - apps/web/src/features/reservations/wizard/StepIndicator.tsx
  modified:
    - apps/web/src/features/reservations/wizard/ReservationWizard.tsx
    - apps/web/src/features/reservations/wizard/Step1Dates.tsx
    - apps/web/src/features/reservations/wizard/Step2Room.tsx
    - apps/web/src/features/reservations/wizard/Step3Guest.tsx
    - apps/web/src/features/reservations/wizard/Step4Confirm.tsx
decisions:
  - "Error states use bg-terracotta-tint + text-terracotta instead of bg-red-50 + text-red-700 — stays within token system"
  - "StepIndicator connector positioning uses mt-4 offset to vertically center with circle midpoint"
  - "Step4Confirm total row uses text-xl font-mono text-terracotta-deep for visual emphasis"
  - "ReservationWizard outer panel uses bg-warm-cream (not bg-warm-white) to create depth contrast with inner content panel"
metrics:
  duration: "~45min"
  completed_date: "2026-05-17"
  tasks: 3
  files_modified: 6
---

# Phase 11 Plan 06: ReservationWizard + StepIndicator + 4 Step Files Summary

**One-liner:** Visual stepper (StepIndicator) extracted with active/completed/pending states using terracotta/mustard/warm-tan tokens, wizard chrome restyled to warm-cream panel, all 4 step files fully migrated from v1.0 tokens.

## What Was Done

### Task 1 — StepIndicator.tsx + ReservationWizard restyle (commit `7ce37f4`)

**New component:** `apps/web/src/features/reservations/wizard/StepIndicator.tsx`
- Props: `{ steps: string[], currentStep: number }` (1-based)
- Active step: `bg-terracotta text-warm-white ring-4 ring-terracotta-tint`, label `font-medium text-terracotta-deep`
- Completed step: `bg-mustard text-warm-white` + lucide `Check` icon, label `text-ink-2`
- Pending step: `bg-warm-tan text-ink-3`, label `text-ink-3`
- Connector lines: `h-px w-12 bg-mustard` (completed) / `bg-warm-line` (pending) with `mt-4` vertical alignment
- Step labels: `text-[13px] uppercase tracking-wide`
- Off-by-one guard: `stepNum = idx + 1` compared against 1-based `currentStep`

**Modified:** `ReservationWizard.tsx`
- Replaced old `<div className="flex h-1 bg-border-subtle">` progress bar with `<StepIndicator steps={STEP_LABELS} currentStep={currentStep} />`
- Page heading: `font-display italic text-3xl text-ink-1`
- Outer panel: `bg-warm-cream border-l border-warm-line`
- Backdrop: `bg-ink-1/20` (replaces v1.0 `bg-surface-strong/20`)
- Content area: `bg-warm-white border border-warm-line rounded-xl p-6`
- Footer buttons: `Button variant="outline"` for both Atrás and Cerrar
- Preserved: `useReservationWizardStore`, `goBack`, `closeWizard`, all step routing

### Task 2 — Token migration map across 4 step files (commit `b8b17e8`)

Token counts migrated per file:

| File | v1.0 tokens before | After |
|------|-------------------|-------|
| Step1Dates.tsx | 9 | 0 |
| Step2Room.tsx | 20 | 0 |
| Step3Guest.tsx | 43 | 0 |
| Step4Confirm.tsx | 39 | 0 |
| **Total** | **111** | **0** |

**Step1Dates.tsx** — date range picker container `bg-warm-cream border-warm-line`, adults input `bg-warm-white border-warm-line ring-terracotta`, error text `text-terracotta`, submit `Button variant="terracotta"`.

**Step2Room.tsx** — skeleton `bg-warm-tan`, error `bg-terracotta-tint border-terracotta-soft`, empty state `text-ink-3`, room cards `border-warm-line rounded-xl hover:border-terracotta hover:bg-terracotta-tint`, pricing `font-mono text-ink-1`, select button `bg-terracotta hover:bg-terracotta-deep ring-terracotta`.

**Step3Guest.tsx** — mode toggle `bg-warm-cream border-warm-line`, active tab `bg-warm-white text-ink-1`, dropdown `bg-warm-white border-warm-line-strong hover:bg-warm-cream`, all labels `text-ink-2`, selects `border-warm-line bg-warm-white ring-terracotta`, all error paragraphs `text-terracotta`, "Seleccionado" badge `text-terracotta-deep`, submit `Button variant="terracotta"`.

**Step4Confirm.tsx** — summary card `bg-warm-cream border-warm-line rounded-xl`, row labels `text-ink-3 text-xs uppercase tracking-wide`, values `font-mono text-ink-1`, table `rounded-xl border-warm-line`, header `bg-warm-cream`, total row `text-xl font-mono font-bold text-terracotta-deep`, conflict error `bg-terracotta-tint border-terracotta-soft`, confirm `Button variant="terracotta"`.

### Task 3 — Regression verification

`pnpm vitest run src/features/reservations/ --passWithNoTests` → exit 0 (no test files exist for wizard — per RESEARCH, this was expected).

## Deviations from Plan

**None** — plan executed exactly as written.

Migration map applied mechanically. All form/mutation logic, `useWizardState`, step validation, React Query keys, and mutation submission preserved without modification.

## Self-Check: PASSED

- StepIndicator.tsx: FOUND
- Commit 7ce37f4 (feat StepIndicator + wizard chrome): FOUND
- Commit b8b17e8 (refactor 4 step files): FOUND
- Zero v1.0 tokens in all wizard files: VERIFIED
- Zero hex in all wizard files: VERIFIED
- Vitest: exit 0 (passWithNoTests)
