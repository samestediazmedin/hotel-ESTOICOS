---
phase: 15-extended-contact-capture
plan: 01
subsystem: backend-data
tags: [prisma, migration, zod, dto, guests, phase15]
dependency_graph:
  requires: []
  provides:
    - ContactPreference enum in PostgreSQL DB
    - Guest model 6 new nullable columns
    - CreateGuestSchema Zod with 6 optional fields + E.164 regex
    - GuestsService.create() + update() explicit field mapping
    - GuestsRepository typed param extensions
  affects:
    - Wave 2 plans (15-02 public-booking, 15-03 frontend) — unblocked by this plan
tech_stack:
  added: []
  patterns:
    - Explicit DTO-to-Prisma field mapping in NestJS service (silent-drop prevention)
    - Zod .optional().default() fields require TypeScript-level inclusion in test fixtures
    - Manual migration creation for exact timestamp control (Railway intermittent)
key_files:
  created:
    - apps/api/prisma/migrations/20260526000000_phase15_extended_guest_contact/migration.sql
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/modules/guests/dto/create-guest.dto.ts
    - apps/api/src/modules/guests/guests.service.ts
    - apps/api/src/modules/guests/guests.repository.ts
    - apps/api/src/modules/guests/guests.service.spec.ts
decisions:
  - "Migration timestamp 20260526000000 — last migration was 20260525000000, not 20260519000001 as plan estimated"
  - "CreateGuestPipe imported at top of spec file — require() fails in Vitest ESM context"
  - "Zod .optional().default() makes fields required in TypeScript Output type — existing Test 1 needed preferredLanguage + marketingConsent added"
metrics:
  duration: "~15 min"
  completed_date: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 5
  tests_new: 5
  tests_total: 17
requirements: [GCC-01, GCC-02]
---

# Phase 15 Plan 01: Migration + ContactPreference + Schema + Zod DTOs + GuestsService Mapping Summary

**One-liner:** Prisma Guest model extended with ContactPreference enum + 6 nullable columns; Zod CreateGuestSchema extended with E.164 validation; GuestsService.create() and update() explicitly map all 6 new fields to prevent silent drops.

## Migration

- **Timestamp:** `20260526000000_phase15_extended_guest_contact`
- **Note on timestamp deviation:** Plan specified `20260519000001` based on research finding `20260519000000_add_tra_export_log` as last migration. Actual last migration at execution time was `20260525000000_phase13_hotel_settings_admin` — timestamp corrected to `20260526000000` to preserve ordering.
- **Applied to Railway:** Yes — `prisma migrate deploy` ran cleanly, no P1001 retry needed.
- **DDL order verified:** `CREATE TYPE "ContactPreference"` appears at line 7, BEFORE `ALTER TABLE "guests"` at line 11. Correct order.

### Columns Added to `guests` Table

| Column | Type | Default | Nullable |
|--------|------|---------|----------|
| `preferredLanguage` | `VARCHAR(8)` | `'es'` | No (NOT NULL with default) |
| `contactPreference` | `ContactPreference` enum | — | Yes |
| `whatsappNumber` | `VARCHAR(16)` | — | Yes |
| `marketingConsent` | `BOOLEAN` | `false` | No (NOT NULL with default) |
| `dietaryRestrictions` | `VARCHAR(500)` | — | Yes |
| `specialRequests` | `VARCHAR(1000)` | — | Yes |

- `marketingConsent DEFAULT false` — Colombian Habeas Data (Ley 1581) opt-in compliance confirmed.

## Zod Schema Extension

`CreateGuestSchema` in `create-guest.dto.ts` extended with 6 new fields:
- `preferredLanguage: z.enum(['es', 'en']).optional().default('es')`
- `contactPreference: z.enum(['EMAIL', 'PHONE', 'WHATSAPP']).nullable().optional()`
- `whatsappNumber: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable().optional()` — strict E.164
- `marketingConsent: z.boolean().optional().default(false)`
- `dietaryRestrictions: z.string().max(500).nullable().optional()`
- `specialRequests: z.string().max(1000).nullable().optional()`

`UpdateGuestSchema = CreateGuestSchema.partial()` auto-inherits all 6 fields — no change to `update-guest.dto.ts`.

## Service Mapping (Research Trap Fix)

`GuestsService.create()` and `GuestsService.update()` both explicitly enumerate all 6 new fields in their Prisma call object literals. This prevents the silent-drop scenario where Prisma persists `null` for fields not included in the explicit mapping.

`GuestsRepository.createGuest()` and `update()` parameter types extended to include the 6 new fields.

## Test Results

| Category | Count |
|----------|-------|
| Pre-existing tests (passing) | 6 |
| Pre-existing test file (guests.repository) | 6 |
| New Phase 15 tests | 5 |
| **Total** | **17** |

New tests added:
- P15-1: create() passes all 6 new fields to repo.createGuest (spy assertion)
- P15-2: create() without new fields sends Zod defaults (preferredLanguage:'es', marketingConsent:false, nulls)
- P15-3: update() with whatsappNumber passes it through to repo.update
- P15-4: update() with empty body sends undefined for all new fields (no override)
- P15-5: CreateGuestPipe rejects invalid E.164 format (abc, 300 1234567, +0123456789); accepts +573001234567

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod .default() fields required in TypeScript Output type — Test 1 fixture missing**
- **Found during:** Task 2 — first TypeScript check
- **Issue:** `CreateGuestDto` inferred type includes `preferredLanguage: "es" | "en"` and `marketingConsent: boolean` as required (not optional) because Zod `.default()` removes optionality from the Output type. Existing Test 1 called `service.create()` with a DTO object missing those fields.
- **Fix:** Added `preferredLanguage: 'es'` and `marketingConsent: false` to the Test 1 fixture call.
- **Files modified:** `apps/api/src/modules/guests/guests.service.spec.ts`
- **Commit:** included in 1453139

**2. [Rule 1 - Bug] CreateGuestPipe imported via require() — fails in Vitest ESM context**
- **Found during:** Task 2 — vitest run (Test P15-5)
- **Issue:** Test P15-5 used `require('./dto/create-guest.dto')` which fails in Vitest ESM modules.
- **Fix:** Moved import to top of file: `import { CreateGuestPipe } from './dto/create-guest.dto'`.
- **Files modified:** `apps/api/src/modules/guests/guests.service.spec.ts`
- **Commit:** included in 1453139

**3. [Rule 1 - Bug] repo.update mock returned makeRawGuest() with undecryptable documentNumber**
- **Found during:** Task 2 — vitest run (Tests P15-3, P15-4)
- **Issue:** `repoMock.update` returned `makeRawGuest()` with `documentNumber: '__CIPHERTEXT__'`. GuestsService.update() calls `this.toResponseDto(updated)` which tries to decrypt — fails on invalid ciphertext.
- **Fix:** Used `encryption.encrypt(PLAINTEXT_DOC)` to provide a valid ciphertext in the mock return value, matching the pattern used by Tests 2 and 4.
- **Files modified:** `apps/api/src/modules/guests/guests.service.spec.ts`
- **Commit:** included in 1453139

**4. [Rule 3 - Blocking] Migration timestamp corrected from plan estimate**
- **Found during:** Task 1 — migration directory listing
- **Issue:** Plan specified timestamp `20260519000001` based on research finding `20260519000000` as last migration. Actual last migration was `20260525000000_phase13_hotel_settings_admin`.
- **Fix:** Used `20260526000000` as migration timestamp.
- **Files modified:** migration directory name and migration.sql
- **Commit:** e9ac3b9

## Surface Area for Wave 2

The following fields are now available in the generated Prisma `Guest` type and `CreateGuestDto` for Wave 2 plans to consume:

| Field | Prisma Type | Zod Type | Wave 2 Consumer |
|-------|------------|----------|-----------------|
| `preferredLanguage` | `String` | `'es' \| 'en'` | public-booking.service.ts |
| `contactPreference` | `ContactPreference?` | `'EMAIL' \| 'PHONE' \| 'WHATSAPP' \| null` | email.service.ts, public-booking.service.ts |
| `whatsappNumber` | `String?` | `string \| null` (E.164) | email.service.ts, public-booking.service.ts |
| `marketingConsent` | `Boolean` | `boolean` | public-booking.service.ts (hotel-internal) |
| `dietaryRestrictions` | `String?` | `string \| null` (max 500) | email.service.ts, public-booking.service.ts |
| `specialRequests` | `String?` | `string \| null` (max 1000) | email.service.ts, public-booking.service.ts |

## Commits

| Hash | Message |
|------|---------|
| `e9ac3b9` | feat(15-01): migration — ContactPreference enum + 6 guest contact columns |
| `1453139` | feat(15-01): explicit field mapping for 6 new Guest fields (research trap fix) |

## Self-Check: PASSED

- migration.sql: FOUND at apps/api/prisma/migrations/20260526000000_phase15_extended_guest_contact/migration.sql
- Contains `CREATE TYPE "ContactPreference"` BEFORE ALTER TABLE: VERIFIED
- `prisma migrate status`: Database schema is up to date
- `tsc --noEmit`: exit 0
- `vitest run src/modules/guests/`: 17/17 PASSED
- `whatsappNumber` in generated Guest type: VERIFIED (apps/api/src/generated/prisma/models/Guest.ts:39)
- `preferredLanguage` in guests.service.ts: 3 occurrences (GuestLike, create, update)
