---
phase: 16-guest-detail-deep-links-contact-events
plan: 3
subsystem: frontend
tags: [socket.io, tanstack-query, sonner, typescript, hooks, guests, real-time]
dependency_graph:
  requires: [16-01, 16-00]
  provides: [useGuestContactEvents, guest-contact-api-client, socket-singleton]
  affects: [apps/web/src/lib, apps/web/src/features/guests]
tech_stack:
  added: [shared socket singleton via lib/socket.ts]
  patterns: [getOrCreateSocket singleton, TanStack Query + Socket.io co-subscription, TDD red-green]
key_files:
  created:
    - apps/web/src/lib/socket.ts
    - apps/web/src/features/guests/types.ts
    - apps/web/src/features/guests/guest-contact.api.ts
    - apps/web/src/features/guests/hooks/useGuestContactEvents.ts
    - apps/web/src/features/guests/hooks/useGuestContactEvents.spec.ts
  modified: []
decisions:
  - "Shared socket singleton (lib/socket.ts) for Phase 16 — useHousekeepingSocket NOT migrated (deferred v1.4 to avoid scope creep)"
  - "staffUserName from Socket.io payload used for toast (NOT user?.name from auth store — trap #6)"
  - "staleTime: 0 on query — Socket.io invalidation drives freshness, query stays perpetually stale"
  - "enabled: !!guestId && !!accessToken — guards against unauthenticated render"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-19"
  tasks_completed: 2
  files_created: 5
  files_modified: 0
  tests_added: 8
---

# Phase 16 Plan 3: Frontend socket singleton + API client + useGuestContactEvents hook Summary

**One-liner:** Shared Socket.io singleton + typed API client + `useGuestContactEvents` hook combining TanStack Query with per-guest Socket.io room subscription and Spanish toast notifications.

## What Was Built

### Task 1: Infrastructure files

**`apps/web/src/lib/socket.ts`** — shared Socket.io singleton
- `getOrCreateSocket(accessToken)`: returns existing socket if token unchanged; disconnects stale socket and reconnects if token rotated
- `disconnectSocket()`: forces close and clears module state (call on logout)
- Same `io()` options as `useHousekeepingSocket` (JWT in `auth.token`, reconnection, websocket + polling transports)
- Note: `useHousekeepingSocket` NOT migrated to this singleton in v1.3 — two connections remain (functionally correct, cleanup deferred to v1.4)

**`apps/web/src/features/guests/types.ts`** — 4 exported types:
- `ContactMethod`: `'CALL' | 'WHATSAPP' | 'EMAIL'`
- `GuestContactEventDto`: full REST response shape (mirrors `ContactEventResponseDto` from 16-01)
- `ContactEventSocketPayload`: Socket.io `contact-event.created` payload shape with `staffUserName` (DB-joined, authoritative)
- `LastContactEventSummary`: condensed shape for `GET /api/guests` list (N+1 prevention, used by 16-02)

**`apps/web/src/features/guests/guest-contact.api.ts`** — 2 axios wrappers:
- `createContactEvent(guestId, input)` → `POST /api/guests/:id/contact-events`
- `listContactEvents(guestId, limit?)` → `GET /api/guests/:id/contact-events?limit=N`
- Uses existing `api` axios instance from `lib/api.ts` (JWT interceptor included)

### Task 2: useGuestContactEvents hook (TDD)

**`apps/web/src/features/guests/hooks/useGuestContactEvents.ts`**

Combines two mechanisms:

1. **TanStack Query** (`queryKey: ['guest', guestId, 'contact-events']`, `staleTime: 0`, `enabled: !!guestId && !!accessToken`) via `listContactEvents()`.

2. **Socket.io subscription** via `getOrCreateSocket(accessToken)`:
   - On mount: `socket.emit('join-room', 'guest:{guestId}')`
   - On `contact-event.created`:
     - Always: `queryClient.invalidateQueries({ queryKey: ['guest', guestId, 'contact-events'] })`
     - If `event.staffUserId !== user?.id` (other staff): `toast.info('{staffUserName} inició contacto por {método} con este huésped')`
     - If self: silent (click handler already showed success toast)
   - On unmount/guestId change: `socket.emit('leave-room', ...)` + `socket.off('contact-event.created', handler)`

**`METHOD_LABEL` map (Spanish):**
| Key | Label |
|-----|-------|
| `CALL` | `llamada` |
| `WHATSAPP` | `WhatsApp` |
| `EMAIL` | `email` |

**`apps/web/src/features/guests/hooks/useGuestContactEvents.spec.ts`** — 8 Vitest specs covering all behaviors:

| # | Behavior | Result |
|---|----------|--------|
| 1 | Returns TanStack Query data array | PASS |
| 2 | Join-room emitted on mount with token | PASS |
| 3 | Leave-room + off on unmount | PASS |
| 4 | Self event: invalidate, NO toast | PASS |
| 5 | Other user event: invalidate + toast with staffUserName | PASS |
| 6 | Spanish method labels (CALL/WHATSAPP/EMAIL) | PASS |
| 7 | No accessToken: no socket, query disabled | PASS |
| 8 | guestId change: leave old + join new room | PASS |

## Research Trap #6 Mitigation Confirmed

`event.staffUserName` from the Socket.io payload is used exclusively for toast text. `user?.name` from the auth store is never referenced for toast content (only `user?.id` is used for self-filter comparison). Verified via:
```
rg "event\.staffUserName" → 3 matches (comment + code)
rg "user\?\.name" → 2 matches (comments only, no executable code)
```

## useHousekeepingSocket Migration (Deferred)

`useHousekeepingSocket` was intentionally NOT migrated to `lib/socket.ts` in this plan. Two separate socket connections exist in v1.3:
- `useHousekeepingSocket` (per-feature module singleton, connects on housekeeping page mount)
- `getOrCreateSocket` (lib singleton, used by `useGuestContactEvents`)

Both connect to the same `/` namespace. NestJS handles multiple connections per client correctly. The dual-connection situation is not a correctness issue for a hotel with ~5 concurrent staff. Migration to single connection is deferred to v1.4 cleanup.

## Deviations from Plan

None. Plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- `apps/web/src/lib/socket.ts` — FOUND
- `apps/web/src/features/guests/types.ts` — FOUND
- `apps/web/src/features/guests/guest-contact.api.ts` — FOUND
- `apps/web/src/features/guests/hooks/useGuestContactEvents.ts` — FOUND
- `apps/web/src/features/guests/hooks/useGuestContactEvents.spec.ts` — FOUND

Commits verified:
- `99b932a`: feat(16-03): shared socket singleton + guest-contact API client + types
- `e3fe381`: feat(16-03): useGuestContactEvents hook + 8-case spec (GCC-08, GCC-11)

Test results: 8/8 green, 0 regressions in housekeeping suite (13/13 total across both feature suites).
TypeScript: `tsc --noEmit` exit 0.
