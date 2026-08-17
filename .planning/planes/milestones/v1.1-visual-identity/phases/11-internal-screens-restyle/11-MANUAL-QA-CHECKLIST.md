# Phase 11 — Manual QA Checklist

**Created:** 2026-05-17
**Scope:** 8 staff-facing internal screens restyled to Claude Design bundle
**Prerequisite:** `pnpm --filter web dev` running on http://localhost:5173

---

## How to use

For each screen below: open the URL, perform the listed actions, tick each acceptance criterion. If any item fails, note it and create a gap-closure ticket (run `/gsd-plan-phase 11 --gaps` after this checklist).

---

## INT-08 — Sidebar + StaffLayout (verify first — affects every other screen)

**URL:** any authenticated route (e.g., /dashboard)

- [ ] Sidebar renders 240px wide with warm-white background and right border in warm-line
- [ ] Hovering a non-active nav item changes its background to warm-cream
- [ ] Clicking a nav item activates it: terracotta-tint background + terracotta-deep text + 3px terracotta left accent bar
- [ ] Lucide icons render in ink-2/ink-3 (inactive) and terracotta-deep (active)
- [ ] Section labels (PRINCIPAL, OPERACIÓN, ADMINISTRACIÓN) render in uppercase tracking-widest ink-4
- [ ] Click the collapse toggle (chevron icon) — sidebar shrinks to 64px in ~200ms
- [ ] After collapse: only the "H" mark (terracotta bg, warm-white text) is visible in the header area
- [ ] After collapse: section labels are hidden; icon-only nav items remain
- [ ] Reload page — collapse state persists (localStorage key: `sidebar-collapsed`)
- [ ] Click toggle again — sidebar expands to 240px in ~200ms
- [ ] Topbar renders empty at 56px tall, warm-white bg, warm-line border-bottom
- [ ] ThemeToggle visible in Sidebar footer — clicking it inverts the palette (light ↔ dark)
- [ ] After theme toggle: reload page — dark/light choice persists

**Viewports:**
- [ ] 1280px desktop: sidebar visible at 240px, topbar full width
- [ ] 768px tablet: sidebar visible; content area narrows accordingly
- [ ] 360px mobile: (sidebar collapse is expected on small screens — verify no overflow)

---

## INT-01 — LoginPage (/login)

**URL:** /login (log out if currently authenticated)

- [ ] Desktop ≥1024px: split-panel renders — left ink-1 with radial blobs (terracotta + mustard tint), right warm-white with form
- [ ] Headline "Hospitalidad, operada con inteligencia" renders in Instrument Serif with italic "operada con inteligencia"
- [ ] Three-stat strip visible: 42 habitaciones · 78% ocupación · 12 check-ins hoy
- [ ] Stat numbers render in font-mono mustard, stat labels in ink-4
- [ ] Mobile <1024px: only right panel renders (left panel hidden)
- [ ] Email input shows font-mono placeholder "admin@hotelsumapaz.co"
- [ ] Submit button "Entrar" is terracotta-filled with warm-white text
- [ ] Below button: "Ir al sitio del hotel" link in ink-3, hover underlines + turns terracotta
- [ ] Submit with invalid credentials → terracotta-soft error banner appears
- [ ] No hex color values visible in page inspector (background should be var(--ink-1), not #2a221a)

**Viewports:**
- [ ] 1280px desktop: split-panel 50/50 — left branding panel + right form panel both visible
- [ ] 768px tablet: verify left panel visibility (breakpoint is 1024px — tablet should show only form)
- [ ] 360px mobile: form-only, centered, no horizontal overflow

---

## INT-02 — DashboardPage (/dashboard)

**URL:** /dashboard (authenticated)

- [ ] Page h1 in Instrument Serif italic at text-3xl (greeting or title)
- [ ] KPI cards render with warm-paper background, warm-line border, rounded-xl
- [ ] Each KPI label in font-mono uppercase tracking-widest text-ink-3 at approximately 11px
- [ ] Each KPI value in font-mono text-3xl text-ink-1
- [ ] Delta indicators: positive delta in olive, negative delta in terracotta
- [ ] Occupancy bar chart renders below KPI grid
- [ ] Today's bar uses terracotta fill (verifiable: today's date column stands out)
- [ ] Other days use mustard fill
- [ ] Room status donut renders with 6 slice colors matching status tokens:
  - [ ] Occupied → terracotta (#c4623f approx — do NOT check hex, verify it matches Status Pills)
  - [ ] Cleaning → mustard
  - [ ] Reserved → reserved-blue
  - [ ] Available → olive-green
  - [ ] Maintenance → grey-brown
  - [ ] Blocked → dark ink
- [ ] Chart axes and grid lines use warm ink — no black SVG fills visible
- [ ] No Recharts default blue bars visible

---

## INT-03 — Calendar (/reservations)

**URL:** /reservations (the room rack calendar view)

- [ ] Date header row: warm-cream bg, font-mono day labels in ink-1
- [ ] Today's column highlighted with terracotta-tint bg + terracotta-deep text
- [ ] Room row headers: font-mono ink-1, room numbers clearly prominent
- [ ] Reservation bars are color-coded by status:
  - [ ] CONFIRMED → reserved-blue (cool blue)
  - [ ] CHECKED_IN → terracotta (warm orange-red)
  - [ ] CHECKED_OUT → maintenance grey-brown (muted)
  - [ ] NO_SHOW → blocked dark (nearly black)
  - [ ] CANCELLED → faded ink-4 with reduced opacity (~0.6)
  - [ ] PENDING → cleaning mustard
- [ ] Hover over a reservation bar: terracotta outline ring appears
- [ ] Drag-to-create still functions (drag empty cell range → new reservation workflow opens)
- [ ] Click an existing reservation bar → opens ReservationDrawer detail view

---

## INT-04 — RoomsPage (/rooms)

**URL:** /rooms

- [ ] Rooms render as card grid (NOT a table — no thead/tbody visible)
- [ ] 4 columns at xl viewport (1280px), responsive to fewer columns at smaller sizes
- [ ] Each card: photo placeholder (warm-cream bg if no photo), room number in font-mono large, type label below in ink-3, StatusPill at top-right
- [ ] Card background warm-white, warm-line border, rounded-xl
- [ ] Hovering a card shows warm-line-strong border + subtle shadow lift
- [ ] "Nueva habitación" button is terracotta variant (warm-orange fill)
- [ ] Click a room card → RoomDrawer slides in from right with warm-cream background
- [ ] RoomDrawer: tabs (Detalles / Reservas / Limpieza / Mantenimiento / Historial) render in pill row
- [ ] Active tab has 2px terracotta bottom-border + terracotta-deep text weight
- [ ] Inactive tabs in ink-3, hover turns ink-1
- [ ] Amenity chips render with warm-paper bg + warm-line border + rounded-full
- [ ] RoomDrawer close (X) button visible at top-right
- [ ] No table rows or Tailwind palette classes visible

---

## INT-05 — ReservationWizard

**URL:** /reservations/new (or wherever the wizard mounts — may need an active session)

- [ ] StepIndicator row at top: 4 circles + labels
- [ ] Active step: terracotta bg + ring-4 terracotta-tint + warm-white number
- [ ] Completed step: mustard bg + warm-white checkmark icon (✓)
- [ ] Pending step: warm-tan bg + ink-3 number
- [ ] Connector lines: mustard if completed, warm-line otherwise
- [ ] Step labels in Geist 13px uppercase tracking-wide
- [ ] Step content panel: warm-white bg, warm-line border, rounded-xl, p-6 padding
- [ ] Navigate forward (click Next/Continuar): previous step circle turns mustard with checkmark
- [ ] Back button uses outline variant; Confirmar (step 4) uses terracotta variant
- [ ] Step 1 — date picker renders, check-in/check-out dates selectable
- [ ] Step 2 — available rooms shown as cards with photo placeholder + room number
- [ ] Step 3 — guest form fields (nombre, documento, etc.) render with warm-paper inputs
- [ ] Step 4 — confirmation summary renders in warm-white card
- [ ] All form validations still trigger appropriately (empty submission shows errors)

---

## INT-06 — HousekeepingPage (/housekeeping)

**URL:** /housekeeping

- [ ] 4-column kanban grid renders (1 col on mobile, 2 on md, 4 on lg)
- [ ] Column headers: warm-cream bg + ink-1 title + font-mono count badge in warm-paper
- [ ] Column accent border-top (3px) — each column matches its status token:
  - [ ] DIRTY / Pendiente → terracotta top border
  - [ ] IN_PROGRESS / En proceso → mustard top border
  - [ ] INSPECTION / Listo → reserved-blue top border
  - [ ] CLEAN / Verificado → olive top border
- [ ] Task cards: warm-white bg, warm-line border, hover with shadow-sm
- [ ] Priority badges:
  - [ ] Alta → terracotta bg, warm-white text
  - [ ] Media → mustard bg, warm-white text
  - [ ] Baja → olive bg, warm-white text
- [ ] Assignee avatar: ~28px circle, terracotta-tint bg, terracotta-deep font-mono initials
- [ ] Unassigned tasks show dashed border + UserPlus icon
- [ ] No Tailwind palette colors in priority badges (no bg-red-500, bg-amber-500, bg-emerald-500)
- [ ] Click a room card → RoomStatusModal opens
- [ ] Click "Asignar" on a task card → TaskAssignmentDrawer opens

**Viewports:**
- [ ] 1280px desktop: 4-column grid fully visible
- [ ] 768px tablet: 2-column layout
- [ ] 360px mobile: single-column stack

---

## INT-07 — ChatPanel (AI Assistant)

**URL:** any authenticated screen — click the floating AI button (bottom-right)

- [ ] Floating button: terracotta circle bottom-right with Sparkles icon in warm-white
- [ ] Click → panel slides in from the right (or overlays on mobile)
- [ ] Desktop ≥1024px: 2-column layout — chat left (60%), context right (40%)
- [ ] Mobile <1024px: single column; context panel hidden
- [ ] Panel header: "Asistente IA" in Instrument Serif italic; close button (X) top-right
- [ ] Empty state: ink-3 prompt text + suggestion chips with warm-line border, hover warm-cream
- [ ] Send button: terracotta variant with Send icon
- [ ] Type a question and submit → user bubble appears right-aligned, bg-warm-paper, warm-line border, rounded-2xl
- [ ] Assistant response streams → assistant bubble left-aligned, bg-warm-white, warm-line border
- [ ] Streaming indicator: three pulsing bg-ink-4 dots with staggered delay
- [ ] Context panel section headings (FUENTES CONSULTADAS, ACCIONES SUGERIDAS) in Instrument Serif italic
- [ ] Tool result cards in context panel: warm-white bg, warm-line border, rounded-lg
- [ ] No terracotta user bubble (staff chat uses neutral warm-paper, not brand terracotta)

**Viewports:**
- [ ] 1280px desktop: 2-column chat/context layout
- [ ] 768px tablet: verify context panel hidden/visible behavior
- [ ] 360px mobile: single-column, send button accessible

---

## Dark Mode (Cross-Cutting)

**Toggle location:** Sidebar footer (moon/sun icon)

- [ ] Toggle dark mode → entire app inverts to dark palette within one paint frame
- [ ] Dark mode: sidebar bg becomes dark ink, warm-cream text, terracotta accents remain
- [ ] Dark mode: KPI cards use dark surface bg (warm-paper dark variant)
- [ ] Dark mode: login page left panel (already dark) remains consistent
- [ ] Dark mode: chart colors remain readable (terracotta/mustard maintain contrast)
- [ ] Reload page — dark mode persists (localStorage)
- [ ] Toggle back to light → app restores warm palette

---

## Cross-Cutting Visual Consistency

- [ ] All status pills render with consistent fg/bg pairs across Rooms, Calendar, Housekeeping, Dashboard
- [ ] All numeric displays (room numbers, KPI values, dates, prices, time-elapsed) use Geist Mono (font-mono)
- [ ] All h1/h2/h3 headings use Instrument Serif (font-display)
- [ ] No Tailwind palette colors visible on Phase 11 screens (no blue-500, red-100, green-800, etc.)
- [ ] No hardcoded hex values visible on Phase 11 screens
- [ ] Error states use terracotta-tint/terracotta palette (not red-50/red-200)
- [ ] Buttons in primary action slots use terracotta variant consistently

---

## Sign-off

QA performed by: ___________________
Date: ___________________
Result: [ ] All pass [ ] Gaps identified (list below)

### Gaps identified

(Empty if all passed. Each gap should be addressed via `/gsd-plan-phase 11 --gaps`.)
