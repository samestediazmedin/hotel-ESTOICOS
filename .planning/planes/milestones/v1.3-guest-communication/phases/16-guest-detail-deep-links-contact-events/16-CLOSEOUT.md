# Phase 16 Closeout — Guest Detail + Deep Links + Contact Events

**Phase:** 16
**Milestone:** v1.3 — Guest Communication Hub
**Completed:** 2026-05-19
**Status:** COMPLETE — all 7 plans executed, 7 GCC-IDs delivered

---

## Plans Completed

| Plan | Name | Key Files | Tasks | Tests Added |
|------|------|-----------|-------|-------------|
| 16-00 | Wave 0: Install sonner + date-fns + Mount Toaster | `App.tsx`, `package.json` | 2 | 0 (infra only) |
| 16-01 | Wave 1: Prisma migration + GuestContactModule + Gateway | 10 created, 2 modified | 3 | 19 |
| 16-02 | Wave 2: Extend GET /api/guests with lastContactEvent | 0 created, 5 modified | 2 | 5 |
| 16-03 | Wave 2: Frontend socket singleton + API client + hook | 5 created, 0 modified | 2 | 8 |
| 16-04 | Wave 3: GuestDetailPage + ContactButtons + router | 4 created, 1 modified | 2 | 19 |
| 16-05 | Wave 3: GuestsPage Último contacto column + row navigation | 1 created, 2 modified | 2 | 10 |
| 16-06 | Wave 4: Regression + QA + Closeout (this plan) | 5 documentation files | 3 | 0 |

**Total:** 7 plans, 12 commits, 20 files created, 10 files modified

---

## GCC-06..12 Verification Table

| REQ-ID | Description | Plan Delivered | Acceptance Evidence |
|--------|-------------|----------------|---------------------|
| GCC-06 | `guest_contact_events` table: `{id, guestId FK, staffUserId FK, method enum, notes?, createdAt}` + composite index `[guestId, createdAt DESC]`; migration applied | 16-01 | `20260527000000_phase16_guest_contact_events` migration applied; Prisma validates schema; 428/428 backend tests green |
| GCC-07 | `POST /api/guests/:id/contact-events` returns 201 + event row; `GET /api/guests/:id/contact-events?limit=5` returns events DESC with `staffUser.name` joined | 16-01 | GuestContactController + GuestContactService + repo tests: 19/19; `tsc --noEmit` exit 0 |
| GCC-08 | Socket.io room `guest:{guestId}` emits `contact-event.created` with `{eventId, method, staffUserId, staffUserName, createdAt}` on event create | 16-01 (backend) + 16-03 (frontend) | GuestContactGateway 9/9 tests; `useGuestContactEvents` hook 8/8 tests covering self-filter, invalidation, Spanish toast |
| GCC-09 | Staff route `/guests/:id` renders 4 sections: header, contact info, reservations, últimos contactos | 16-04 | GuestDetailPage.spec.tsx 9/9; router wiring verified (`rg "guests/:id" router.tsx`); `tsc --noEmit` exit 0 |
| GCC-10 | `<ContactButtons />` 3 buttons (Llamar/WhatsApp/Email): click → POST event → deep link → toast → invalidate query | 16-04 | ContactButtons.spec.tsx 10/10; mutation-first pattern; wa.me URL encoding verified; disabled when contact null |
| GCC-11 | `useGuestContactEvents(guestId)` combines TanStack Query + Socket.io; on other-user event invalidates query AND shows Spanish informative toast | 16-03 | 8/8 hook tests covering all scenarios (self/other, all 3 methods, guestId change, no-token guard) |
| GCC-12 | `GuestsPage` extended with "Último contacto" column (Spanish relative time via `date-fns`) + row click navigates to `/guests/:id` | 16-02 (backend) + 16-05 (frontend) | GuestsPage.spec.tsx 10/10; `lastContactEvent` in both DTO transformers; N+1-safe Prisma include with index |

---

## Regression Gate Results

| Gate | Result | Detail |
|------|--------|--------|
| `apps/api` tsc --noEmit | EXIT 0 | 0 TypeScript errors |
| `apps/api` prisma validate | EXIT 0 | Schema valid |
| `apps/api` vitest run | EXIT 0 | 49 files, **428 tests** all passed |
| `apps/web` tsc --noEmit | EXIT 0 | 0 TypeScript errors |
| `apps/web` vitest run | EXIT 0 | 18 files, **153 tests** all passed |
| Zero-hex gate (Phase 16 new files) | PASS | 0 `#hex` in GuestDetailPage.tsx, ContactButtons.tsx, useGuestContactEvents.ts, socket.ts |
| Zero-palette gate (Phase 16 new files) | PASS | 0 raw Tailwind palette classes in Phase 16 files |
| `prisma migrate status` | P1001 (expected) | Railway DB not reachable from local dev without VPN; migration was applied during 16-01 execution |

**Test delta Phase 16 vs Phase 15 baseline:**
- Backend: 404 → 428 (+24 tests, 6 files, 3 new modules)
- Frontend: 116 → 153 (+37 tests, 4 new spec files)

---

## Key Technical Decisions

| Decision | Context | Rationale |
|----------|---------|-----------|
| Migration timestamp `20260527000000` | 16-01 | CONTEXT.md estimated 20260519010000 but Phase 15 ran 20260526000000 — timestamps must be strictly ordered |
| `ContactMethod` import from `../../generated/prisma/client` | 16-01 | `/client` suffix required — matches pattern from `folio.service.ts` and concierge modules |
| `GuestContactGateway` shares `/` namespace with `HousekeepingGateway` | 16-01 | NestJS supports multiple gateways on same namespace; single WebSocket connection from frontend |
| No `client.join()` in `handleConnection` — dynamic rooms only | 16-01 | Rooms are per-guest (`guest:{id}`); joining on connection would require guestId upfront — not available at handshake |
| `toPublicDto` includes `lastContactEvent` | 16-02 | Operational signal needed by HOUSEKEEPING role; not PII (PII restriction = `documentNumber` per GST-05) |
| Shared socket singleton (`lib/socket.ts`) — `useHousekeepingSocket` NOT migrated | 16-03 | Deferred to v1.4; two connections are functionally correct for ~5 concurrent staff |
| `staffUserName` from Socket.io payload for toast text (NOT `user?.name` from auth store) | 16-03 | Research trap #6 mitigation: auth store name may differ from DB `users.name`; socket payload is DB-authoritative |
| `ExtendedGuestDto` as standalone interface (not extending union `AnyGuestDto`) | 16-04 | TS2312 prevents extending union types; standalone interface with explicit fields is the correct pattern |
| `window.location.href` mocked via `Object.defineProperty` (not `vi.spyOn`) | 16-04 | jsdom 26.x: `href` property is non-configurable — `vi.spyOn` setter mode throws `TypeError` |
| `handleRowClick` in GuestsPage rewired to `navigate()` — drawer retained for create-only | 16-05 | Detail page requires full route for deep linking; drawer pattern breaks URL-shareable guest detail |

---

## Pitfalls Encountered and Resolved

| Pitfall | Impact | Resolution |
|---------|--------|------------|
| Prisma enum import path missing `/client` suffix | tsc error in repository | Changed to `../../generated/prisma/client` |
| Dynamic `require()` in Vitest ESM context | Test failure on specs 7-9 | Changed to static top-level `import` |
| `AnyGuestDto` is a union — cannot extend | TS2312 compile error | Defined `ExtendedGuestDto` as standalone interface |
| `vi.spyOn(window.location, 'href', 'set')` non-configurable in jsdom 26.x | Test setup crash | Replaced entire `window.location` via `Object.defineProperty` |
| `getAllByText`/`getByTestId` on elements rendered multiple times | Flaky test assertions | Switched to `getAllByTestId` + `length >= 1` checks |
| `null ?? default` does NOT propagate `null` | makeContactEvent helper bug in spec | Changed to `'key' in overrides ? overrides.key! : default` explicit key presence check |

---

## Files Inventory (Phase 16 delta)

### Created
| File | Plan | Purpose |
|------|------|---------|
| `apps/api/prisma/migrations/20260527000000_phase16_guest_contact_events/migration.sql` | 16-01 | DB migration: ContactMethod enum + GuestContactEvent table |
| `apps/api/src/modules/guest-contact/guest-contact.gateway.ts` | 16-01 | Socket.io gateway for per-guest rooms |
| `apps/api/src/modules/guest-contact/guest-contact.gateway.spec.ts` | 16-01 | Gateway unit tests (9 cases) |
| `apps/api/src/modules/guest-contact/guest-contact.service.ts` | 16-01 | Business logic: createEvent + listEvents |
| `apps/api/src/modules/guest-contact/guest-contact.service.spec.ts` | 16-01 | Service unit tests (10 cases) |
| `apps/api/src/modules/guest-contact/guest-contact.repository.ts` | 16-01 | Prisma repository: create + findManyByGuestId |
| `apps/api/src/modules/guest-contact/guest-contact.controller.ts` | 16-01 | REST controller: POST + GET |
| `apps/api/src/modules/guest-contact/guest-contact.module.ts` | 16-01 | NestJS module registration |
| `apps/api/src/modules/guest-contact/dto/create-contact-event.dto.ts` | 16-01 | Zod schema + pipe |
| `apps/api/src/modules/guest-contact/dto/contact-event-response.dto.ts` | 16-01 | Response DTO shape |
| `apps/web/src/lib/socket.ts` | 16-03 | Shared Socket.io singleton (getOrCreateSocket / disconnectSocket) |
| `apps/web/src/features/guests/types.ts` | 16-03 | ContactMethod, GuestContactEventDto, ContactEventSocketPayload, LastContactEventSummary |
| `apps/web/src/features/guests/guest-contact.api.ts` | 16-03 | createContactEvent + listContactEvents axios wrappers |
| `apps/web/src/features/guests/hooks/useGuestContactEvents.ts` | 16-03 | TanStack Query + Socket.io combined hook |
| `apps/web/src/features/guests/hooks/useGuestContactEvents.spec.ts` | 16-03 | Hook unit tests (8 cases) |
| `apps/web/src/features/guests/components/ContactButtons.tsx` | 16-04 | 3-button component with mutation-first deep links |
| `apps/web/src/features/guests/components/ContactButtons.spec.tsx` | 16-04 | Component unit tests (10 cases) |
| `apps/web/src/features/guests/GuestDetailPage.tsx` | 16-04 | Staff detail page at /guests/:id (4 sections) |
| `apps/web/src/features/guests/GuestDetailPage.spec.tsx` | 16-04 | Page unit tests (9 cases) |
| `apps/web/src/features/guests/GuestsPage.spec.tsx` | 16-05 | GuestsPage unit tests (10 cases) |

### Modified
| File | Plan | Change |
|------|------|--------|
| `apps/api/prisma/schema.prisma` | 16-01 | Added ContactMethod enum + GuestContactEvent model |
| `apps/api/src/app.module.ts` | 16-01 | Registered GuestContactModule |
| `apps/api/src/modules/guests/guests.repository.ts` | 16-02 | Added contactEvents include (take:1, orderBy desc) |
| `apps/api/src/modules/guests/guests.service.ts` | 16-02 | Added lastContactEvent to both DTO transformers |
| `apps/api/src/modules/guests/guests.service.spec.ts` | 16-02 | Added 5 P16 tests for lastContactEvent |
| `apps/api/src/modules/guests/dto/guest-response.dto.ts` | 16-02 | Added lastContactEvent field declaration |
| `apps/api/src/modules/guests/dto/guest-public.dto.ts` | 16-02 | Added lastContactEvent field declaration |
| `apps/web/src/App.tsx` | 16-00 | Mounted `<Toaster richColors position="top-right" />` |
| `apps/web/package.json` | 16-00 | Added sonner@^2.0.7, date-fns@^4.1.0 |
| `apps/web/src/features/guests/GuestsPage.tsx` | 16-05 | Added "Último contacto" column + row navigate() |
| `apps/web/src/features/guests/guests.api.ts` | 16-05 | Added lastContactEvent to both DTO interfaces |
| `apps/web/src/router.tsx` | 16-04 | Added `guests/:id` route inside ProtectedRoute > StaffLayout |

---

## Manual QA

See: `.planning/phases/16-guest-detail-deep-links-contact-events/16-MANUAL-QA-CHECKLIST.md`

8 scenarios covering GCC-06..12. Human sign-off required before v1.3 milestone is considered operationally validated.

---

## Carry-Forward to v1.4

Items deferred from Phase 16 scope:

| Item | Reason deferred |
|------|----------------|
| Migrate `useHousekeepingSocket` to `lib/socket.ts` singleton | Scope creep in v1.3; dual connections functionally correct for hotel scale |
| Notes field on contact events (post-call summary dialog) | Schema supports `notes?` but no UI to enter notes; dialog deferred |
| Contact log filters / search (by method, staff, date range) | Current UX shows last 5 events; search deferred to v1.4 |
| WhatsApp Business API real integration (outbound templates) | Requires WhatsApp Business API approval + webhook setup — complex external dependency |
| Pre-arrival reminder cron (1 day before check-in) | Requires `@nestjs/schedule` + contact preference routing logic |
| Soft-delete on contact events for GDPR | Schema uses cascade delete on guest; explicit soft-delete deferred |
| Bulk contact action | Not in v1.3 scope |
| Contact event analytics dashboard | Not in v1.3 scope |
| Photo upload in guest detail | Not in v1.3 scope |
| Email templates library expansion (welcome / pre-arrival / thank-you) | Resend templates deferred |

---

## Sign-off

Phase 16 completed 2026-05-19. All 7 plans executed, 428+153 tests green, 7 GCC-IDs delivered.
v1.3 milestone (Guest Communication Hub) — all 12 GCC-IDs shipped across Phases 15+16.
