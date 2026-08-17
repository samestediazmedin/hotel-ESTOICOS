# Phase 16 — Manual QA Checklist
# Guest Detail + Deep Links + Contact Events

**Milestone:** v1.3 — Guest Communication Hub
**Phase:** 16 (GCC-06..12)
**Date:** 2026-05-19
**Reviewer:** _____________

---

## Prerequisites

Before executing any scenario:

1. API running: `cd apps/api && npx ts-node -r tsconfig-paths/register src/main.ts`
2. Frontend running: `cd apps/web && npx vite`
3. Staff user logged in (RECEPTION role) with valid JWT
4. At least one Guest record exists with `phone`, `email`, and `whatsappNumber` populated
5. At least one Guest record exists with `phone=null`, `email=null`, `whatsappNumber=null`

---

## Scenarios

| # | Scenario | Steps | Expected | Pass/Fail | Notes |
|---|----------|-------|----------|-----------|-------|
| 1 | **POST contact event (HTTP)** | Login as RECEPTION. Run: `curl -X POST http://localhost:3000/api/guests/{validId}/contact-events -H "Authorization: Bearer {jwt}" -H "Content-Type: application/json" -d '{"method":"CALL"}'` | 201 response + JSON with `id`, `method: "CALL"`, `guestId`, `staffUserId`, `staffUserName` (joined), `createdAt` | | |
| 2 | **GET contact events list** | Run: `curl -H "Authorization: Bearer {jwt}" "http://localhost:3000/api/guests/{validId}/contact-events?limit=5"` | 200 + JSON array ordered descending by `createdAt`, each item has `staffUser.name` joined, max 5 items | | |
| 3 | **GuestDetailPage 4 sections render** | Visit `/guests/{validId}` as staff | Page renders: (a) Header with `fullName + documentType + documentNumber + nationality + age` + ContactButtons row + "Editar" button; (b) Información de contacto section; (c) Reservaciones section; (d) Últimos contactos section | | |
| 4 | **ContactButtons disabled state** | Visit `/guests/{guestWithNulls}` where phone=null, email=null, whatsappNumber=null | All 3 ContactButtons (Llamar / WhatsApp / Email) render visually grayed/disabled; clicking does nothing | | |
| 5 | **WhatsApp click → deep link + toast + event** | Visit `/guests/{guestWithPhone}` (whatsappNumber populated); click "WhatsApp" | (a) `wa.me/{number}?text=...` opens in new tab; (b) Toast "✓ WhatsApp registrado" appears top-right; (c) "Últimos contactos" section refreshes and shows the new event | | |
| 6 | **Email click → deep link + toast** | Visit `/guests/{guestWithEmail}` (email populated); click "Email" | (a) `mailto:{email}?subject=...` opens in mail client; (b) Toast "✓ Email registrado" appears | | |
| 7 | **2-tab realtime push** | Open 2 browser tabs: Tab A at `/guests/{X}`, Tab B at `/guests/{X}` (same guest), both logged in as different staff users. Tab B: click "WhatsApp" | (a) Tab B sees "✓ WhatsApp registrado" toast; (b) Tab A receives toast: "{staffB.name} inició contacto por WhatsApp con este huésped" within ~1s; (c) Tab A "Últimos contactos" section refreshes showing the new event | | |
| 8 | **GuestsPage "Último contacto" column + navigation** | Visit `/guests` (guest list). Observe guest rows. Click any row. | (a) Table has 6th column header "Último contacto"; (b) Guests with no events show "Nunca"; (c) Guests with events show Spanish relative time (e.g., "hace menos de un minuto", "hace 2 horas"); (d) Clicking a row navigates to `/guests/:id` (NOT opens a drawer) | | |

---

## Sign-off

| Field | Value |
|-------|-------|
| Tester name | |
| Date | |
| Overall result | [ ] PASS — all 8 scenarios green |
|               | [ ] FAIL — see notes above |
| Blocking issues | |

---

## Carry-Forward (Known Limitations in v1.3)

- Scenario 7 (2-tab realtime) requires both browser sessions to be authenticated on the same running instance; Socket.io rooms work per-connection. This is the expected behavior — no bug.
- `wa.me` URL opens in a new tab on desktop. On mobile, it opens WhatsApp directly. Both are expected.
- `prisma migrate status` returns P1001 in local dev without Railway VPN — not a failure; the migration was applied during plan 16-01 execution.
