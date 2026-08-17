# Phase 12: Public Data API + Frontend Wiring — Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Source:** Auto-derived from user intent ("cada cambio del admin debe verse reflejado en la página") + REQUIREMENTS.md (PDA-01..08) + Phase 10 hardcoded data audit

<domain>
## Phase Boundary

Eliminate **all hardcoded portal data** by exposing public (no-auth) endpoints over the existing v1.0 backend modules, and rewiring the v1.1 portal hooks to consume them via TanStack Query.

**What this phase delivers:**
- 3 new public endpoints: `/api/public/hotel-info`, `/api/public/room-types`, `/api/public/hotel-photos`
- 3 frontend hooks rewired to TanStack Query: `useHotelInfo`, plus new `useRoomTypes`, `useHotelPhotos`
- Skeleton loading + error states matching the v1.1 bundle layout
- Cleanup of v1.1 deprecated `LegacyBookingPage.tsx`

**Out of scope** (deferred to Phase 13 or v1.3+):
- Admin UI to EDIT the data exposed (that's Phase 13 `/settings/hotel`)
- New schema columns or migrations (Phase 12 only exposes existing data)
- Reviews API (Phase 14)
- Public reservations API with payment (v1.3+)
- Multi-language (i18n) variants of the public payload

</domain>

<decisions>
## Implementation Decisions (locked)

### Backend module placement
- Create new module `apps/api/src/modules/public-portal/` (NOT extend `public-booking` — keep concerns separated)
- Module exposes 3 controllers OR 1 controller with 3 routes — single controller is simpler, adopt that
- Module is global-route-prefix-aware: routes are `/api/public/hotel-info`, `/api/public/room-types`, `/api/public/hotel-photos`
- Public access pattern: NO `@UseGuards()` and NO `@Roles()` decorators on these endpoints. Confirm `JwtAuthGuard` is NOT global (look at `app.module.ts` — if it is global, add `@Public()` skip decorator OR move routes to a module without the guard)

### Cache strategy
- All 3 endpoints return `Cache-Control: public, max-age=60, s-maxage=60` header for CDN compatibility
- 60-second window means admin sees their changes within ~1 minute on portal
- For Phase 12, this is acceptable. v1.3 may add event-driven cache invalidation if needed.

### Payload shapes

**`GET /api/public/hotel-info`**:
```json
{
  "name": "Hotel Sumapaz",
  "address": "La Candelaria, Bogotá",
  "tagline": "Hospitalidad, operada con inteligencia",
  "description": "Hotel boutique de 42 habitaciones...",
  "phone": "+57 (1) 555-0100",
  "rating": 4.84,
  "reviewCount": 318,
  "tags": ["Hotel boutique", "42 habitaciones", "4 pisos", "Desayuno incluido"]
}
```
- For v1.2: `rating` and `reviewCount` are still hardcoded constants returned by the API (real data comes in Phase 14 from `reviews` table aggregate)
- `tagline` is NEW field — needs Prisma migration adding column to `system_config` OR may already exist (researcher confirms)
- `name`, `address` exist in `SystemConfig` model (line 146 of schema)
- `phone`, `description`, `tags` are NEW fields — Phase 12 adds them via migration

**`GET /api/public/room-types`**:
```json
[
  {
    "id": "ulid",
    "name": "Doble Estándar",
    "capacity": 2,
    "description": "Habitación cómoda para dos huéspedes...",
    "basePrice": 280000,
    "photos": [{"url": "https://...", "alt": "Doble Estándar"}],
    "badge": null
  },
  ...
]
```
- Filtered to `isPublished=true` (NEW field — Phase 12 migration adds it, defaulting to true for backwards compat)
- Hides cost-only fields (e.g., internal margin, supplier cost) — already absent from RoomType schema, but explicitly filter via DTO
- Sorted by `basePrice` ASC
- `badge` is a v1.2 hardcoded computed field — first result gets "Más económica", second gets "Mejor valor" — NO new schema column; computed in service

**`GET /api/public/hotel-photos`**:
```json
[
  {"url": "https://r2.../fachada.jpg", "alt": "Fachada del hotel", "displayOrder": 0},
  {"url": "https://r2.../lobby.jpg", "alt": "Lobby", "displayOrder": 1},
  ...
]
```
- Source: a NEW table `hotel_photos` OR reuse `RoomType.photos` filtered by `roomTypeId=null` (would need schema change). Recommend NEW table for clarity.
- Migration in Phase 12 creates `hotel_photos` table (so Phase 13 admin UI has somewhere to write to). Phase 12 only seeds 5 placeholder rows pointing to current `apps/web/public/hotel-photos/*.jpg` URLs.

### Frontend wiring patterns
- New TanStack Query hooks under `apps/web/src/features/public-portal/hooks/`:
  - `useHotelInfo()` — REPLACES current env-var hook
  - `useRoomTypes()` — NEW (replaces `data/roomTypes.ts`)
  - `useHotelPhotos()` — NEW (replaces `data/photos.ts`)
- Each hook: `queryKey: ['public', 'hotel-info' | 'room-types' | 'hotel-photos']`, `staleTime: 60_000` (matches backend cache window)
- Shared `apiClient` (likely exists in `apps/web/src/lib/api.ts` — researcher confirms) — use the same axios instance but WITHOUT auth interceptor for public endpoints (or just allow the auth header to be sent harmlessly)

### Skeleton loading states
- Each section renders a skeleton matching its content layout:
  - `HeroGallery` skeleton: 4 boxes (desktop) / 3 boxes (mobile) with `animate-pulse bg-warm-cream`
  - `HotelIdentity` skeleton: title bar + rating bar + 4 pill placeholders
  - `RoomsSection` skeleton: 4 card placeholders
- Use `animate-pulse` Tailwind utility on `bg-warm-cream` for the placeholder boxes (token-compatible)
- Error state: minimal toast or inline alert "No pudimos cargar esta sección. Intentar de nuevo." with retry button → `queryClient.invalidateQueries()`

### Fallback strategy when API fails
- Each `useXxx` hook has a `placeholderData` from a small fallback constant (truncated version of the v1.1 hardcoded modules)
- If 3 consecutive query failures occur, render the placeholderData (graceful degradation — portal never breaks completely)

### Data module cleanup
- `apps/web/src/features/public-portal/data/hotel.ts` → can be DELETED entirely (replaced by useHotelInfo)
- `apps/web/src/features/public-portal/data/roomTypes.ts` → DELETE, the 4 hardcoded entries become 4 SEED rows in Prisma (admin can edit later)
- `apps/web/src/features/public-portal/data/photos.ts` → DELETE, the 5 Unsplash URLs become 5 SEED rows in `hotel_photos` table
- `apps/web/src/features/public-portal/data/reviews.ts` → STAYS for Phase 12 (reviews are Phase 14 scope)

### LegacyBookingPage cleanup
- `apps/web/src/features/public-booking/LegacyBookingPage.tsx` → DELETED in Phase 12 (was a v1.1 deprecation marker; safe to remove now)
- Search for any leftover imports; confirm router.tsx has no reference

### Migration scope for Phase 12
- 1 Prisma migration: adds 3 columns to `system_config` (`tagline`, `description`, `phone`) + 1 JSON column for `tags` + 1 column `isPublished` to `RoomType` + 1 NEW table `hotel_photos { id, url, alt, displayOrder, createdAt }` indexed on `displayOrder`
- Seed script: populates current hardcoded portal data into these new fields/rows (so portal looks identical post-migration before admin changes anything)
- Migration runs against Railway DB via `prisma migrate deploy` (existing v1.0 workflow)

### Verification commands
1. `pnpm --filter api tsc --noEmit` → exits 0
2. `pnpm --filter web tsc --noEmit` → exits 0
3. `curl http://localhost:3011/api/public/hotel-info` → 200 with valid JSON, no Authorization header needed
4. `curl http://localhost:3011/api/public/room-types` → 200 with array of 4 room types
5. `curl http://localhost:3011/api/public/hotel-photos` → 200 with array of 5 photos
6. `rg "from.*data/(hotel|roomTypes|photos)'" apps/web/src --glob "*.tsx"` → ZERO matches
7. `fd LegacyBookingPage apps/web/src` → ZERO files
8. `pnpm --filter web vitest run src/features/public-portal/` → all Phase 10 tests still pass
9. Manual: open `/booking`, edit a RoomType price in `/rooms` (admin), wait 60s, refresh `/booking` → new price visible

### Claude's Discretion
- Whether to use `nestjs-zod` Zod pipes vs `class-validator` for DTO validation on public endpoints (codebase preference — pick one and stay consistent)
- Whether `hotel_photos` is its own controller or part of `public-portal.controller.ts` (single controller is simpler — recommend it)
- Whether to expose `description` as Markdown or plain text (recommend plain text for v1.2; Markdown rendering deferred)
- Skeleton placeholder dimensions — match Phase 10 bundle layout pixel ranges

</decisions>

<canonical_refs>
## Canonical References

### Existing backend code (consume as patterns)
- `apps/api/src/system-config/system-config.controller.ts` (20L) — minimal SystemConfig HTTP layer; check if route is public or auth-gated
- `apps/api/src/system-config/system-config.service.ts` — existing service to extend
- `apps/api/src/modules/public-booking/public-booking.controller.ts` (92L) — proven pattern for public endpoints WITHOUT auth; how it skips JwtAuthGuard
- `apps/api/src/modules/inventory/inventory.service.ts` — existing RoomType CRUD; use to fetch in new public endpoint
- `apps/api/src/modules/inventory/photos/photos.service.ts` — R2 presigned URL pattern (Phase 13 will need this)
- `apps/api/prisma/schema.prisma` lines 146-200 — SystemConfig, RoomType, Room models
- `apps/api/src/main.ts` — global prefix `/api`, CORS config

### Existing frontend code (refactor targets)
- `apps/web/src/features/public-portal/hooks/useHotelInfo.ts` — current env-var-driven, REPLACE with TanStack Query
- `apps/web/src/features/public-portal/data/{hotel,roomTypes,photos}.ts` — DELETE after wiring
- `apps/web/src/features/public-portal/components/{HeroGallery,HotelIdentity,RoomsSection}.tsx` — update to consume hooks instead of importing data modules
- `apps/web/src/features/public-portal/HotelHomePage.tsx` — orchestrates the queries
- `apps/web/src/lib/api.ts` — existing axios client, reuse
- `apps/web/src/features/public-booking/LegacyBookingPage.tsx` — DELETE

### Project requirements + roadmap
- `.planning/REQUIREMENTS.md` — PDA-01..08
- `.planning/ROADMAP.md` — Phase 12 section: 6 success criteria
- `.planning/PROJECT.md` — milestone v1.2 goal + scope

### Dependencies (all already installed in v1.0 + v1.1)
- `@nestjs/swagger`, `nestjs-zod`, `class-validator` — pick existing pattern
- `@tanstack/react-query` v5 — already used in staff queries (Phase 7 ChatPanel, Phase 6 Dashboard)
- `axios` via `lib/api.ts`
- `prisma` v7

</canonical_refs>

<specifics>
## Specific Ideas

### Module file structure
```
apps/api/src/modules/public-portal/
├── public-portal.module.ts
├── public-portal.controller.ts    (3 GET endpoints)
├── public-portal.service.ts       (orchestrates SystemConfig + Inventory + HotelPhotos repos)
├── public-portal.service.spec.ts
└── dto/
    ├── public-hotel-info.dto.ts
    ├── public-room-type.dto.ts
    └── public-hotel-photo.dto.ts
```

### Hooks file structure
```
apps/web/src/features/public-portal/hooks/
├── useHotelInfo.ts          (REWRITE — was env-var, now TanStack Query)
├── useRoomTypes.ts          (NEW)
├── useHotelPhotos.ts        (NEW)
├── useReservationDraft.ts   (UNCHANGED — URL params)
└── useForceLightTheme.ts    (UNCHANGED — dark-mode prevention)
```

### Skeleton component
- Create `apps/web/src/features/public-portal/components/skeletons.tsx` with named exports:
  - `<HeroGallerySkeleton />` — 4-box grid with `bg-warm-cream animate-pulse`
  - `<HotelIdentitySkeleton />` — title bar + rating row + 4 pills
  - `<RoomsSectionSkeleton />` — 4 card placeholders
- Each section renders skeleton when `isPending`, real content when `data` exists, error toast when `isError`

### Migration name
`apps/api/prisma/migrations/{timestamp}_phase12_public_portal_data/migration.sql`

Includes:
- ALTER TABLE `system_config` ADD COLUMN `tagline`, `description`, `phone`, `tags` (JSON)
- ALTER TABLE `room_types` ADD COLUMN `is_published` BOOLEAN DEFAULT true
- CREATE TABLE `hotel_photos` with indexed `display_order`
- Seed via separate seed script `apps/api/prisma/seed-phase12.ts`

</specifics>

<deferred>
## Deferred Ideas

- **Admin UI to edit hotel-info / room-types / hotel-photos** — Phase 13 (`/settings/hotel`)
- **Reviews API** — Phase 14
- **CDN headers beyond Cache-Control** (ETag, Last-Modified) — v1.3 if performance demands
- **Image optimization service** (Next.js-style on-the-fly resizing) — v1.3+
- **Multi-language public payload** — v1.3+ when i18n lands
- **Public room types pagination** — current hotel has 4 types; pagination overkill until 20+
- **Real-time invalidation** (Server-Sent Events from admin save → portal cache bust) — v1.3 if 60s window is too long

</deferred>

---

*Phase: 12-public-data-api-frontend-wiring*
*Context gathered: 2026-05-17 — milestone v1.2 launch*
