---
phase: 11-internal-screens-restyle
plan: "08"
subsystem: ai-assistant-ui
tags: [restyle, warm-palette, tokens, instrument-serif, 2-col-layout, chat-bubbles]
requirements: [INT-07]

dependency_graph:
  requires: [11-01]
  provides: [restyled-chat-panel-ui]
  affects: [ChatPanel, ContextPanel, ChatMessage]

tech_stack:
  added: []
  patterns:
    - grid lg:grid-cols-[60%_40%] — chat left (60%), context right (40%), mobile: context hidden
    - warm-paper user bubble / warm-white assistant bubble / warm-line border pattern
    - bg-ink-4 animate-pulse streaming dots with animation-delay stagger
    - font-display italic section headings in ContextPanel (Instrument Serif)
    - bg-warm-white border-warm-line rounded-lg tool result cards

key_files:
  modified:
    - apps/web/src/features/ai-assistant/ChatPanel.tsx
    - apps/web/src/features/ai-assistant/ContextPanel.tsx
    - apps/web/src/features/ai-assistant/ChatMessage.tsx
  untouched_logic:
    - apps/web/src/features/ai-assistant/useAiChat.ts
    - apps/web/src/features/ai-assistant/ai-chat.store.ts
    - apps/web/src/features/ai-assistant/ai-assistant.api.ts
    - apps/web/src/features/ai-assistant/RichToolResult.tsx
    - apps/web/src/features/ai-assistant/types.ts

decisions:
  - "2-col grid layout (60/40) on lg+, context panel hidden lg:flex on mobile — staff screens are desktop-first per CONTEXT decision"
  - "User bubble bg-warm-paper (not terracotta as in public Concierge) — staff chat uses a more neutral palette, terracotta reserved for primary actions"
  - "Streaming dots switched from animate-bounce to animate-pulse with animation-delay stagger — cleaner pulse matches warm palette"
  - "ContextPanel section headings font-display italic text-xl (Instrument Serif) matching INT-07 contract verbatim"
  - "mustard-tint badge for tool source labels — mustard-tint is defined in globals.css token vocabulary"
  - "ChatPanel/ChatMessage changes were already applied by wave-parallel agent (11-02) — idempotent Edit calls confirmed no regression"

metrics:
  duration: "~20 min"
  completed: "2026-05-17"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
  class_replacements: ~28
---

# Phase 11 Plan 08: ChatPanel + ContextPanel + ChatMessage Restyle Summary

**One-liner:** 2-col CSS grid chat layout + warm-palette bubbles + Instrument Serif context headings — SSE streaming and tool loop preserved verbatim.

## What Was Built

INT-07 satisfied. The staff AI chat surface (`/dashboard` floating panel) now matches the Phase 11 bundle identity:

- **`ChatPanel.tsx`**: `grid grid-cols-1 lg:grid-cols-[60%_40%]` panel container. Floating button `bg-terracotta text-warm-white`. Backdrop `bg-ink-1/20 lg:hidden`. Header `font-display italic text-lg`. Conversation selector `bg-warm-paper border-warm-line`. Input `bg-warm-paper border-warm-line`, send button `variant="terracotta"` with `Send` icon. Empty state with suggestion chips `border-warm-line hover:bg-warm-cream`. Context column `hidden lg:flex` (mobile: single-column chat only).
- **`ChatMessage.tsx`**: User bubble `bg-warm-paper border border-warm-line text-ink-1 ml-auto rounded-2xl`. Assistant bubble `bg-warm-white border border-warm-line text-ink-1 mr-auto rounded-2xl`. Streaming dots `bg-ink-4 animate-pulse` with 150ms/300ms animation-delay stagger.
- **`ContextPanel.tsx`**: Section headings `font-display italic text-xl text-ink-1 mb-3` — verbatim CONTEXTO ACTIVO, FUENTES CONSULTADAS, ACCIONES SUGERIDAS. Tool result cards `bg-warm-white border border-warm-line rounded-lg p-3 mb-2`. Source badges `bg-mustard-tint text-mustard text-xs font-medium rounded-full`. Empty states `text-sm text-ink-3 italic`. Panel removes fixed-width `w-72` — fills the 40% column via grid.

## Logic Files Untouched

All SSE streaming, tool loop, conversation persistence, and store logic preserved:
- `useAiChat.ts` — SSE fetch+ReadableStream, tool loop orchestration
- `ai-chat.store.ts` — Zustand store (messages, isStreaming, contextPanel, conversation history)
- `ai-assistant.api.ts` — REST + SSE API calls
- `RichToolResult.tsx` — rich tool rendering (tables, chips, action buttons)
- `types.ts` — ChatMessage, ToolResult, ConversationDetail types

## Cross-reference: Phase 10-05 Concierge

Phase 10-05 established the warm-palette chat pattern used as reference here:
- Public Concierge user bubble: `bg-terracotta text-warm-white` (brand-forward, public)
- Staff AI user bubble: `bg-warm-paper border border-warm-line` (neutral, professional)
- Common: assistant bubble `bg-warm-white border border-warm-line`, streaming dots `bg-ink-4`

## Deviations from Plan

### Wave-parallel pre-restyle (informational, not a problem)

The `feat(11-02)` commit (LoginPage agent, wave 2) already applied restyle to `ChatPanel.tsx` and `ChatMessage.tsx` as a side-effect. Edit tool calls in this execution were idempotent — confirmed via `git diff HEAD` returning 0 lines for both files. No regression introduced.

`ContextPanel.tsx` was the only file with pending changes in this plan (commit `1944224`).

## Verification

- `rg "#[0-9a-fA-F]{3,6}" src/features/ai-assistant/{ChatPanel,ChatMessage,ContextPanel}.tsx` → 0 matches
- `rg "text-(gray|blue|red|green|yellow|amber|orange)-[0-9]" src/features/ai-assistant/*.tsx` → 0 matches
- `rg "bg-(bg-base|surface|brand-primary)|border-border-subtle" src/features/ai-assistant/*.tsx` → 0 matches
- `font-display italic` appears 3× in ContextPanel.tsx (one per section heading)
- `lg:grid-cols-[60%_40%]` confirmed in ChatPanel.tsx
- `hidden lg:flex` context column confirmed in ChatPanel.tsx
- `rounded-2xl` + `bg-warm-paper/bg-warm-white` confirmed in ChatMessage.tsx
- `variant="terracotta"` confirmed in ChatPanel.tsx
- `pnpm tsc --noEmit` exits 0

## Self-Check: PASSED

- `apps/web/src/features/ai-assistant/ChatPanel.tsx` — modified, exists, HEAD clean
- `apps/web/src/features/ai-assistant/ContextPanel.tsx` — modified, committed as `1944224`
- `apps/web/src/features/ai-assistant/ChatMessage.tsx` — modified, exists, HEAD clean
- Commit `6ea26c2` — ChatPanel + ChatMessage (wave-parallel, confirmed idempotent)
- Commit `1944224` — ContextPanel restyle
