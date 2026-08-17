# Phase 10 — Manual QA Checklist

Run these checks AFTER all 6 plans land and before declaring Phase 10 complete.
Playwright/visual-regression deferred to post-v1.1 — these manual steps are the v1.1 acceptance gate.

## Prereqs

1. `cd apps/web && pnpm dev` (Vite dev server on http://localhost:5173)
2. Browser dev tools open with Responsive Design Mode enabled

## 1. Route registration

- [ ] `http://localhost:5173/` renders HotelHomePage (NOT a redirect to /login or /dashboard)
- [ ] `http://localhost:5173/booking` renders HotelHomePage (alias)
- [ ] `http://localhost:5173/booking/rooms?checkIn=2026-06-14&checkOut=2026-06-18&adults=2` still renders BookingResultsPage (unchanged from v1.0)
- [ ] `http://localhost:5173/concierge` renders the restyled chat UI

## 2. Desktop viewport (1280px)

- [ ] Top nav shows 5 items: Inicio · Habitaciones · Restaurante · Concierge · Ubicación
- [ ] Logo mark + hotel name visible top-left
- [ ] Hero gallery shows 4 photos in CSS Grid (1 large left, 3 right) with "Ver las 5 fotos" overlay
- [ ] Hotel name H1 uses Instrument Serif with italic second word (e.g., "Hotel _Sumapaz_")
- [ ] Rating displays "4.84" with mustard star icon
- [ ] Tag chips render (Hotel boutique · 42 habitaciones · 4 pisos · Desayuno incluido)
- [ ] Habitaciones shows 4 cards; Suite ("Mejor valor") has terracotta-tint background + terracotta border
- [ ] Concierge teaser card visible with "Abrir Concierge IA" CTA
- [ ] Restaurante section: 2-column with image left + hours right
- [ ] Ubicación: static map placeholder + 4 landmarks list
- [ ] Reseñas: aggregated "4.84 · 318 reseñas" + 5 review cards
- [ ] Reservation widget sticky on right (visible while scrolling sections)
- [ ] Footer: hotel name + address + phone + © line

## 3. Mobile viewport (360px)

- [ ] No horizontal overflow at ANY point on the page
- [ ] Top nav collapses to logo + 2 icon buttons only (anchor links hidden)
- [ ] Hero gallery shows 3 photos in 2-col 2-row grid with overlay button
- [ ] All sections stack single-column
- [ ] Reservation widget appears as fixed bottom bar (NOT sidebar)
- [ ] Bottom bar respects iOS home indicator (visible safe-area padding)
- [ ] Tapping the date area expands the picker inline

## 4. Tablet viewport (768px)

- [ ] No horizontal overflow
- [ ] Layout transitions correctly between mobile and desktop
- [ ] Habitaciones grid shows 2 columns

## 5. Interactions

- [ ] Click "Habitaciones" nav → smooth scroll to #habitaciones section
- [ ] Section heading visible (NOT hidden behind sticky nav)
- [ ] Click "Concierge" nav → navigates to /concierge (different route)
- [ ] Click "Inicio" nav → smooth scroll to top
- [ ] Open reservation date picker, select range → URL updates with checkIn / checkOut
- [ ] Click +/- on guest counter → URL `adults` updates
- [ ] Click Reservar (with valid dates) → navigates to /booking/rooms?checkIn=...&checkOut=...&adults=N
- [ ] BookingResultsPage renders with correct dates (proves URL-param handoff works)
- [ ] Click "Ver las N fotos" overlay → no-op (intentional in v1.1)
- [ ] Click "Abrir Concierge IA" in teaser → navigates to /concierge

## 6. Concierge restyle (/concierge)

- [ ] Page background is warm-paper, not gray
- [ ] Logo mark is terracotta (not blue)
- [ ] Hotel name uses Instrument Serif
- [ ] Click a suggestion chip → message sends, streams a response
- [ ] User bubble = terracotta + warm-white text
- [ ] Assistant bubble = warm-white + ink-1 text + warm-line border
- [ ] VenueCard title uses Instrument Serif
- [ ] VenueCard "Cómo llegar" button is terracotta
- [ ] Rating stars in VenueCard are mustard (not amber)

## 7. Dark-mode leak prevention

- [ ] As a staff user: visit `/login`, log in, toggle dark mode on `/dashboard`
- [ ] Then navigate to `/` (Home) → HotelHomePage renders in LIGHT mode despite the staff preference
- [ ] Navigate to `/concierge` → also light mode
- [ ] Navigate back to `/dashboard` → dark mode restored

## 8. Lighthouse / no console errors

- [ ] Reload `/` → DevTools Console shows zero red errors
- [ ] Reload `/concierge` → zero red errors
- [ ] No 404s for hotel-photos (Unsplash CDN responds)

---

**Verification commands** (run during execute-phase):

```
cd apps/web
pnpm tsc --noEmit -p tsconfig.json
pnpm vitest run src/features/public-portal/ src/features/concierge/
rg "#[0-9a-fA-F]{3,6}" src/features/public-portal/ src/features/concierge/ src/layouts/PublicConciergeLayout.tsx --glob "*.tsx"
rg "useSystemConfig" src/features/public-portal/
rg "hos-(card|pill|btn|avatar|logo-mark)" src/features/public-portal/ src/features/concierge/ --glob "*.tsx"
```

All three rg invocations should return ZERO matches.
