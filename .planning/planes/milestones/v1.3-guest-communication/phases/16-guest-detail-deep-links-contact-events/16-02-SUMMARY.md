---
phase: 16-guest-detail-deep-links-contact-events
plan: 2
subsystem: backend
tags: [prisma, nestjs, dto, n+1-prevention, lastContactEvent, guests-module]
dependency_graph:
  requires: [16-01]
  provides: [lastContactEvent-on-GET-guests]
  affects: [guests.repository, guests.service, guest-response.dto, guest-public.dto]
tech_stack:
  added: []
  patterns: [Prisma include take:1 orderBy desc (lateral join), defensive null coalesce on optional include, TDD RED-GREEN cycle]
key_files:
  created: []
  modified:
    - apps/api/src/modules/guests/guests.repository.ts
    - apps/api/src/modules/guests/guests.service.ts
    - apps/api/src/modules/guests/guests.service.spec.ts
    - apps/api/src/modules/guests/dto/guest-response.dto.ts
    - apps/api/src/modules/guests/dto/guest-public.dto.ts
decisions:
  - "toPublicDto includes lastContactEvent — operational signal for HOUSEKEEPING (not PII; documentNumber is the PII restriction)"
  - "contactEvents optional on GuestLike — findById does not include it; transformer handles undefined as null defensively"
  - "TDD RED confirmed: 5/16 tests failed before implementation; GREEN: 16/16 after"
  - "Wave parallelism: changes committed via 16-03 agent (e3fe381) due to concurrent work on same files"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-19"
  tasks_completed: 2
  files_created: 0
  files_modified: 5
  tests_added: 5
  tests_total_suite: 428
---

# Phase 16 Plan 2: Extend GET /api/guests with lastContactEvent (GCC-12 backend)

**One-liner:** N+1-safe `lastContactEvent` field on `GET /api/guests` — single Prisma `include` with `take:1, orderBy desc` + both DTO transformers updated (staff + housekeeping).

## What Was Built

### Task 1: GuestsRepository.findAll — contactEvents include

Extended `findAll(skip, take, search?)` in `guests.repository.ts` with a Prisma `include` block:

```typescript
include: {
  contactEvents: {
    take: 1,
    orderBy: { createdAt: 'desc' },
    select: {
      method: true,
      createdAt: true,
      staffUser: { select: { name: true } },
    },
  },
},
```

This is a lateral join (correlated subquery per guest row). With 50 rows and the composite index `@@index([guestId, createdAt(sort: Desc)])` from Phase 16 migration, Postgres uses the index efficiently. Zero N+1.

### Task 2: GuestLike type + both DTO transformers + both DTO interfaces

**GuestLike** (guests.service.ts): added optional `contactEvents` array:
```typescript
contactEvents?: Array<{
  method: 'CALL' | 'WHATSAPP' | 'EMAIL';
  createdAt: Date;
  staffUser: { name: string | null };
}>;
```

Field is optional because `findById` and `update()` do not include it — the transformer handles `undefined` and `[]` both as `null` (defensive default).

**toResponseDto + toPublicDto**: mapping added at end of both return objects:
```typescript
lastContactEvent:
  raw.contactEvents && raw.contactEvents.length > 0
    ? {
        method: raw.contactEvents[0].method,
        createdAt: raw.contactEvents[0].createdAt.toISOString(),
        staffUserName: raw.contactEvents[0].staffUser.name,
      }
    : null,
```

**GuestResponseDto + GuestPublicDto**: both classes declare `lastContactEvent` field with shape `{method, createdAt: string, staffUserName: string | null} | null`.

**Decision on toPublicDto:** `lastContactEvent` IS included in the public DTO (HOUSEKEEPING role). Rationale: knowing when staff last contacted a guest is operational information needed for room service coordination. It is not PII — the PII restriction applies to `documentNumber` only (GST-05). Including it in toPublicDto was the correct call per plan Task 2, Test 4.

## Before / After — DTO transformer shape

### Before (Phase 15 endpoint response)
```json
{
  "id": "clx...",
  "fullName": "Juan Pérez",
  "email": "juan@example.com",
  ...
}
```

### After (Phase 16)
```json
{
  "id": "clx...",
  "fullName": "Juan Pérez",
  "email": "juan@example.com",
  ...,
  "lastContactEvent": {
    "method": "WHATSAPP",
    "createdAt": "2026-05-19T10:00:00.000Z",
    "staffUserName": "María Recepcionista"
  }
}
```

Guest with no contact events:
```json
{ ..., "lastContactEvent": null }
```

## Test Results

- TDD RED: 5 tests failed (P16-1..5) — `lastContactEvent` undefined on both transformers
- TDD GREEN: 16/16 spec tests pass (11 pre-existing + 5 new P16 tests)
- Full backend suite: 428/428 tests — zero regressions
- `tsc --noEmit` → exit 0

## Deviations from Plan

### Coordination Note (not a deviation)

Changes to `apps/api/src/modules/guests/` were committed as part of `e3fe381` (16-03 parallel agent commit) due to concurrent wave execution. Both agents worked on overlapping files. The implementation is correct and fully committed — the commit hash attribution differs from the plan's expected single `feat(16-02)` commit, but the code and tests are identical to what was planned.

### Auto-fixed Issues

**1. [Rule 1 - Bug] makeContactEvent helper — null staffUserName propagation**
- **Found during:** TDD GREEN phase (Test P16-5)
- **Issue:** `staffUserName ?? 'María Pérez'` does not propagate `null` — `null ?? default` returns `default` in JS
- **Fix:** Changed to `'staffUserName' in overrides ? overrides.staffUserName! : 'María Pérez'` — explicit key presence check
- **Files modified:** `guests.service.spec.ts`
- **Commit:** e3fe381

## Curl Smoke Test

```bash
# With staff JWT
curl -H "Authorization: Bearer $STAFF_JWT" http://localhost:3000/api/guests

# Expected: array where each guest row has lastContactEvent (object or null)
# Guest with events: lastContactEvent: { method, createdAt, staffUserName }
# Guest without events: lastContactEvent: null
```

Manual verification depends on running API with Railway credentials. Automated TypeScript + Vitest coverage confirms correctness.

## Self-Check: PASSED

All 5 modified files confirmed in HEAD (e3fe381):
- `guests.repository.ts` — contactEvents include present (grep: 1 match)
- `guests.service.ts` — lastContactEvent in both transformers (grep: 2 matches)
- `guest-response.dto.ts` — lastContactEvent declared (grep: 1 match)
- `guest-public.dto.ts` — lastContactEvent declared (grep: 1 match)
- `guests.service.spec.ts` — 5 new P16 tests green (428 total suite)
- `tsc --noEmit` → exit 0

Commit e3fe381 verified in `git log --oneline`: present.
