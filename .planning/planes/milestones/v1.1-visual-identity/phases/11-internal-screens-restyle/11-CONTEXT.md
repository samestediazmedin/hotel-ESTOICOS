# Phase 11: Internal Screens Restyle — Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Source:** Auto-derived from Claude Design bundle screens + REQUIREMENTS.md (INT-01..08) + ROADMAP.md success criteria

<domain>
## Phase Boundary

Restyle **all 8 internal staff screens** to the bundle visual identity. Every screen exists already in `apps/web/src/` from v1.0 — this phase is **visual restyle only**, no functional changes. The Phase 9 foundation (tokens + primitives) and Phase 10 hooks (`useForceLightTheme` — though NOT used here; staff CAN use dark mode) are the consumed dependencies.

**8 screens in scope:**
1. **`/login`** → `apps/web/src/features/auth/LoginPage.tsx` (split-panel design)
2. **`/dashboard`** → `apps/web/src/features/reporting/DashboardPage.tsx` (KPI cards + Recharts)
3. **Calendar** → `apps/web/src/features/reservations/RoomRackCalendar.tsx` + `components/RoomRackTable.tsx` (room rack)
4. **`RoomsPage`** → `apps/web/src/features/inventory/RoomsPage.tsx` + `RoomDrawer.tsx` (rooms grid + drawer)
5. **`ReservationWizard`** → `apps/web/src/features/reservations/wizard/ReservationWizard.tsx` (visual stepper)
6. **`HousekeepingPage`** → `apps/web/src/features/housekeeping/HousekeepingPage.tsx` (kanban 4 columns)
7. **`ChatPanel`** → `apps/web/src/features/ai-assistant/ChatPanel.tsx` (staff AI chat + context panel)
8. **`StaffLayout` + `Sidebar`** → `apps/web/src/components/layout/StaffLayout.tsx` + `Sidebar.tsx`

**Out of scope:**
- Backend changes — frontend `apps/web` only
- New functionality, new routes, new API contracts
- Public portal (Phase 10 territory)
- Tokens, primitives, fonts (Phase 9 territory — already in place)
- Storybook / visual regression infra
- i18n
- Mobile-native staff app (web responsive only)

</domain>

<decisions>
## Implementation Decisions (locked by bundle + roadmap)

### Visual restyle ONLY — no logic changes
Every plan in Phase 11 MUST preserve:
- Component contracts (props, state, callbacks, query hooks)
- React Query keys + invalidation patterns
- Socket.io event listeners
- Form validation logic
- Route guards (`ProtectedRoute`, `RolesGuard`)
- Test assertions (existing `.test.tsx` files should still pass after restyle)

If a restyle requires logic change (e.g., adding a new state for the visual stepper's progression), document as a deviation in SUMMARY but keep the diff minimal.

### Staff CAN use dark mode
Unlike public portal (Phase 10 forced light), staff screens RESPECT `data-theme="dark"`. The `ThemeToggle` from Phase 9 mounts in the Sidebar footer (INT-08). All staff screens already inherit dark mode via the `.hos[data-theme="dark"]` cascade — no extra work per screen.

### Per-screen visual contract

**INT-01 — LoginPage split-panel (`/login`)**
- **Container**: `<div className="hos min-h-screen grid lg:grid-cols-2">` (mobile = single column stacked)
- **Left panel** (decorative): `bg-ink-1` background. Decorative radial-gradient blobs (terracotta + mustard) — implement via `<div className="absolute inset-0 bg-[radial-gradient(at_20%_30%,var(--terracotta)_0%,transparent_50%),radial-gradient(at_80%_70%,var(--mustard)_0%,transparent_50%)] opacity-30">`. Headline `<h1 className="font-display text-5xl text-warm-white">Hospitalidad, <i>operada con inteligencia</i></h1>`. Three-stat strip at bottom: `42 habitaciones`, `78% ocupación`, `12 check-ins hoy` — each in Geist Mono with mustard accent number.
- **Right panel**: `bg-warm-white` background. Logo at top (terracotta H mark + "Hotel <i>Sumapaz</i>"). Email + Password inputs (existing shadcn Input from Phase 9). Primary button "Entrar" — `variant="terracotta"`. Secondary link "Ir al sitio del hotel" → `<Link to="/">` with `text-ink-3 hover:text-terracotta` underline.
- **Mobile (<lg)**: only the right panel renders (left panel `hidden lg:block`). Logo at top.
- **Email hint**: `font-mono` placeholder "admin@hotelsumapaz.co"
- **Existing logic preserved**: `useAuthStore`, `mutate(login)`, redirect to `/dashboard` on success.

**INT-02 — DashboardPage (`/dashboard`)**
- **Page heading**: `<h1 className="font-display italic text-3xl text-ink-1">Buen día, {firstName}</h1>` (32px = `text-3xl` in Tailwind v4)
- **KPI cards**: existing v1.0 layout, restyled. Each card: `bg-warm-paper border border-warm-line rounded-xl p-4`. Label in Geist 12px uppercase tracking-wide ink-3. Number in `font-mono text-3xl text-ink-1`. Delta indicator (`↑ 4%`) in olive (positive) or terracotta (negative).
- **Recharts BarChart** (occupancy by day): bar fill `var(--terracotta)` for today's bar, `var(--mustard)` for past days. Use shadcn chart primitive (already wraps Recharts).
- **Recharts PieChart / Donut** (room status breakdown): slices map to status tokens — available olive, reserved reserved-blue, occupied terracotta, cleaning mustard, maintenance ink-3, blocked ink-1.
- **Section dividers**: `border-t border-warm-line my-8`
- **Existing logic preserved**: `useDashboardKpis()` React Query hook, all data fetching.

**INT-03 — RoomRackTable / Calendar**
- **Date header row**: `bg-warm-cream border-b border-warm-line`. Days in `font-mono text-xs`. Today highlighted with `bg-terracotta-tint text-terracotta-deep`.
- **Room row headers**: `font-mono text-sm text-ink-1`. Room status indicator (small colored dot) using status tokens.
- **Reservation bars** (the colored rectangles inside the grid): color-coded by status using `data-status` attribute pattern. CSS: `[data-status="occupied"] { background: var(--status-occupied); }` etc. Bar text in `text-warm-white text-xs font-medium`.
- **Hover state**: bar `opacity-90 cursor-pointer outline outline-2 outline-terracotta`.
- **Selected cell**: `bg-terracotta-tint border-2 border-terracotta`.
- **Empty cell**: `bg-warm-white border border-warm-line`.
- **Existing logic preserved**: drag-to-create, click-to-edit, scroll virtualization.

**INT-04 — RoomsPage + RoomDrawer**
- **RoomsPage grid**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`. Each room card: `bg-warm-white border border-warm-line rounded-xl overflow-hidden`. Photo placeholder (aspect-video, bg-warm-cream if no photo). Below photo: room number `font-mono text-xl`, type label `text-ink-2 text-sm`, StatusPill (Phase 9 primitive) at bottom-right.
- **Empty state**: bundle's `hos-empty` pattern — center column, warm-paper bg, mustard icon, ink-2 caption.
- **RoomDrawer** (slides in from right when clicking a card):
  - `bg-warm-cream` background
  - Tab row at top: `border-b border-warm-line`. Active tab: `border-b-2 border-terracotta text-terracotta-deep`. Inactive: `text-ink-3 hover:text-ink-1`.
  - Tabs: General · Fotos · Amenidades · Histórico
  - Amenity chips: `inline-flex items-center gap-1 px-3 py-1 rounded-full bg-warm-paper border border-warm-line text-ink-2 text-sm`
  - Close button (X) top-right: `hover:bg-warm-paper rounded-md`
- **Existing logic preserved**: `useRooms()` query, drawer open/close state, mutation hooks.

**INT-05 — ReservationWizard visual stepper**
- **Stepper row** at top of wizard: `flex items-center justify-center gap-4 py-6`. Each step: circle (32px) + label below.
- **Step states**:
  - **Active**: `bg-terracotta text-warm-white ring-4 ring-terracotta-tint`, label `font-medium text-terracotta-deep`
  - **Completed**: `bg-mustard text-warm-white` with check icon (`lucide-check`), label `text-ink-2`
  - **Pending**: `bg-warm-tan text-ink-3`, label `text-ink-3`
- **Connector lines** between steps: `h-px bg-warm-line w-12` (between dots). Completed connector: `bg-mustard`.
- **Step labels**: Geist 13px (`text-[13px]`), uppercase tracking-wide.
- **Step content area**: `bg-warm-white border border-warm-line rounded-xl p-6 mt-6`.
- **Nav buttons** at bottom: Back (`variant="outline"`), Next/Confirmar (`variant="terracotta"`).
- **Existing logic preserved**: `useWizardState`, step validation, mutation submission.

**INT-06 — HousekeepingPage kanban**
- **4 columns**: Pendiente · En proceso · Listo · Verificado. Layout: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`.
- **Column header**: `bg-warm-cream border border-warm-line rounded-t-xl px-4 py-3`. Title `font-medium text-ink-1`. Count badge `font-mono text-xs bg-warm-paper text-ink-2 px-2 py-0.5 rounded-full`.
- **Task card**: `bg-warm-white border border-warm-line rounded-lg p-3 mb-2 cursor-pointer hover:shadow-sm`. Room number `font-mono`. Priority badge top-right:
  - **Alta**: `bg-terracotta text-warm-white`
  - **Media**: `bg-mustard text-warm-white`
  - **Baja**: `bg-olive text-warm-white`
- **Assignee avatar**: circle (28px) with initials `font-mono text-xs bg-terracotta-tint text-terracotta-deep`. If unassigned: dashed border + lucide UserPlus icon.
- **Time-elapsed label**: `font-mono text-xs text-ink-3` (e.g., "12 min" / "1h 24min")
- **Drag-and-drop**: existing v1.0 logic preserved — visual feedback `ring-2 ring-terracotta` on drag-over.
- **Socket.io real-time updates**: preserved.

**INT-07 — ChatPanel (staff AI)**
- **Layout**: 2-column. Left = chat thread (60%). Right = context panel (40%, `lg:` only — hidden on mobile).
- **Message bubbles**:
  - **User**: `bg-warm-paper text-ink-1 border border-warm-line rounded-2xl p-3`, aligned right
  - **Assistant**: `bg-warm-white text-ink-1 border border-warm-line rounded-2xl p-3`, aligned left
  - **Streaming indicator**: three dots `bg-ink-4 rounded-full` pulse
- **Context panel** (right side):
  - Section headings: `font-display italic text-xl text-ink-1 mb-3` — "FUENTES CONSULTADAS", "ACCIONES SUGERIDAS"
  - Tool result cards: `bg-warm-white border border-warm-line rounded-lg p-3 mb-2`
  - Badges in tool results: `inline-flex px-2 py-0.5 rounded-full bg-mustard-tint text-mustard text-xs font-medium`
- **Input bar** at bottom: `bg-warm-white border-t border-warm-line p-4`. Textarea `bg-warm-paper border-warm-line`. Send button `variant="terracotta"`.
- **Empty state**: ink-3 caption with suggestion chips (`border border-warm-line hover:bg-warm-cream`).
- **Existing logic preserved**: SSE streaming, tool loop, conversation history persistence.

**INT-08 — Sidebar + StaffLayout**
- **Sidebar layout** (240px wide, full-height): `bg-warm-white border-r border-warm-line flex flex-col p-3`
- **Logo block** at top: terracotta H mark + Hotel name (Instrument Serif)
- **Nav items**: `flex items-center gap-3 px-3 py-2 rounded-md text-ink-2 hover:bg-warm-cream hover:text-ink-1`
- **Active nav item**: `bg-terracotta-tint text-terracotta-deep relative` with pseudo-element `before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-terracotta before:rounded-r` (the 2px terracotta left accent bar)
- **Icons**: lucide-react, size 18, `text-ink-3` default / `text-terracotta-deep` active
- **Section labels** ("PRINCIPAL", "OPERACIÓN", "ADMINISTRACIÓN"): `text-xs uppercase tracking-wider text-ink-4 font-medium px-3 mt-4 mb-2`
- **Footer**: ThemeToggle (from Phase 9) + user info dropdown
- **Collapse behavior**: existing v1.0 collapse state preserved. Sidebar transitions via `transition-[width] duration-200 ease-in-out`. When collapsed (64px wide): icons only, labels hidden via `lg:opacity-100` (or similar pattern). 200ms or less per ROADMAP criterion.
- **StaffLayout grid**: `grid grid-cols-[240px_1fr]` (or `[64px_1fr]` when collapsed) `grid-rows-[56px_1fr]`. Topbar `bg-warm-white border-b border-warm-line`. Main area `bg-warm-paper overflow-auto`.
- **StaffLayout `bg-warm-paper` token fix**: Phase 9 already changed `bg-bg-base` → `bg-warm-paper`. Confirm still correct.
- **Existing logic preserved**: route guards, user store, collapse persistence in localStorage.

### Verification scope (Phase 11 only)
- `apps/web/src/features/auth/LoginPage.tsx`
- `apps/web/src/features/reporting/DashboardPage.tsx`
- `apps/web/src/features/reservations/RoomRackCalendar.tsx` + `components/RoomRackTable.tsx`
- `apps/web/src/features/inventory/RoomsPage.tsx` + `RoomDrawer.tsx`
- `apps/web/src/features/reservations/wizard/ReservationWizard.tsx` (+ any wizard step components)
- `apps/web/src/features/housekeeping/HousekeepingPage.tsx`
- `apps/web/src/features/ai-assistant/ChatPanel.tsx`
- `apps/web/src/components/layout/StaffLayout.tsx` + `Sidebar.tsx`

### Verification commands
1. `rg "#[0-9a-fA-F]{3,6}" apps/web/src/features apps/web/src/components/layout --glob "*.tsx"` → zero matches outside Phase 9 token source
2. `rg "text-(gray|blue|red|green|yellow|purple|pink|indigo|slate|zinc|neutral|stone|amber|orange|lime|emerald|teal|cyan|sky|violet|fuchsia|rose)-[0-9]" apps/web/src/features apps/web/src/components/layout --glob "*.tsx"` → zero Tailwind palette colors
3. `rg "\.hos-(card|pill|btn|avatar|logo-mark)" apps/web/src --glob "*.{ts,tsx,css}"` → zero global class references (utility compositions only)
4. `pnpm --filter web test` — all existing `.test.tsx` files still pass (regression safety net)
5. Manual: visit all 8 screens at 1280px desktop viewport, verify visual match to bundle
6. Manual: toggle dark mode in Sidebar → entire staff app inverts; toggle back → reverts
7. Manual: collapse/expand Sidebar → 200ms or less transition

### Claude's Discretion
- Exact pixel values when bundle and Tailwind utilities don't perfectly align (round to nearest Tailwind step)
- Whether to extract sub-components (e.g., `KpiCard`, `StatusBar`, `StepIndicator`) into reusable bits OR keep inline JSX
- Mobile breakpoint behavior for screens that don't have a mobile bundle variant (Login is the only one with explicit mobile in bundle)
- Lucide icon choices when bundle uses custom HosIcon names (`info`, `refresh`, `more`, `grid`, `pin` etc. — map to closest lucide equivalent)
- Whether `useTheme` toggle goes in Sidebar footer or Topbar (bundle implies Sidebar footer based on tokens.jsx pattern)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source (locked — bundle is verbatim visual source of truth)
- `.design-fetch/hotelos-ai/project/screens/login.jsx` — split-panel layout for INT-01
- `.design-fetch/hotelos-ai/project/screens/dashboard.jsx` — KPI + Recharts for INT-02
- `.design-fetch/hotelos-ai/project/screens/calendar.jsx` — room rack visual for INT-03
- `.design-fetch/hotelos-ai/project/screens/rooms.jsx` — grid + drawer for INT-04
- `.design-fetch/hotelos-ai/project/screens/reservations.jsx` — wizard stepper for INT-05
- `.design-fetch/hotelos-ai/project/screens/operations.jsx` — kanban for INT-06
- `.design-fetch/hotelos-ai/project/screens/internal-chat.jsx` — staff chat + context panel for INT-07
- `.design-fetch/hotelos-ai/project/tokens.jsx` — chrome primitives (`hos-app`, `hos-sidebar`, `hos-topbar`, `hos-nav`, etc.) for INT-08; lines 105-200 are the chrome layout reference
- `.design-fetch/hotelos-ai/chats/chat1.md` — design rationale

### Project requirements
- `.planning/REQUIREMENTS.md` — INT-01..08
- `.planning/ROADMAP.md` — Phase 11 section: 8 success criteria
- `.planning/PROJECT.md` — stack + architecture

### Phase 9 foundation (consume, do not modify)
- `apps/web/src/styles/globals.css` — token vocabulary
- `apps/web/src/components/ui/{button,card,input,badge,status-pill,theme-toggle}.tsx` — primitives
- `apps/web/src/hooks/useTheme.ts` — dark mode hook

### Phase 10 (cross-reference only)
- `.planning/phases/10-public-portal/10-05-SUMMARY.md` — Concierge restyle patterns (similar visual approach for INT-07 staff chat)

### Existing v1.0 code (refactor targets — 11 files)
All listed in Per-screen visual contract above.

### Dependencies (already installed)
- All Phase 9/10 dependencies
- `recharts` v2.x — already in v1.0
- `@dnd-kit/*` (or whichever DnD lib v1.0 uses) — already in v1.0

</canonical_refs>

<specifics>
## Specific Ideas

### Stepper sub-component
Extract `StepIndicator.tsx` (state circle + label) as a reusable bit in `apps/web/src/features/reservations/wizard/`. Takes `{ state: 'active' | 'completed' | 'pending', label: string, stepNumber: number }`. Reusable in any future multi-step flow.

### KPI card sub-component
Extract `KpiCard.tsx` in `apps/web/src/features/reporting/` (or shared `components/`). Takes `{ label, value, delta?, deltaTrend?: 'up' | 'down' }`. Reduces DashboardPage clutter.

### Recharts color contract
Map status enum → CSS variable directly inside the chart config. Don't repeat the mapping in 3 places (kanban, calendar, dashboard donut). One helper:
```ts
const STATUS_COLORS: Record<RoomStatus, string> = {
  available: 'var(--status-available)',
  reserved: 'var(--status-reserved)',
  occupied: 'var(--status-occupied)',
  cleaning: 'var(--status-cleaning)',
  maintenance: 'var(--status-maintenance)',
  blocked: 'var(--status-blocked)',
};
```
Put in `apps/web/src/lib/status-colors.ts`. Used by RoomRackTable, HousekeepingPage (via priority mapping), DashboardPage donut.

### Sidebar accent bar implementation
Avoid pseudo-elements if Tailwind v4 utility approach is cleaner. Alternative: an absolutely-positioned `<span>` as first child of the nav item — same visual result, easier to test.

### ChatPanel context column responsive
Hide on mobile (`lg:block hidden`). Phase 11 is desktop-first for staff — mobile is acceptable but not the primary target. Bundle shows desktop layout only for internal screens.

### Login mobile fallback
Bundle has no mobile variant for login. On mobile (<lg), render only the right panel + center the logo at top. Acceptable Discretion.

### LoginPage three-stat strip data source
Hardcode for v1.1 (`42 habitaciones`, `78% ocupación`, `12 check-ins hoy`). Real data wiring deferred to v1.2 (would need a public `/api/login-stats` endpoint).

</specifics>

<deferred>
## Deferred Ideas

- **Visual regression testing** (Playwright + screenshot diffs) — post-v1.1
- **Storybook for primitives** — post-v1.1
- **Animation/motion library** (Framer Motion) — bundle uses CSS transitions, sticking with that
- **i18n EN/ES toggle** — v1.2 milestone
- **A11y audit (WCAG AA contrast verification)** — spot-check during planning, full audit deferred
- **Print stylesheets** for reports — not in v1.1
- **Custom HosIcon → lucide mapping document** — keep ad-hoc per screen, formalize if reuse pattern emerges
- **`/login` three-stat real data** — hardcoded in v1.1
- **Sidebar collapse keyboard shortcut** — mouse-only in v1.1

</deferred>

---

*Phase: 11-internal-screens-restyle*
*Context gathered: 2026-05-17 — auto-derived from Claude Design bundle*
