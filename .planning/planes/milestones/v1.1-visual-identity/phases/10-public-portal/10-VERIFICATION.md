---
phase: 10-public-portal
verified: 2026-05-17T17:35:00Z
status: passed
score: 6/6 success criteria verified
re_verification: false
human_verification:
  - test: "Visual viewport check at 360px, 768px, 1280px"
    expected: "No horizontal overflow, layout reflows correctly, hero gallery collapses, reservation widget shows as fixed bottom bar at 360px"
    why_human: "CSS media queries and layout rendering cannot be verified programmatically without a browser"
  - test: "Anchor scroll behavior — click Habitaciones in TopNav"
    expected: "Smooth scroll to #habitaciones section; heading visible below sticky nav (scroll-mt-20 clears 64px nav)"
    why_human: "scrollIntoView behavior requires browser rendering engine"
  - test: "Concierge palette at /concierge"
    expected: "Page bg is warm-paper (off-white, not gray), logo mark is terracotta, user bubbles are terracotta + warm-white text, VenueCard titles use Instrument Serif"
    why_human: "Visual palette assessment requires browser rendering of CSS custom properties"
  - test: "Dark-mode leak prevention — staff flow"
    expected: "Navigate /dashboard with dark mode on, then / and /concierge show in light mode; back to /dashboard restores dark"
    why_human: "Runtime state transition across routes requires browser session"
  - test: "Reservar button navigation — date picker → commit"
    expected: "Select date range, click Reservar, URL changes to /booking/rooms?checkIn=...&checkOut=...&adults=N, BookingResultsPage renders"
    why_human: "Real URL navigation and cross-page rendering requires browser"
---

# Phase 10: Public Portal — Verification Report

**Phase Goal:** Visitor lands on `/` (or `/booking`) sees a rich Airbnb-style hotel landing — hero gallery, hotel identity, navigation, sticky reservation widget, curated reviews — reflecting the bundle design; `/concierge` public chat UI restyled with warm palette.

**Verified:** 2026-05-17T17:35:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/` and `/booking` render `HotelHomePage`; hotel name from `VITE_HOTEL_NAME` with fallback "Hotel Sumapaz"; hero gallery, nav, sections visible | VERIFIED | `router.tsx` lines 61-63 + 80-81 mount `HotelHomePage` at both paths; `useHotelInfo()` reads `import.meta.env.VITE_HOTEL_NAME ?? HOTEL_INFO_FALLBACK.hotelName`; no `ProtectedRoute` wrapper on either route |
| 2 | Top nav shows 5 items (Inicio · Habitaciones · Restaurante · Concierge · Ubicación); anchor-scrolls within page; no separate routes for Restaurante/Ubicación | VERIFIED | `TopNav.tsx` — `NAV_ITEMS` array has exactly 5 entries with correct labels; Concierge calls `onConciergeClick()` (navigate to `/concierge`); others call `onNavClick(id)` via `scrollToSection`; no new routes in `router.tsx` for restaurante/ubicacion |
| 3 | At 360px: single-column reflow, reservation widget → fixed bottom bar, photo gallery → 2-col 2-row grid, no horizontal overflow | VERIFIED (code) / NEEDS HUMAN (visual) | `HeroGallery.tsx` — `grid lg:hidden` + `gridTemplateColumns: '1.6fr 1fr'`; `ReservationWidget.tsx` — `lg:hidden fixed bottom-0` for mobile-bar; `HotelHomePage.tsx` — no `overflow-*` on grid wrapper; 2-col grid only at `lg:` breakpoint |
| 4 | Reservation widget: functional react-day-picker v10 range picker + guest counter + price display + Reservar → `/booking/rooms` | VERIFIED | `ReservationDatePicker.tsx` — `DayPicker mode="range" locale={es} disabled={{ before: new Date() }}`; `ReservationWidget.tsx` — `GuestCounter` with -/+ buttons clamped 1..10; price: `Desde $${(pricePerNight/1000).toFixed(0)}k`; `Button variant="terracotta" onClick={commit}`; `commit()` navigates to `/booking/rooms?checkIn=X&checkOut=Y&adults=N` |
| 5 | Reseñas section: aggregated rating + count + at least 4 review cards; data hardcoded | VERIFIED | `reviews.ts` — `REVIEWS.length === 5`; `ReviewsSection.tsx` — renders `rating.toFixed(2)` + `· {reviewCount} reseñas` + maps `reviews` array; `HOTEL_INFO_FALLBACK.rating = 4.84`, `reviewCount = 318`; all review cards have authorName + date + rating + comment |
| 6 | `/concierge` — warm-palette bubbles, terracotta send button, Instrument Serif VenueCard titles, `var(--warm-paper)` background | VERIFIED | `ChatMessage.tsx` — user bubble `bg-terracotta text-warm-white`, assistant `bg-warm-white text-ink-1 border border-warm-line`; `ConciergePage.tsx` — send button `bg-terracotta hover:bg-terracotta-deep`; `VenueCard.tsx` — `h3 className="font-display text-base text-ink-1"`; `PublicConciergeLayout.tsx` — root `bg-warm-paper` |

**Score:** 6/6 truths verified (5 fully automated + 1 code-verified with 5 visual checks deferred to human)

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/web/src/features/public-portal/data/hotel.ts` | VERIFIED | Exports `HOTEL_INFO_FALLBACK: HotelInfo` with rating 4.84, reviewCount 318, 4 tags |
| `apps/web/src/features/public-portal/data/roomTypes.ts` | VERIFIED | `ROOM_TYPES.length === 4`; `getCheapestRoom()` helper exported; Suite Andina has `badge: 'mejor-valor'` |
| `apps/web/src/features/public-portal/data/reviews.ts` | VERIFIED | `REVIEWS.length === 5`; realistic Spanish names + Jan–May 2026 dates |
| `apps/web/src/features/public-portal/data/photos.ts` | VERIFIED | 5 Unsplash CDN URLs |
| `apps/web/src/features/public-portal/hooks/useHotelInfo.ts` | VERIFIED | Synchronous; reads `VITE_HOTEL_NAME/ADDRESS` with `??` fallback |
| `apps/web/src/features/public-portal/hooks/useReservationDraft.ts` | VERIFIED | URL params `checkIn`/`checkOut`/`adults`; `commit()` navigates to `/booking/rooms?...` |
| `apps/web/src/features/public-portal/hooks/useForceLightTheme.ts` | VERIFIED | `removeAttribute('data-theme')` on mount; restores on unmount if prev existed |
| `apps/web/src/features/public-portal/types.ts` | VERIFIED | Exports `HotelInfo`, `RoomTypeCard`, `Review`, `Photo` |
| `apps/web/src/features/public-portal/HotelHomePage.tsx` | VERIFIED | `useForceLightTheme()` first in body; `hos` class on root; all 6 section ids present |
| `apps/web/src/features/public-portal/components/TopNav.tsx` | VERIFIED | `NAV_ITEMS` has exactly 5 entries; Concierge uses `onConciergeClick`; `hidden md:flex` on nav list |
| `apps/web/src/features/public-portal/components/HeroGallery.tsx` | VERIFIED | `hidden lg:grid` (desktop 5-cell) + `grid lg:hidden` (mobile 3-cell); "Ver las N fotos" overlay present |
| `apps/web/src/features/public-portal/components/HotelIdentity.tsx` | VERIFIED | `<h1>` with `font-display`; italic second word via `<i className="italic">`; `fill-mustard` stars; tag pills as inline spans |
| `apps/web/src/features/public-portal/components/RoomsSection.tsx` | VERIFIED | 4 cards; `mejor-valor` → `border-terracotta bg-terracotta-tint`; prices in `font-mono` as `$Xk` |
| `apps/web/src/features/public-portal/components/ReviewsSection.tsx` | VERIFIED | Aggregated header with `font-display text-3xl`; 5 cards with avatar initials + `fill-mustard` stars |
| `apps/web/src/features/public-portal/components/ConciergeTeaser.tsx` | VERIFIED | `Button asChild variant="terracotta"` wrapping `Link to="/concierge"` with text "Abrir Concierge IA" |
| `apps/web/src/features/public-portal/components/RestaurantSection.tsx` | VERIFIED | 2-col grid; `<i className="italic">Sumapaz</i>`; Desayuno/Almuerzo/Cena hours |
| `apps/web/src/features/public-portal/components/LocationSection.tsx` | VERIFIED | `address` prop rendered; LANDMARKS array with 4 entries; `font-mono` for distances |
| `apps/web/src/features/public-portal/components/ReservationDatePicker.tsx` | VERIFIED | `DayPicker mode="range" locale={es}`; CSS import colocated; `classNames` uses token utilities |
| `apps/web/src/features/public-portal/components/ReservationWidget.tsx` | VERIFIED | Both variant strings present; `pb-[env(safe-area-inset-bottom)]`; "Reservar" CTA; `Button variant="terracotta" onClick={commit}` |
| `apps/web/src/features/public-portal/utils/scrollToSection.ts` | VERIFIED | `ANCHOR_IDS` tuple (5 items); `scrollToSection` with `inicio` branch |
| `apps/web/src/features/public-portal/components/index.ts` | VERIFIED | Exports all 10 components: TopNav, HeroGallery, HotelIdentity, PortalFooter, RoomsSection, ConciergeTeaser, RestaurantSection, LocationSection, ReviewsSection, ReservationWidget |
| `apps/web/src/router.tsx` | VERIFIED | `path: '/'` → `<HotelHomePage />`; `path: '/booking'` → `<HotelHomePage />`; `import { HotelHomePage } from '@/features/public-portal'`; no `BookingPage` import |
| `apps/web/src/features/public-booking/LegacyBookingPage.tsx` | VERIFIED | File exists; `BookingPage.tsx` does NOT exist (confirmed via Glob) |
| `apps/web/src/layouts/PublicConciergeLayout.tsx` | VERIFIED | `useForceLightTheme()` first in body; root `bg-warm-paper`; `hos` class; `bg-terracotta` logo mark |
| `apps/web/src/features/concierge/ConciergePage.tsx` | VERIFIED | Send button `bg-terracotta hover:bg-terracotta-deep`; textarea `focus:ring-terracotta`; suggestion chips `hover:border-terracotta-soft`; status banners (amber/red) preserved |
| `apps/web/src/features/concierge/ChatMessage.tsx` | VERIFIED | User bubble `bg-terracotta text-warm-white`; assistant `bg-warm-white text-ink-1 border border-warm-line`; streaming dots `bg-ink-4`; error box `border-red-200 bg-red-50` preserved |
| `apps/web/src/features/concierge/VenueCard.tsx` | VERIFIED | `h3 className="font-display text-base text-ink-1"`; type badge `bg-terracotta-tint text-terracotta-deep`; "Cómo llegar" btn `bg-terracotta`; stars `fill-mustard text-mustard` |
| `apps/web/src/features/public-portal/HotelHomePage.test.tsx` | VERIFIED | 4 tests: 6 section ids, 5 nav labels, Reservar CTA mount, data-theme removal |
| `apps/web/src/features/public-portal/hooks/useReservationDraft.test.tsx` | VERIFIED | 4 tests: URL params read, defaults, clamping, canCommit gating |
| `apps/web/src/features/public-portal/hooks/useForceLightTheme.test.tsx` | VERIFIED | 3 tests: remove on mount, restore on unmount, no-restore when none existed |
| `.planning/phases/10-public-portal/MANUAL-QA-CHECKLIST.md` | VERIFIED | Exists; 8 sections covering 4 viewports/scenarios |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `router.tsx` | `HotelHomePage` | `path: '/'` and `path: '/booking'` | WIRED | Lines 61-63 and 80-81 confirmed in code |
| `HotelHomePage` | `useForceLightTheme` | First hook call in body | WIRED | Line 20: `useForceLightTheme()` before `useHotelInfo()` |
| `TopNav` anchor click | `scrollToSection(id)` | `onNavClick` prop | WIRED | `onNavClick={scrollToSection}` in `HotelHomePage.tsx` line 28 |
| `TopNav` Concierge click | `/concierge` route | `onConciergeClick` → `navigate('/concierge')` | WIRED | Line 29: `onConciergeClick={() => navigate('/concierge')}` |
| `useReservationDraft.commit()` | `/booking/rooms?...` | `navigate(\`/booking/rooms?...\`)` | WIRED | `useReservationDraft.ts` lines 44-49; URL param keys match `BookingResultsPage` exactly |
| `useHotelInfo()` | `import.meta.env.VITE_HOTEL_NAME` | `??` fallback | WIRED | `useHotelInfo.ts` line 7 |
| `ReservationWidget` Reservar | `commit()` | `onClick={commit}` | WIRED | `ReservationWidget.tsx` lines 76 and 157-164 |
| `PublicConciergeLayout` | `useForceLightTheme` | First hook call | WIRED | `PublicConciergeLayout.tsx` line 25 |
| `react-day-picker` v10 | `ReservationDatePicker` | Named import + CSS import + es locale | WIRED | `ReservationDatePicker.tsx` lines 10-13 |

---

### Requirements Coverage

| Requirement | Plan | Description | Status | Evidence |
|-------------|------|-------------|--------|----------|
| PUB-07 | 10-01, 10-02, 10-03 | HotelHomePage at `/`; hero + identity + sections | SATISFIED | Router confirmed; 6 sections in HotelHomePage; hotel name from env vars |
| PUB-08 | 10-02 | Photo gallery 4-cell desktop / 3-cell mobile CSS Grid with overlay | SATISFIED | HeroGallery.tsx — `hidden lg:grid` + `grid lg:hidden`; "Ver las N fotos" overlay |
| PUB-09 | 10-02 | 5-item nav with anchor scroll; no separate routes for restaurante/ubicacion | SATISFIED | TopNav NAV_ITEMS = 5; `scrollToSection`; router has no new public anchor routes |
| PUB-10 | 10-04 | Reservation widget: react-day-picker v10, guest counter, price, Reservar → `/booking/rooms` | SATISFIED | ReservationWidget + ReservationDatePicker confirmed functional |
| PUB-11 | 10-03 | Reseñas: aggregated rating + count + 4-5 review cards hardcoded | SATISFIED | REVIEWS.length=5; ReviewsSection renders `4.84 · 318 reseñas` + card grid |
| PUB-12 | 10-01 to 10-06 | Responsive at 360/768/1280px — same React tree, CSS-driven | SATISFIED (code) | Single tree with `lg:`/`md:` prefixes confirmed; visual test deferred to human |
| PUB-13 | 10-05 | `/concierge` restyled: warm palette + terracotta send button + Instrument Serif VenueCard + bg-warm-paper | SATISFIED | 4 concierge files confirmed restyled with zero hex, zero blue/gray utilities |

**Note on PUB-11 status in REQUIREMENTS.md:** The file shows `[ ]` (unchecked) for PUB-11, but the implementation is complete and verified. This is a REQUIREMENTS.md tracking discrepancy — the code satisfies the requirement.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ReviewsSection.tsx` | 12 | Duplicate `id="resenas"` — component adds its own `id` while `HotelHomePage.tsx` line 63 also wraps it in `<section id="resenas">` | WARNING | DOM has two elements with `id="resenas"`; scroll works (takes first hit) but is invalid HTML; screenreaders may behave unexpectedly |
| `RoomsSection.tsx` | 10 | Same issue: `id="habitaciones"` both in component (line 10) and in `HotelHomePage.tsx` section wrapper (line 43) | WARNING | Same as above — duplicate id in DOM |
| `ROADMAP.md` | ~246 | `[ ] 10-06-PLAN.md` shown as incomplete, but all 3 test files + QA checklist exist and all 11 tests pass per 10-06-SUMMARY.md | INFO | State tracking inconsistency only — no code impact |

**Severity note:** The duplicate IDs are a WARNING, not a BLOCKER. `scrollIntoView` targets the first match so anchor navigation works. Fix in Phase 11 cleanup or a quick patch: remove the `id` attribute from within `RoomsSection` and `ReviewsSection` since `HotelHomePage` already provides the wrapper `<section id="...">`.

---

### Scope Verification (No Leak)

| Check | Expected | Result |
|-------|----------|--------|
| Hex colors in `public-portal/` | 0 matches | CONFIRMED — 0 matches |
| Hex colors in `concierge/` and `PublicConciergeLayout.tsx` | 0 matches | CONFIRMED — 0 matches |
| `useSystemConfig` in `public-portal/` | 0 matches | CONFIRMED — hook does not exist; useHotelInfo uses env vars |
| `hos-(card\|pill\|btn\|avatar\|logo-mark)` in `public-portal/` | 0 matches | CONFIRMED — all inline Tailwind compositions |
| `BookingPage.tsx` exists | Should NOT exist (renamed) | CONFIRMED absent — `LegacyBookingPage.tsx` exists instead |
| Logic files in concierge untouched | `concierge.api.ts`, `concierge.store.ts`, `useConciergeChat.ts`, `streamMessages.ts`, `types.ts` | CONFIRMED — only 4 UI files modified per 10-05 scope |

---

### Bundle Fidelity Spot-Checks

| Check | Expected | Result |
|-------|----------|--------|
| Hotel name italic pattern | `Hotel <i>Sumapaz</i>` | VERIFIED — `HotelIdentity.tsx` splits on first space, renders rest in `<i className="italic">` |
| Hero gallery first photo spans 2 rows | `row-span-2` on first `<img>` | VERIFIED — `HeroGallery.tsx` line 21: `className="row-span-2 w-full h-full object-cover"` |
| "Ver las N fotos" overlay | `absolute bottom-3 right-3 bg-warm-white` | VERIFIED — `HeroGallery.tsx` line 58 |
| "Mejor valor" card — terracotta highlight | `border-[1.5px] border-terracotta bg-terracotta-tint` | VERIFIED — `RoomsSection.tsx` lines 14-16 |
| VenueCard heading — Instrument Serif | `font-display` | VERIFIED — `VenueCard.tsx` line 99 |
| iOS safe-area inset | `pb-[env(safe-area-inset-bottom)]` | VERIFIED — `ReservationWidget.tsx` line 57 |

---

### Automated Test Results (per 10-06-SUMMARY.md)

```
Test Files  3 passed (3)
Tests      11 passed (11)
```

Commit `1008e89` — `HotelHomePage.test.tsx` (4 tests)
Commit `0f688dc` — `useReservationDraft.test.tsx` (4 tests) + `useForceLightTheme.test.tsx` (3 tests)

---

### Human Verification Required

#### 1. Visual Viewport Check (360px / 768px / 1280px)

**Test:** Open `http://localhost:5173/` in browser dev tools with responsive mode; test at 360px, 768px, 1280px
**Expected:** No horizontal overflow at any width; hero gallery collapses on mobile; reservation widget shows as fixed bottom bar at 360px; top nav collapses to logo + 2 icon buttons at 360px
**Why human:** CSS media queries and layout rendering cannot be verified programmatically

#### 2. Anchor Scroll Behavior

**Test:** Click each item in the top nav (Inicio, Habitaciones, Restaurante, Ubicación); note whether sections scroll into view and whether sticky nav covers headings
**Expected:** Smooth scroll to each section; heading visible below sticky nav (scroll-mt-20 = 80px clearance)
**Why human:** `scrollIntoView` requires live browser rendering

#### 3. Concierge Palette Verification

**Test:** Navigate to `/concierge`; verify background color is off-white (warm-paper), not gray; logo mark is terracotta, not blue; send a test message
**Expected:** Visual palette matches bundle warm tones; user bubbles are terracotta; assistant bubbles are off-white with border; VenueCard titles use Instrument Serif; streaming still works
**Why human:** CSS custom property rendering + font rendering requires browser

#### 4. Dark-Mode Leak Prevention

**Test:** Log in as staff, enable dark mode on `/dashboard`, then navigate to `/` and `/concierge`
**Expected:** Both public routes render in light mode despite staff dark-mode preference; navigating back to `/dashboard` restores dark mode
**Why human:** Runtime state transition across routes requires browser session

#### 5. Reservar Button Navigation

**Test:** Open date picker, select a check-in and check-out date, click "Reservar"
**Expected:** Browser navigates to `/booking/rooms?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&adults=2`; `BookingResultsPage` renders with room availability
**Why human:** Real URL navigation and cross-page state handoff requires browser

---

### Gaps Summary

No blocking gaps found. Phase 10 goal is achieved — the full Airbnb-style landing is implemented, wired, and tested.

**Two minor warnings identified** (non-blocking, fix recommended before Phase 11):

1. **Duplicate section IDs** — `RoomsSection` has its own `id="habitaciones"` AND `HotelHomePage` wraps it in `<section id="habitaciones">`. Same pattern for `ReviewsSection`/`id="resenas"`. Fix: remove the `id` attribute from inside the section components (they are already wrapped by the parent `<section id="...">` in `HotelHomePage`).

2. **ROADMAP.md plan 10-06 checkbox** — shows `[ ]` but all deliverables exist in code (3 test files, QA checklist, 11 tests passing). Fix: update ROADMAP.md to mark 10-06 complete.

---

_Verified: 2026-05-17T17:35:00Z_
_Verifier: Claude (gsd-verifier)_
