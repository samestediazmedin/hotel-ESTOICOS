---
phase: 16-guest-detail-deep-links-contact-events
plan: 4
subsystem: frontend
tags: [react, tanstack-query, sonner, deep-links, contact-events, tdd, guests, form]
dependency_graph:
  requires: [16-03]
  provides: [GuestDetailPage, ContactButtons]
  affects: [apps/web/src/features/guests, apps/web/src/router.tsx]
tech_stack:
  added: []
  patterns:
    - mutation-first deep links (POST before window.open/location.href)
    - E.164 stripping for wa.me URLs (replace /^\+/)
    - ExtendedGuestDto local type to avoid extending union types
    - window.location.href mock via Object.defineProperty for jsdom tests
key_files:
  created:
    - apps/web/src/features/guests/components/ContactButtons.tsx
    - apps/web/src/features/guests/components/ContactButtons.spec.tsx
    - apps/web/src/features/guests/GuestDetailPage.tsx
    - apps/web/src/features/guests/GuestDetailPage.spec.tsx
  modified:
    - apps/web/src/router.tsx
decisions:
  - "ExtendedGuestDto defined as standalone interface (not extending AnyGuestDto union) — TypeScript TS2312 prevents interface extension of union types"
  - "window.location.href mocked via Object.defineProperty + tracking array — vi.spyOn not viable on jsdom Location (non-configurable property)"
  - "ContactButtons uses mutation-first pattern: POST succeeds before deep link opens — if API fails, deep link is never opened"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-19"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
  tests_added: 19
---

# Phase 16 Plan 4: GuestDetailPage + ContactButtons + router Summary

**One-liner:** Staff-facing `/guests/:id` detail page with 4 sections (header/info/reservations/contacts) and reusable `ContactButtons` component that POSTs audit events before opening native deep links.

## What Was Built

### Task 1: ContactButtons component (TDD red → green, 10 specs)

**`apps/web/src/features/guests/components/ContactButtons.tsx`**

Reusable 3-button strip used in the guest detail header and per-reservation rows.

| Button | Icon | Deep link | Window method |
|--------|------|-----------|---------------|
| Llamar | `Phone` | `tel:{phone}` | `window.location.href` |
| WhatsApp | `MessageCircle` | `wa.me/{stripped}?text={encoded}` | `window.open(url, '_blank')` |
| Email | `Mail` | `mailto:{email}?subject=...&body=...` | `window.location.href` |

Click flow (all 3 methods):
1. `mutation.mutate(method)` → POST `/api/guests/:id/contact-events`
2. On `onSuccess`: build deep link → open via correct window method → `toast.success(TOAST_TEXT[method])` → `queryClient.invalidateQueries(['guest', id, 'contact-events'])`
3. On `onError`: `toast.error('No se pudo registrar el contacto...')` — deep link NOT opened

Security surface:
- All dynamic content in WhatsApp/mailto URLs passes through `encodeURIComponent`
- WhatsApp number stripped of leading `+` via `.replace(/^\+/, '')` (E.164 → wa.me format)
- Disabled if corresponding contact field is null

**`apps/web/src/features/guests/components/ContactButtons.spec.tsx`** — 10 cases:

| # | Behavior | Result |
|---|----------|--------|
| 1 | 3 buttons render | PASS |
| 2 | phone=null → Llamar disabled | PASS |
| 3 | whatsappNumber=null → WhatsApp disabled | PASS |
| 4 | email=null → Email disabled | PASS |
| 5 | Llamar → mutation CALL, location.href=tel:, toast, invalidate | PASS |
| 6 | WhatsApp → mutation WHATSAPP, window.open(wa.me), toast | PASS |
| 7 | Email → mutation EMAIL, location.href=mailto:, toast | PASS |
| 8 | Mutation failure → toast.error, no deep link, no invalidate | PASS |
| 9 | size='sm' renders buttons | PASS |
| 10 | wa.me URL encoded (% chars present, no raw spaces) | PASS |

**Notable jsdom gotcha:** `vi.spyOn(window.location, 'href', 'set')` throws `TypeError: Cannot redefine property: href` in jsdom 26.x — the property is non-configurable. Fix: replace `window.location` entirely via `Object.defineProperty` with a custom getter/setter that pushes to a tracking array.

### Task 2: GuestDetailPage with 4 sections + router wiring (TDD red → green, 9 specs)

**`apps/web/src/features/guests/GuestDetailPage.tsx`**

4-section page at `/guests/:id`:

1. **Header**: `fullName` + `documentType documentNumber · nationality · age años` + `ContactButtons` row + `Editar` button
2. **Información de contacto** (read mode): grid of `InfoRow` pairs for email, phone, whatsApp, contactPreference, preferredLanguage, marketingConsent, dietaryRestrictions, specialRequests
3. **Reservaciones**: list from `useGuestHistory(id)` — each row shows date range + status + nights + `ContactButtons size="sm"`
4. **Últimos contactos**: `useGuestContactEvents(id)` — last 5 events with `staffUser.name · METHOD_LABEL · formatDistanceToNow(createdAt, {locale: es, addSuffix: true})`

Edit mode: click `Editar` → `GuestEditForm` replaces info section (react-hook-form + zod). Save calls `useUpdateGuest(id).mutateAsync(payload)` → invalidates via existing hook → `setEditing(false)`. Cancel resets form without saving.

States: loading (`Cargando...`), error (`Huésped no encontrado` + back link to `/guests`), empty contacts (`Aún no hay contactos registrados.`).

**`apps/web/src/router.tsx`** — added inside `ProtectedRoute > StaffLayout`:
```tsx
{
  path: 'guests/:id',
  element: <GuestDetailPage />,
},
```

**`apps/web/src/features/guests/GuestDetailPage.spec.tsx`** — 9 cases:

| # | Behavior | Result |
|---|----------|--------|
| 1 | useGuest called with id from useParams | PASS |
| 2 | Header: fullName + document + ContactButtons rendered | PASS |
| 3 | Info section: email + phone visible (read mode) | PASS |
| 4 | Editar → form visible; Cancel → form closes | PASS |
| 5 | Reservaciones section visible with reservation data | PASS |
| 6 | Últimos contactos: staff name + method + relative time | PASS |
| 7 | Empty state: "Aún no hay contactos registrados." | PASS |
| 8 | Loading state: "Cargando..." text | PASS |
| 9 | Error state: "Huésped no encontrado" + back link | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ExtendedGuestDto cannot extend union type AnyGuestDto**
- **Found during:** TypeScript check after Task 2 implementation
- **Issue:** `AnyGuestDto = GuestResponseDto | GuestPublicDto` is a union; TypeScript TS2312 prohibits extending unions via `interface ... extends`
- **Fix:** Redefined `ExtendedGuestDto` as a standalone interface with all fields explicitly typed (mirror of `GuestResponseDto` + Phase 15 additions)
- **Files modified:** `GuestDetailPage.tsx`
- **Commit:** `775750f`

**2. [Rule 1 - Bug] vi.spyOn(window.location, 'href', 'set') throws in jsdom 26.x**
- **Found during:** Task 1 TDD fix attempts
- **Issue:** `window.location.href` is non-configurable in jsdom — `vi.spyOn` setter mode throws `TypeError: Cannot redefine property: href`
- **Fix:** Replaced `window.location` object entirely via `Object.defineProperty` with `configurable: true`, then added a custom getter/setter that pushes assigned values to a tracking array (`hrefAssignedValues`)
- **Files modified:** `ContactButtons.spec.tsx`
- **Commit:** `632bed9`

**3. [Rule 1 - Bug] Test assertions used getByTestId/getByText for elements that appear multiple times**
- **Found during:** GuestDetailPage.spec.tsx first run
- **Issue:** ContactButtons appears in header + 2 reservation rows (3 total); `+573005551234` appears as both phone and whatsApp; `res-001` appears in 2 spans
- **Fix:** Changed assertions to `getAllByTestId` / `getAllByText` with `length >= 1` checks; or used more specific text matchers
- **Files modified:** `GuestDetailPage.spec.tsx`
- **Commit:** `775750f`

## Token Discipline Check

- Zero hex colors: `rg "#[0-9a-fA-F]{3,6}"` → 0 matches in both new files
- Zero raw palette classes (text-red-500, etc.): 0 matches
- All styling via design tokens: `bg-bg-base`, `bg-surface`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border-subtle`, `text-brand-primary`, `text-status-in-progress`

## Final Test Results

```
Test Files: 4 passed (4)
     Tests: 37 passed (37)
```

Suite coverage:
- `ContactButtons.spec.tsx`: 10/10
- `GuestDetailPage.spec.tsx`: 9/9
- `useGuestContactEvents.spec.ts`: 8/8 (from 16-03, no regressions)
- `GuestsPage.spec.tsx`: 10/10 (from 16-05, no regressions)

TypeScript: `tsc --noEmit` exit 0 (no new errors in plan-04 files).

## Self-Check: PASSED

Files verified:
- `apps/web/src/features/guests/components/ContactButtons.tsx` — FOUND
- `apps/web/src/features/guests/components/ContactButtons.spec.tsx` — FOUND
- `apps/web/src/features/guests/GuestDetailPage.tsx` — FOUND
- `apps/web/src/features/guests/GuestDetailPage.spec.tsx` — FOUND

Commits verified:
- `632bed9`: feat(16-04): ContactButtons component — POST event + deep links + toast + invalidate
- `775750f`: feat(16-04): GuestDetailPage + router wiring for /guests/:id (GCC-09)

Route in router.tsx:
- `rg "guests/:id" apps/web/src/router.tsx` → match at line 142, inside ProtectedRoute > StaffLayout
