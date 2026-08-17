# UX + Functional Gaps Sweep — 2026-05-22

**Trigger**: External QA report (Section 2 — OBS-001..010, 10 UI/UX findings).
**Goal**: Validate each OBS against current code, fix only those that are real, document false positives.
**Approach**: Hybrid SDD/GSD — formal PLAN.md + atomic commits per group + specialized sub-agent execution.

---

## Validated findings (read-only audit completed 2026-05-22 17:10)

Validation report persisted in engram (`qa/obs-validation-2026-05-22`). **5 of 10 findings are FALSE POSITIVES** — same pattern as the previous security sweep where the QA document claimed bugs that didn't exist.

| OBS | Status | Reason |
|-----|--------|--------|
| OBS-001 | ❌ FALSE POSITIVE | `HotelHomePage:122` mounts `<ReviewsSection />` with aggregated rating, count, paginated cards |
| OBS-002 | ❌ FALSE POSITIVE | `RoomsPage:79-82` fetches `/inventory/rooms` and renders grid (135-197). Empty UI = empty DB seed |
| OBS-003 | 🟡 OPTIONAL POLISH | AI chat minimalist by convention; `ConciergeTeaser` already exists in homepage |
| OBS-004 | ❌ FALSE POSITIVE | By design (Phase 14) — token-gated reviews via post-checkout email link. `/review/submit` mounted in router |
| OBS-005 | 🔴 VALID — feature gap | RoomRackTable.tsx is read-only CSS Grid; no drag-to-move/resize (schedule-x v4.6.0 limitation) |
| OBS-006 | ❌ FALSE POSITIVE | RoomsPage cards are `<button>` elements with `onClick={() => openDetail(room)}` |
| OBS-007 | 🟡 REAL polish | GuestDrawer uses bare `<select>` + mixes `text-text-*` and `text-ink-*` tokens |
| OBS-008 | 🟡 REAL polish | RoomTypesPage uses raw `bg-green-100`/`bg-gray-100` instead of design tokens |
| OBS-009 | 🔴 VALID — bug | CSS selector `.hos[data-theme="dark"]` requires both on same element; `data-theme` is on `<html>`, `.hos` on StaffLayout — overrides never fire |
| OBS-010 | ❌ FALSE POSITIVE | Sidebar button calls `useAiChatStore.open()` → ChatPanel renders. Send handlers wired |

---

## Execution groups

### G1 — Dark mode bugfix (`olaf`) — OBS-009
**Root cause**: `useTheme.ts:18-30` sets `data-theme="dark"` on `<html>`. `globals.css:87` defines `.hos[data-theme="dark"] { ... }` (compound selector — same element required). `.hos` is mounted on the StaffLayout `<div>`, NOT on `<html>`. So the CSS variable overrides never fire.

**Fix options** (pick the cleanest):
- Option A: Move `data-theme` setter from `<html>` to the `.hos` element.
- Option B: Rewrite CSS selector to `[data-theme="dark"] .hos { ... }` (descendant) OR `:where([data-theme="dark"]) .hos` (low-specificity).

Verify the theme toggle in Sidebar actually flips the UI after the fix.

**Scope**: ONLY the dark mode mechanism. Do NOT touch status badges or component-level dark mode coverage in this group — that's deferred to a future polish pass.

**Files**:
- `apps/web/src/hooks/useTheme.ts` OR
- `apps/web/src/styles/globals.css` (preferred — single-line fix to selector)
- `apps/web/src/components/layout/StaffLayout.tsx` (only if Option A)

### G2 — Form/page polish (`olaf`) — OBS-007 + OBS-008
**OBS-007 (GuestDrawer)**:
- Migrate the bare `<select>` for `documentType` to shadcn `<Select>` component (look at `apps/web/src/components/ui/select.tsx` if exists, or follow BookingFormPage Phase 15 pattern).
- Consolidate text tokens: replace `text-text-primary`, `text-text-muted` etc. with the `text-ink-1`, `text-ink-2`, `text-ink-3` ramp used in modern surfaces.
- Preserve all functionality (validation, submission, edit mode).

**OBS-008 (RoomTypesPage + RoomTypeDrawer)**:
- Replace raw color classes (`bg-green-100 text-green-800`, `bg-gray-100 text-gray-500`) with the existing `StatusPill` component (look at how `RoomsPage` uses it).
- Fix the semantic mistake: "Desactivar" action button uses `text-status-in-progress` — that token means "in-progress", not "destructive". Change to `text-terracotta` or a `destructive` variant.
- Apply same token consolidation as OBS-007 if mixed token systems are present.

**Files**:
- `apps/web/src/features/guests/GuestDrawer.tsx`
- `apps/web/src/features/inventory/RoomTypesPage.tsx`
- `apps/web/src/features/inventory/RoomTypeDrawer.tsx`
- Existing tests must still pass (do NOT modify their assertions about structure).

**Scope**: Polish only. Do NOT change form fields, validation, or business logic. Visual + token consistency only.

### G3 — Calendar drag-to-move MVP (`olaf`) — OBS-005
**Decision**: Option B from user (MVP) — implement drag-to-move only, NO resize.

**Rationale**: Resize is uncommon for hotel ops (changing duration usually goes through the drawer). Move-to-different-day is the high-frequency operation (recepción reschedules a guest).

**Approach**:
- Use **HTML5 drag-and-drop** (no @dnd-kit — consistent with existing project pattern documented in engram).
- Each event chip in `RoomRackTable.tsx` becomes `draggable={true}` with `onDragStart` setting a payload `{ reservationId, originalDate }`.
- Each empty cell becomes a drop target with `onDragOver` (preventDefault) and `onDrop` reading the payload.
- On drop: call existing reservation update endpoint (`PATCH /api/reservations/:id`) with new dates. Use TanStack Query `useMutation` + optimistic update + revert on error.
- Visual: dragged event gets `opacity-50`; drop target gets `bg-warm-cream` highlight via `onDragEnter`.

**Backend check**: Verify PATCH endpoint accepts date changes. If not, scope expands — flag for user.

**Files**:
- `apps/web/src/features/reservations/components/RoomRackTable.tsx`
- Possibly `apps/web/src/features/reservations/hooks/useReservations.ts` (or wherever the update mutation lives)
- `apps/web/src/features/reservations/RoomRackTable.spec.tsx` (or new spec — DnD testing with jsdom is finicky; add at least an integration test mocking the mutation)

### G4 — Closeout (orchestrator inline) — false positives + docs
- Document the 5 false positives in CLOSEOUT.md with evidence
- Document OBS-003 as carry-forward (optional marketing polish)
- Update PROJECT.md if needed to reflect the validated state
- Commit + push

---

## Execution waves

| Wave | Groups | Rationale |
|------|--------|-----------|
| **Wave 1** (parallel) | G1 + G2 | G1 touches `globals.css`/`useTheme.ts`; G2 touches `GuestDrawer/RoomTypesPage/RoomTypeDrawer` — different paths, no conflict |
| **Wave 2** (sequential) | G3 | Calendar DnD — independent files but waits for Wave 1 to settle |
| **Final** | G4 + verification + push | Closeout + push to GitHub |

---

## Acceptance criteria

| Gate | Target |
|------|--------|
| Dark mode toggle in Sidebar | Switches UI colors (background, text) visibly |
| GuestDrawer | shadcn Select used, token system consistent |
| RoomTypesPage | StatusPill replaces raw colors, "Desactivar" uses correct semantic token |
| Calendar drag-to-move | Drag an event chip onto an empty cell on a different day → reservation persists to backend |
| API tests | 440/440 passing (existing) |
| Web tests | 153+ passing (G3 may add 1-2 tests for DnD) |
| Lint | No new errors introduced |
| Git history | Atomic commits per group |

---

## Risks

- **R1** (G1): If CSS variables don't propagate to nested elements correctly with the new selector, more components than expected may need explicit `dark:` utilities. Mitigate: verify on 3-4 representative pages (Sidebar, GuestDrawer, RoomsPage, login).
- **R2** (G3): HTML5 DnD is finicky in jsdom — DnD tests may need Playwright-style real-browser to be reliable. Mitigate: integration test that calls handlers directly bypassing the DnD event system.
- **R3** (G3): The reservation PATCH endpoint may reject certain date changes (e.g., overlap with existing reservation). Mitigate: surface the error via toast, revert optimistic update.

---

## Status tracking

- [ ] Wave 1 — G1 + G2 dispatched
- [ ] Wave 2 — G3 dispatched
- [ ] G4 closeout + verification
- [ ] Pushed to GitHub
