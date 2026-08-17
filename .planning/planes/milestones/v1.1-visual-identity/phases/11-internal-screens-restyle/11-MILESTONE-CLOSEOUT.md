# v1.1 Milestone Closeout — Visual Identity Implementation

**Closed:** 2026-05-17
**Status:** Complete — pending manual QA sign-off
**Duration:** Phase 9 + Phase 10 + Phase 11 (all executed 2026-05-17)

---

## What Shipped

### Phase 9 — Design System Foundation (4 plans, complete 2026-05-17)

- Token vocabulary in `globals.css` (~30 CSS variables under `.hos` root class + dark variant)
- Instrument Serif + Geist + Geist Mono fonts via Google Fonts `@import`
- Dark mode via `data-theme="dark"` on `.hos` root + `useTheme` hook + `ThemeToggle` component
- FOUC-prevention inline script in `index.html` (reads localStorage before first paint)
- 6 status pills (available / reserved / occupied / cleaning / maintenance / blocked) via `Badge` + `StatusPill` CVA
- Refactored Button (+ terracotta variant), Card, Input primitives to bundle tokens
- `tokens.ts` + `tokens.spec.ts` rewritten with bundle palette (23 tokens)
- Dev-only `/design-system` demo route + 5/5 Vitest smoke tests

**Key commits:** `0546a08`, `75b8d18`, `15d6b31`, `568934f`, `1561570`, `cf1f73c`, `a5d7a2f`, `bb51582`, `8bb2a58`, `000308b`

### Phase 10 — Public Portal (6 plans, complete 2026-05-17)

- Airbnb-style `HotelHomePage` replacing bare BookingPage landing (`/` and `/booking`)
- `BookingPage.tsx` renamed to `LegacyBookingPage.tsx` (rollback path preserved)
- `TopNav` (5 anchor sections), `HeroGallery` (4 hero photos), `HotelIdentity`, `PortalFooter`
- Section components: `RoomsSection`, `ConciergeTeaser`, `RestaurantSection`, `LocationSection`, `ReviewsSection`
- `ReservationWidget` (desktop sticky sidebar / mobile fixed bottom bar) with `react-day-picker` v10 range + guest counter
- Public Concierge warm-palette restyle (`PublicConciergeLayout`, `ConciergePage`, `ChatMessage`, `VenueCard`)
- `useForceLightTheme` hook (portal always renders light, regardless of user preference)
- `useHotelInfo` (env vars, zero API dependency) + `useReservationDraft` (URL params, survives refresh)
- Hotel data modules: `hotel/`, `roomTypes/`, `reviews/`, `photos/`
- Vitest smoke tests: `HotelHomePage` (6 section IDs, 5 nav labels, CTA), `useReservationDraft`, `useForceLightTheme`

**Key commits:** `17bf439`, `888d8dc`, `177fc36`, `f61bbf3`, `f8eb1b5`, `d023eb3`, `5469d24`, `b0c4961`, `d6672fb`, `79a4629`, `0954b45`, `83d3ce3`

### Phase 11 — Internal Screens Restyle (9 plans, complete 2026-05-17)

- **StaffLayout + Sidebar** (INT-08): 240px warm-white sidebar with `useSidebarCollapsed` (localStorage), 3px terracotta accent bar, `before:` pseudo-element active state, ThemeToggle footer mount, 200ms CSS transition
- **LoginPage** (INT-01): Split-panel — left ink-1 with inline-style radial-gradient blobs (terracotta + mustard), Instrument Serif italic headline, three-stat strip (font-mono mustard numbers), right warm-white form with terracotta submit + "Ir al sitio del hotel" link
- **DashboardPage** (INT-02): Instrument Serif italic h1 + warm KPI cards (warm-paper bg, font-mono values) + `OccupancyBarChart` using `shape` prop (Recharts v2 pattern) with terracotta/mustard bars + `RoomStatusDonut` with `STATUS_COLORS` CSS variable fills
- **RoomRackTable** (INT-03): `RESERVATION_STATUS_TO_CSS` map → inline `backgroundColor: CSS var()` on reservation bars, font-mono headers, hover ring, fallback `var(--ink-4)` for unmapped statuses
- **RoomsPage + RoomDrawer** (INT-04): Table → responsive 4-column card grid with `mapPhysicalToRoomStatus` helper, warm-cream RoomDrawer background, terracotta active tab border, amenity chips (warm-paper + warm-line + rounded-full)
- **ReservationWizard** (INT-05): New `StepIndicator` component (4 circles + connector lines, terracotta active / mustard completed / warm-tan pending), `stepNum = idx + 1` off-by-one guard, connector uses SVG-free flexbox
- **HousekeepingPage** (INT-06): 4-column kanban with priority badge palette (Alta=terracotta, Media=mustard, Baja=olive), `COLUMN_BORDER_COLORS` via inline `borderTopColor` (Tailwind v4 limitation workaround), assignee avatar (font-mono initials, terracotta-tint bg), `elapsedLabel` deferred (API field not yet available)
- **ChatPanel + ContextPanel + ChatMessage** (INT-07): `grid grid-cols-[60%_40%]` 2-col layout on lg+, user bubble warm-paper / assistant bubble warm-white, `bg-ink-4 animate-pulse` streaming dots with stagger, `font-display italic` Instrument Serif context headings, mustard-tint source badges

**Shared utilities:**
- `apps/web/src/lib/status-colors.ts`: `STATUS_COLORS`, `STATUS_BG_COLORS`, `RESERVATION_STATUS_TO_CSS`
- `apps/web/src/hooks/useSidebarCollapsed.ts`: collapse state with localStorage persistence

**Key commits:** `c5a26dc`, `dbbf108`, `f90c41b`, `6ea26c2`, `f8eb1b5` (dashboard), `fa5c402`, `7ce37f4`, `b8b17e8`, `f2e3572`, `460d1f3`, `b20ac5b`, `82e5dd2`, `1944224`, `7738176`

---

## v1.1 Requirements Status

| ID | Description | Status |
|----|-------------|--------|
| VIS-01 | Tailwind v4 tokens for bundle | DONE |
| VIS-02 | Instrument Serif + Geist + Geist Mono | DONE |
| VIS-03 | Dark mode toggle | DONE |
| VIS-04 | 6 status pills consistent across surfaces | DONE |
| VIS-05 | Shadcn primitives refactored | DONE |
| PUB-07 | HotelHomePage replaces bare landing | DONE |
| PUB-08 | Hero gallery 4 photos | DONE |
| PUB-09 | TopNav 5 items + anchor scroll | DONE |
| PUB-10 | ReservationWidget sticky/bottom | DONE |
| PUB-11 | Reseñas section | DONE |
| PUB-12 | Responsive 360/768/1280 | DONE |
| PUB-13 | Concierge restyle | DONE |
| INT-01 | LoginPage split-panel | DONE |
| INT-02 | DashboardPage tokens + Recharts | DONE |
| INT-03 | RoomRackTable status bars | DONE |
| INT-04 | RoomsPage cards + RoomDrawer | DONE |
| INT-05 | ReservationWizard stepper | DONE |
| INT-06 | HousekeepingPage kanban | DONE |
| INT-07 | Staff ChatPanel restyle | DONE |
| INT-08 | Sidebar restyle + collapse | DONE |

**Total: 20/20 v1.1 REQ-IDs complete (code level — pending manual QA sign-off).**

---

## Automated Regression Results (2026-05-17)

| Check | Result | Details |
|-------|--------|---------|
| `pnpm vitest run` | PASS | 116 tests, 14 files, 0 failures |
| `pnpm tsc --noEmit` | PASS | Exit 0, no type errors |
| Zero hex literals (Phase 11 file list) | PASS | 0 matches (1 auto-fixed in ChatMessage.tsx) |
| Zero Tailwind palette (Phase 11 file list) | PASS | 0 matches in scoped file list |
| Zero `.hos-*` active classes | PASS | Only doc comments reference `.hos-card` |
| Zero v1.0 token references (Phase 11 file list) | PASS | 0 matches in scoped file list |

**Note:** Files outside Phase 11 scope (`RichToolResult.tsx`, `ReservationDrawer.tsx`, `TaskAssignmentDrawer.tsx`, `RoomStatusModal.tsx`, `ReservationsPage.tsx`, `ReportExportPage.tsx`, `RoomTypesPage.tsx`) retain v1.0 tokens and Tailwind palette classes. These are v1.0 files not in scope for v1.1 restyle. Carry-forward to v1.2 cleanup.

---

## Execution Metrics

| Phase | Plans | Commits | Files Created | Files Modified |
|-------|-------|---------|---------------|----------------|
| Phase 9 | 4 | ~10 | 8 | 6 |
| Phase 10 | 6 | ~16 | 14 | 5 |
| Phase 11 | 9 | ~20 | 2 | 16 |
| **Total v1.1** | **19** | **~46** | **24** | **27** |

New components created in v1.1: `ThemeToggle`, `StatusPill`, `Badge`, `DesignSystemPage`, `HotelHomePage`, `TopNav`, `HeroGallery`, `HotelIdentity`, `PortalFooter`, `RoomsSection`, `ConciergeTeaser`, `RestaurantSection`, `LocationSection`, `ReviewsSection`, `ReservationWidget`, `ReservationDatePicker`, `StepIndicator`

---

## Deferred to v1.2

| Item | Why Deferred | Deferral Note |
|------|--------------|---------------|
| i18n EN/ES language toggle | Scope — UI work for v1.2 | Decision logged 2026-05-17 |
| Topbar content (search/breadcrumb/notifications) | Phase 11 ships empty 56px topbar shell only | `h-14 shrink-0` placeholder |
| LoginPage three-stat real data | Hardcoded (42 hab / 78% / 12 check-ins) — `/api/login-stats` endpoint deferred | `11-02` decision |
| Storybook for primitives | Post-MVP — doc tool, not functional | Out of v1.1 scope |
| Visual regression testing (Playwright screenshot diffs) | Post-MVP — requires screenshot baseline infrastructure | Carry-forward |
| Sidebar collapse keyboard shortcut | Mouse-only in v1.1 | Low priority for v1.2 |
| Framer Motion / animation library | CSS transitions only in v1.1 (200ms) | Not needed for MVP |
| Interactive map (Leaflet/Google Maps) for LocationSection | Static placeholder (`Próximamente`) in v1.1 | `10-03` decision |
| Real hotel photos in Cloudflare R2 | Unsplash CDN in v1.1 | `public/hotel-photos/.gitkeep` staged |
| `system_config` endpoint for hotelName | Env var (`VITE_HOTEL_NAME`) in v1.1 | `10-01` decision |
| LegacyBookingPage cleanup | Preserved as rollback path — remove in v1.2 | `f61bbf3` commit |
| `elapsedLabel` in housekeeping task cards | API does not expose field yet | `11-07` decision |
| Out-of-scope v1.0 file restyle | `RichToolResult.tsx`, `ReservationDrawer.tsx`, etc. still use Tailwind palette | Not part of INT-01..08 scope |

---

## Manual QA Result

Manual QA performed: [pending — see `11-MANUAL-QA-CHECKLIST.md`]
Signed off by: [name]
Result: [ ] All pass [ ] Gaps identified

To perform QA:
1. Run `pnpm --filter web dev` → visit http://localhost:5173
2. Open `.planning/phases/11-internal-screens-restyle/11-MANUAL-QA-CHECKLIST.md`
3. Complete all 8 screen sections + dark mode + cross-cutting checks
4. Sign off the last section

---

## What's Next

### After manual QA passes:

```bash
# Tag the release
git tag v1.1.0

# Archive the milestone
/gsd-complete-milestone
```

### v1.2 Planning Candidates

The following areas have enough deferred items to warrant dedicated v1.2 planning:

1. **Topbar content** — breadcrumbs, global search, user avatar, notifications bell
2. **i18n** — ES/EN toggle, `react-i18next` setup, all string extraction
3. **Visual cleanup sweep** — restyle out-of-scope v1.0 files (`ReservationDrawer`, `RichToolResult`, `TaskAssignmentDrawer`, etc.)
4. **Real data integration** — LoginPage stats, hotel photos in R2, hotelName from `system_config`
5. **Housekeeping elapsed time** — expose `updatedAt` in API response for time-elapsed labels

Start v1.2:
```
/gsd-new-milestone
```
