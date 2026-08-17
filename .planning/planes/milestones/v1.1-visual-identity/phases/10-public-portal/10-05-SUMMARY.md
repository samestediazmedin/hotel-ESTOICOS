---
phase: 10-public-portal
plan: "05"
subsystem: concierge-ui
tags: [restyle, warm-palette, tokens, instrument-serif, dark-mode-gate]
requirements: [PUB-13]

dependency_graph:
  requires: [10-01]
  provides: [restyled-concierge-ui]
  affects: [PublicConciergeLayout, ConciergePage, ChatMessage, VenueCard]

tech_stack:
  added: []
  patterns:
    - useForceLightTheme hook on public layouts
    - hos class on root container for CSS var availability outside StaffLayout
    - Semantic color preservation (amber/red status banners unchanged)

key_files:
  modified:
    - apps/web/src/layouts/PublicConciergeLayout.tsx
    - apps/web/src/features/concierge/ConciergePage.tsx
    - apps/web/src/features/concierge/ChatMessage.tsx
    - apps/web/src/features/concierge/VenueCard.tsx
  untouched_logic:
    - apps/web/src/features/concierge/concierge.api.ts
    - apps/web/src/features/concierge/concierge.store.ts
    - apps/web/src/features/concierge/useConciergeChat.ts
    - apps/web/src/features/concierge/streamMessages.ts
    - apps/web/src/features/concierge/types.ts

decisions:
  - "Status banners (border-amber-200/bg-amber-50 and border-red-200/bg-red-50) keep semantic colors — they communicate system state, not brand identity"
  - "hos class added to PublicConciergeLayout root so CSS token vars (--warm-paper, --terracotta, etc.) resolve correctly even when rendered outside StaffLayout"
  - "font-display on VenueCard h3 bumps size from text-sm to text-base per plan spec (Instrument Serif reads better at base size than small)"
  - "useForceLightTheme() as first call in PublicConciergeLayout prevents dark-mode data-theme leak from staff screens"

metrics:
  duration: "~15 min"
  completed: "2026-05-17"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
  class_replacements: ~32
---

# Phase 10 Plan 05: Concierge Public Chat Restyle Summary

**One-liner:** Warm-palette + Instrument Serif restyle of four concierge UI files — terracotta bubbles, font-display VenueCard titles, useForceLightTheme gate, zero hex literals.

## What Was Built

PUB-13 satisfied. The `/concierge` public chat surface now matches the Phase 10 portal identity:

- **`PublicConciergeLayout.tsx`**: bg-warm-paper root, terracotta logo mark, font-display hotel name, useForceLightTheme() dark-mode gate, `hos` class for CSS var scope.
- **`ConciergePage.tsx`**: terracotta send button, warm-paper textarea, warm-white form container, terracotta-tint empty-state icon, font-display heading. Suggestion chips use warm palette. Status banners preserved.
- **`ChatMessage.tsx`**: user bubble `bg-terracotta text-warm-white`, assistant bubble `bg-warm-white text-ink-1 border border-warm-line`, streaming dots `bg-ink-4`. Error box red palette preserved.
- **`VenueCard.tsx`**: `font-display text-base text-ink-1` on venue name h3 (Instrument Serif), terracotta-tint type badge, fill-mustard rating stars, bg-warm-cream photo placeholder, terracotta "Cómo llegar" primary action, warm-line secondary actions.

## Logic Files Untouched

All chat behavior, SSE streaming, RAG search, and store logic untouched:
- `concierge.api.ts` — CSRF fetch, SSE endpoint
- `concierge.store.ts` — Zustand state
- `useConciergeChat.ts` — send/stream orchestration
- `streamMessages.ts` — SSE parser
- `types.ts` — ConciergeMessage, VenueCardData types

## Deviations from Plan

None. Plan executed exactly as written.

## Verification

- `rg "#[0-9a-fA-F]{3,6}" apps/web/src/features/concierge/ --glob "*.tsx"` → 0 matches (zero hex)
- `rg "(bg-blue|bg-gray|text-blue|text-gray)" PublicConciergeLayout.tsx ConciergePage.tsx ChatMessage.tsx VenueCard.tsx` → 0 matches
- Status banners preserved: 3 amber/red banner lines in ConciergePage, 1 red error box in ChatMessage
- Logic files: `git diff --stat` on all 5 logic files → no output (unmodified)
- `useForceLightTheme` present in PublicConciergeLayout (import + call)

## Self-Check: PASSED

- `apps/web/src/layouts/PublicConciergeLayout.tsx` — modified, exists
- `apps/web/src/features/concierge/ConciergePage.tsx` — modified, exists
- `apps/web/src/features/concierge/ChatMessage.tsx` — modified, exists
- `apps/web/src/features/concierge/VenueCard.tsx` — modified, exists
- Commit `83d3ce3` — Task 1 (layout + page)
- Commit `0954b45` — Task 2 (chat components)
