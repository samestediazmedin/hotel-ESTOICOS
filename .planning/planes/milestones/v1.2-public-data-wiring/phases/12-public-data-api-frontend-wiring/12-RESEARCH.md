# Phase 12: Public Data API + Frontend Wiring — Research

**Researched:** 2026-05-17
**Domain:** NestJS public endpoints + Prisma migrations + TanStack Query v5 wiring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- New module `apps/api/src/modules/public-portal/` — single controller with 3 GET routes
- Routes: `/api/public/hotel-info`, `/api/public/room-types`, `/api/public/hotel-photos`
- No `@UseGuards()` on these endpoints (JwtAuthGuard is NOT global — confirmed below)
- Cache-Control: `public, max-age=60, s-maxage=60` on all 3 endpoints
- Payload shapes fixed (see CONTEXT.md `## Decisions` section)
- `badge` is computed in service (first=Más económica, second=Mejor valor) — no schema column
- `hotel_photos` is a NEW table (not repurposed from RoomPhoto)
- Phase 12 seeds 5 placeholder rows from current Unsplash URLs
- TanStack Query hooks under `apps/web/src/features/public-portal/hooks/`
- `staleTime: 60_000` on each hook, `queryKey: ['public', '...']`
- Skeleton loading with `animate-pulse bg-warm-cream`, inline error + retry button
- `placeholderData` fallback constants in each hook
- Data modules `data/hotel.ts`, `data/roomTypes.ts`, `data/photos.ts` DELETED after wiring
- `LegacyBookingPage.tsx` DELETED
- 1 Prisma migration adds: `tagline`, `description`, `phone`, `tags` (JSON) to `system_config`; `isPublished` (boolean, default true) to `room_types`; NEW `hotel_photos` table

### Claude's Discretion

- Whether to use `nestjs-zod` Zod pipes vs `class-validator` for DTO validation on public endpoints (research: pick existing codebase pattern)
- Whether `hotel_photos` has its own controller or shares `public-portal.controller.ts` (recommendation: single controller)
- Whether to expose `description` as Markdown or plain text (recommend plain text)
- Skeleton placeholder dimensions

### Deferred Ideas (OUT OF SCOPE)

- Admin UI to edit hotel-info / room-types / hotel-photos (Phase 13)
- Reviews API (Phase 14)
- CDN headers beyond Cache-Control (ETag, Last-Modified)
- Image optimization service
- Multi-language public payload
- Pagination for room types
- Real-time invalidation via SSE
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PDA-01 | `GET /api/public/hotel-info` (no auth) — `{ name, address, tagline, description, phone, rating, reviewCount, tags[] }` from `system_config`. Cache-Control: `public, max-age=60` | SystemConfigService pattern confirmed; new columns need migration; no guard needed (JwtAuthGuard is NOT global) |
| PDA-02 | `GET /api/public/room-types` (no auth) — array filtered to `isPublished=true`, sorted by `basePrice` ASC, badge computed | `InventoryRepository.findAllRoomTypes()` confirmed as base; `isPublished` needs migration; photos join via `rooms` → `room_photos` with R2 URL derivation |
| PDA-03 | `GET /api/public/hotel-photos` (no auth) — `{ url, alt, displayOrder }[]` sorted by displayOrder | NEW `hotel_photos` table (migration); seed from current `data/photos.ts` Unsplash URLs |
| PDA-04 | `useHotelInfo.ts` replaced with TanStack Query hook | Existing hook is sync/env-var only; full replacement with `useQuery`; `placeholderData` from `HOTEL_INFO_FALLBACK` constant |
| PDA-05 | `data/roomTypes.ts` deleted; `RoomsSection.tsx` consumes `useRoomTypes()` | Component currently receives `rooms` prop from `HotelHomePage`; prop must change to internal hook call or HotelHomePage passes query result |
| PDA-06 | `data/photos.ts` deleted; `HeroGallery.tsx` consumes `useHotelPhotos()` | Component currently receives `photos` prop; same pattern as PDA-05 |
| PDA-07 | Skeleton loading states while pending; error toast with retry | DashboardPage already uses inline skeleton pattern with `animate-pulse`; no toast library installed — inline error component recommended |
| PDA-08 | `LegacyBookingPage.tsx` deleted; zero references in router.tsx | Confirmed: router.tsx has NO import of `LegacyBookingPage`; only the file itself exists in `public-booking/` |
</phase_requirements>

---

## Summary

Phase 12 is a clean data-wiring phase with two distinct sub-problems: (1) exposing 3 public NestJS endpoints that pull from the existing `SystemConfig` + `RoomType` + a new `hotel_photos` table, and (2) replacing 3 hardcoded TS data modules in the frontend with TanStack Query hooks.

The backend work is straightforward because the project already has a proven public endpoint pattern (`PublicBookingController`) that skips JwtAuthGuard by simply omitting `@UseGuards()`. The `JwtAuthGuard` is NOT a global `APP_GUARD` — confirmed in `app.module.ts`. There is no `@Public()` decorator or IS_PUBLIC_KEY reflector in this codebase. Public means: no guard decorator at all.

The frontend work requires migrating `HotelHomePage.tsx` from importing static data to consuming three async queries, adding skeleton states to `HeroGallery`, `HotelIdentity`, and `RoomsSection`, and propagating query data via props or hook calls. The `api` axios instance's 401 interceptor is safe for public endpoints: it only fires a refresh call if it receives a 401 — the new public endpoints will return 200, so no interceptor logic will trigger.

The Prisma migration adds 4 columns to `system_config`, 1 column to `room_types`, and creates 1 new table. Migration naming follows the project's `{YYYYMMDDHHMMSS}_{slug}` convention, applied via `prisma migrate deploy` (Railway workflow).

**Primary recommendation:** Create `PublicPortalModule` mirroring the `PublicBookingModule` structure — no guards, Zod-based DTOs (matching the public-booking pattern), `SystemConfigModule` + `InventoryModule` imported, single controller.

---

## Standard Stack

### Core (all already installed — no new npm deps needed)

| Library | Version | Purpose | Already Used |
|---------|---------|---------|-------------|
| `@nestjs/core` | 11.x | NestJS kernel | Yes |
| `@nestjs/common` | 11.x | `Controller`, `Get`, `Header`, `Res` | Yes |
| `prisma` / `@prisma/client` | 7.x | Schema migration + DB client | Yes |
| `zod` | 4.4.x | DTO validation on backend (public-booking pattern) | Yes — public-booking uses Zod exclusively |
| `@tanstack/react-query` | 5.100.x | Frontend async hooks | Yes — DashboardPage, ReportExportPage, etc. |
| `axios` via `lib/api.ts` | 1.7.x | HTTP client for frontend | Yes |

### DTO Validation — Project Pattern Determination

The codebase has TWO coexisting patterns:

| Pattern | Used In | Files |
|---------|---------|-------|
| `class-validator` + `class-transformer` | `InventoryModule` DTOs (auth-gated) | `create-room-type.dto.ts` — uses `@IsString()`, `@IsNumber()` decorators |
| `Zod` schema parse | `PublicBookingModule` DTOs (public) | `public-availability-query.dto.ts` — uses `z.object(...).parse(body)` directly in controller |

**Recommendation for Phase 12 (Claude's Discretion):** Use Zod for the new `PublicPortalModule`, matching `PublicBookingModule`. The pattern is: define `z.object(...)` schema in `dto/` files, call `.parse()` in the service or controller action. No `ValidationPipe` pipe transform needed — public endpoints use direct `.parse()`. This is consistent with the only other public module in the codebase.

---

## Architecture Patterns

### Recommended Project Structure (backend)

```
apps/api/src/modules/public-portal/
├── public-portal.module.ts       # imports SystemConfigModule + InventoryModule
├── public-portal.controller.ts   # 3 GET endpoints, @Header('Cache-Control', ...) on each
├── public-portal.service.ts      # orchestrates SystemConfig + Inventory + HotelPhotos
├── public-portal.service.spec.ts
└── dto/
    ├── public-hotel-info.dto.ts  # Zod schema → inferred type
    ├── public-room-type.dto.ts
    └── public-hotel-photo.dto.ts
```

```
apps/api/prisma/migrations/
└── 20260517000000_phase12_public_portal_data/
    └── migration.sql
```

```
apps/api/prisma/
└── seed-phase12.ts   # standalone seed — NOT run on migrate deploy
```

### Recommended Frontend Structure

```
apps/web/src/features/public-portal/
├── hooks/
│   ├── useHotelInfo.ts      # REWRITE — was env-var, now useQuery
│   ├── useRoomTypes.ts      # NEW
│   ├── useHotelPhotos.ts    # NEW
│   ├── useReservationDraft.ts  # UNCHANGED
│   └── useForceLightTheme.ts   # UNCHANGED
├── components/
│   ├── HeroGallery.tsx      # UPDATE — prop still Photo[], skeleton added
│   ├── HotelIdentity.tsx    # UPDATE — prop still HotelInfo, skeleton added
│   ├── RoomsSection.tsx     # UPDATE — prop still RoomTypeCard[], skeleton added
│   ├── skeletons.tsx        # NEW — named skeleton exports
│   └── ... (other components UNCHANGED)
├── data/
│   ├── hotel.ts             # CONVERTED to fallback constant export only
│   ├── roomTypes.ts         # DELETE
│   ├── photos.ts            # DELETE
│   └── reviews.ts           # UNCHANGED (Phase 14 scope)
└── HotelHomePage.tsx        # UPDATE — query orchestration, skeleton/error states
```

### Pattern 1: Public NestJS Endpoint (proven — mirrored from PublicBookingController)

```typescript
// apps/api/src/modules/public-portal/public-portal.controller.ts
import { Controller, Get, Header } from '@nestjs/common';
import { PublicPortalService } from './public-portal.service';

// NO @UseGuards() — public endpoint. JwtAuthGuard is NOT global.
// ThrottlerGuard: NOT applied here (GET reads only, no abuse vector).
// CSRF: NOT needed (no state mutations, GET only).
@Controller('public')
export class PublicPortalController {
  constructor(private readonly service: PublicPortalService) {}

  @Get('hotel-info')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=60')
  async getHotelInfo() {
    return this.service.getHotelInfo();
  }

  @Get('room-types')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=60')
  async getRoomTypes() {
    return this.service.getPublishedRoomTypes();
  }

  @Get('hotel-photos')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=60')
  async getHotelPhotos() {
    return this.service.getHotelPhotos();
  }
}
```

**CRITICAL:** The `@Controller('public')` prefix collides with `PublicBookingController` which also uses `@Controller('public')`. Both register under `/api/public/`. This is fine in NestJS — route uniqueness is by method + path, not by controller name. The new routes `GET /api/public/hotel-info`, `GET /api/public/room-types`, `GET /api/public/hotel-photos` do not conflict with existing routes (`GET /api/public/csrf-token`, `GET /api/public/availability`, `POST /api/public/bookings`).

### Pattern 2: TanStack Query v5 Hook (mirrored from DashboardPage)

```typescript
// apps/web/src/features/public-portal/hooks/useHotelInfo.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { HOTEL_INFO_FALLBACK } from '../data/hotel';
import type { HotelInfo } from '../types';

async function fetchHotelInfo(): Promise<HotelInfo> {
  const res = await api.get<HotelInfo>('/public/hotel-info');
  return res.data;
}

export function useHotelInfo() {
  return useQuery({
    queryKey: ['public', 'hotel-info'],
    queryFn: fetchHotelInfo,
    staleTime: 60_000,
    placeholderData: HOTEL_INFO_FALLBACK,
    retry: 3,
  });
}
```

**Return type changes:** The current `useHotelInfo()` returns `HotelInfo` synchronously. The new version returns `UseQueryResult<HotelInfo>` — callers (`HotelHomePage`, `HotelIdentity`, `PortalFooter`, `LocationSection`) must destructure `{ data, isPending, isError }`. `data` will be `HotelInfo | undefined` when not using `placeholderData`, but since `placeholderData` is always set, `data` is effectively always `HotelInfo`.

### Pattern 3: Inline Skeleton (mirrored from DashboardPage KpiSkeleton)

```typescript
// apps/web/src/features/public-portal/components/skeletons.tsx

export function HeroGallerySkeleton() {
  return (
    <div className="hidden lg:grid gap-1.5 rounded-2xl overflow-hidden animate-pulse"
      style={{ gridTemplateColumns: '1.4fr 1fr 1fr', gridTemplateRows: '220px 220px' }}>
      <div className="row-span-2 bg-warm-cream" />
      <div className="bg-warm-cream" />
      <div className="bg-warm-cream" />
      <div className="bg-warm-cream" />
      <div className="bg-warm-cream" />
    </div>
  );
}

export function HotelIdentitySkeleton() {
  return (
    <div className="pt-6 pb-8 flex flex-col gap-4 animate-pulse">
      <div className="h-10 w-64 bg-warm-cream rounded" />
      <div className="h-4 w-48 bg-warm-cream rounded" />
      <div className="flex gap-2">
        {[1,2,3,4].map(i => <div key={i} className="h-7 w-24 bg-warm-cream rounded-full" />)}
      </div>
      <div className="h-16 w-full max-w-2xl bg-warm-cream rounded" />
    </div>
  );
}

export function RoomsSectionSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 animate-pulse">
      {[1,2,3,4].map(i => (
        <div key={i} className="rounded-2xl border border-warm-line bg-warm-white p-4 flex gap-4">
          <div className="h-24 w-24 lg:h-28 lg:w-28 bg-warm-cream rounded-xl shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <div className="h-4 w-32 bg-warm-cream rounded" />
            <div className="h-3 w-20 bg-warm-cream rounded" />
            <div className="h-5 w-16 bg-warm-cream rounded mt-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Pattern 4: Inline Error State (no toast library)

**Finding:** No toast library (`sonner`, `react-hot-toast`, or similar) is installed anywhere in the codebase. The grep for `toast|sonner|hot-toast|Toaster` returned zero matches.

**Recommendation:** Use an inline error component (not a toast lib) to avoid adding a dependency. Pattern:

```tsx
// In each section when isError:
{isError && (
  <div className="flex items-center gap-3 p-4 rounded-xl bg-terracotta-tint border border-terracotta text-sm text-terracotta-deep">
    <span>No pudimos cargar esta sección. Intentar de nuevo.</span>
    <button
      onClick={() => queryClient.invalidateQueries({ queryKey: ['public', 'hotel-info'] })}
      className="underline font-medium"
    >
      Reintentar
    </button>
  </div>
)}
```

This reuses existing token colors (terracotta-tint, terracotta-deep) per Phase 11 convention: "Error states use bg-terracotta-tint + text-terracotta instead of bg-red-50".

### Pattern 5: Prisma Migration (confirmed naming convention)

Existing migrations follow: `{14-digit-timestamp}_{slug}/migration.sql`

Examples from codebase:
- `20260513000000_init`
- `20260515000001_add_room_photo_r2_fields`
- `20260516000000_add_reservation_exclusion_constraint`
- `20260521000000_add_report_export_log`

Phase 12 migration name: `20260517000000_phase12_public_portal_data` (or next available timestamp).

Migrations are NOT auto-applied on boot. They are applied via `prisma migrate deploy` on Railway — a separate deployment step, not part of the NestJS bootstrap. The `prisma.config.ts` file (not a `datasource url` in `schema.prisma`) controls the CLI URL per Phase 1 convention: "Prisma 7.8 removes url from datasource block — URL lives in prisma.config.ts (CLI) and PrismaPg constructor (runtime)".

### Anti-Patterns to Avoid

- **No `@UseGuards(JwtAuthGuard)` on public endpoints** — there is no global guard to override; just omit guards entirely, as `PublicBookingController` does
- **No `@UseGuards(ThrottlerGuard)` on GET public endpoints** — read-only data, no rate-limit needed (only POST mutations need throttling per app.module.ts comment)
- **No `@Header('Cache-Control', ...)` via NestJS `@Res()`** — use the `@Header()` decorator from `@nestjs/common` directly (simpler, no passthrough needed for JSON responses)
- **Do not store full URLs in `hotel_photos.url`** — the pattern from `RoomPhoto` is to store `key` only and derive URL at read time via `R2_PUBLIC_URL`. However, Phase 12 seeds with Unsplash URLs which ARE full URLs. For the seed, store full URL in a `url` column (Phase 13 R2 integration will handle key-based storage)
- **Do not import `InventoryModule` directly for photo data** — `RoomPhoto` is scoped to rooms; Phase 12 creates a separate `hotel_photos` table unrelated to `room_photos`

---

## Critical Findings: Codebase Investigation Answers

### Q1 — Is `JwtAuthGuard` global?

**Answer: NO.** Confirmed by reading `app.module.ts` verbatim.

The comment on `ThrottlerModule` in `AppModule` explicitly states:
> "ThrottlerGuard is NOT registered as APP_GUARD here."

There is NO `APP_GUARD` provider for JwtAuthGuard anywhere in `AppModule`. Auth guards are applied at controller/route level only.

**Implication:** The new `PublicPortalController` needs zero special decoration. No `@Public()` decorator, no IS_PUBLIC_KEY reflector. Simply omit `@UseGuards()` and the routes are public.

### Q2 — Is `system-config.controller.ts` public or admin-only?

**Verbatim controller code:**

```typescript
@Controller('system-config')
export class SystemConfigController {
  @Get('public')
  async getPublicConfig() { ... }  // NO @UseGuards — intentionally public
}
```

Route: `GET /api/system-config/public` — no guards, public. Only returns `{ hotelName }`.

**Collision check:** The new `GET /api/public/hotel-info` is under `@Controller('public')` — completely different controller prefix from `system-config`. Zero collision.

### Q3 — `SystemConfig` model: existing columns

From `schema.prisma` lines 146-156, verbatim:

```
id                String   — cuid
hotelBusinessDate DateTime — @db.Date
hotelTimezone     String
ivaRate           Decimal  — @db.Decimal(5,4)
hotelName         String   — @default("Hotel Sumapaz")
hotelLogoUrl      String?
updatedAt         DateTime — @updatedAt
```

**Columns that EXIST:** `id`, `hotelBusinessDate`, `hotelTimezone`, `ivaRate`, `hotelName`, `hotelLogoUrl`, `updatedAt`

**Columns that NEED ADDING via migration:**
- `tagline` — String? (nullable)
- `description` — String? (nullable)
- `phone` — String? (nullable)
- `tags` — String[] (PostgreSQL array, NOT JSON — Prisma 7 supports `String[]` natively)

**Note on `tags` column type:** CONTEXT.md says `JSON column for tags`. The project uses Prisma 7 with PostgreSQL. `String[]` (native PostgreSQL array) is cleaner and already used in `RoomType.amenities: String[]`. Recommend `String[]` over `Json` for `tags` — same type as `amenities`, no JSON parsing overhead.

### Q4 — `RoomType` model: existing columns

From `schema.prisma` lines 160-175, verbatim:

```
id           String   — cuid
name         String
description  String?
basePrice    Decimal  — @db.Decimal(12,2)
maxOccupancy Int
amenities    String[]
isActive     Boolean  — @default(true)
createdAt    DateTime — @default(now())
updatedAt    DateTime — @updatedAt

relations:
  rooms     Room[]
  ratePlans RatePlan[]
```

**`isPublished` does NOT exist.** Migration must add it.

**`photos` relation does NOT exist on `RoomType`** — photos are on `Room` (individual rooms), not `RoomType`. The relation chain is: `RoomType` → `Room[]` → `RoomPhoto[]`. The public room-types endpoint needs to aggregate photos across all rooms of each type, or pick the first photo of the first room. The `public-booking/availability` endpoint already does this: it fetches rooms with `(room as any).photos ?? []`.

**Recommended approach for PDA-02 photos:** For each `RoomType`, join its `rooms` (active only) → first room's `RoomPhoto[]` (ordered by `order`). Derive URL at service layer as `${R2_PUBLIC_URL}/${photo.key}`. This reuses the existing `PhotosService` URL derivation pattern. If a room type has no photos, return `photos: []`.

**`capacity` field in CONTEXT.md payload:** CONTEXT.md specifies `capacity: 2` (integer) but the schema has `maxOccupancy: Int`. The service maps `maxOccupancy` → `capacity` in the response DTO. No schema change needed.

### Q5 — Migration patterns

Confirmed naming: `YYYYMMDDHHMMSS_slug` (14-digit timestamp).

Migrations are applied via `prisma migrate deploy` — a CLI command run as part of the Railway deploy pipeline, NOT automatically on `NestFactory.create()`. The `DIRECT_DATABASE_URL` env var (bypasses PgBouncer) is used for migrations (confirmed: INF-02 requirement). The `DATABASE_URL` (with `connection_limit=5`) is used at runtime.

### Q6 — Public endpoint auth-skip pattern

Confirmed from `public-booking.controller.ts`:

```
NO JwtAuthGuard anywhere here — this is the public surface.
CSRF protection is handled by CsrfMiddleware mounted in PublicBookingModule.configure().
```

The pattern is: **no `@UseGuards()` anywhere on the controller or its methods**. No `@Public()` decorator. No module-level guard exclusion list.

The new `PublicPortalModule` does NOT need `NestModule` + `configure()` because it has no CSRF (GET only, no state mutations).

### Q7 — DTO validation library in use

**Finding: TWO coexisting patterns.**

- `class-validator` + decorators: used in `InventoryModule`, `GuestsModule`, `ReservationsModule` (auth-gated modules)
- Zod `.parse()` directly: used in `PublicBookingModule` (public module)

**Recommendation (Claude's Discretion):** Use Zod for `PublicPortalModule`. The response DTOs are output-only (no incoming body validation needed for GET endpoints). Zod schemas define the shape of the response payload.

Since these are pure GET endpoints with no request body or complex query params, the "DTOs" here are actually response shape definitions — plain TypeScript interfaces or Zod `z.infer<>` types are sufficient. No runtime validation of request body needed.

### Q8 — `useHotelInfo` current signature

Current implementation:

```typescript
export function useHotelInfo(): HotelInfo {
  return {
    ...HOTEL_INFO_FALLBACK,
    hotelName: import.meta.env.VITE_HOTEL_NAME ?? HOTEL_INFO_FALLBACK.hotelName,
    hotelAddress: import.meta.env.VITE_HOTEL_ADDRESS ?? HOTEL_INFO_FALLBACK.hotelAddress,
  };
}
```

Returns: synchronous `HotelInfo` object — no loading/error states.

**Consumers identified:**
1. `HotelHomePage.tsx` — `const hotelInfo = useHotelInfo()` then passes to `HotelIdentity`, `LocationSection`, `ReviewsSection`, `PortalFooter`, `TopNav`
2. No other files import `useHotelInfo` (confirmed by grep — only `HotelHomePage.tsx` consumes it)

**Breaking change:** The new hook returns `UseQueryResult<HotelInfo>`. `HotelHomePage` must destructure `{ data: hotelInfo, isPending, isError }`. Since `placeholderData: HOTEL_INFO_FALLBACK` is always set, `hotelInfo` is never `undefined` in practice — but TypeScript will type it as `HotelInfo | typeof placeholderData` which resolves to `HotelInfo`. The child component props (`HotelIdentity`, `PortalFooter`) still receive `HotelInfo` — no prop interface changes needed.

**`HotelInfo` type additions needed:** The API returns `phone` field (currently hardcoded in `PortalFooter` as `'+57 (1) 555-0100'`). Add `phone?: string` to the `HotelInfo` interface. `PortalFooter` must use `hotelInfo.phone ?? '+57 (1) 555-0100'`.

Also: `hotelAddress` vs `address` — the `HotelInfo` interface uses `hotelAddress` but CONTEXT.md API shape uses `address`. The service maps `address: config.hotelName` → frontend type keeps `hotelAddress`. The hook maps the API response field `address` to `hotelAddress`. Alternatively, rename the interface field to `address` — this is a refactor that must be tracked.

### Q9 — TanStack Query patterns in v1.0

From `DashboardPage.tsx` (verbatim pattern):

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['reports', 'dashboard'],
  queryFn: reportingApi.getDashboard,
  staleTime: 0,
  refetchInterval: 30_000,
});
```

From `reporting.api.ts` (API client pattern):

```typescript
import { api } from '@/lib/api';

export const reportingApi = {
  getDashboard: (): Promise<DashboardDto> =>
    api.get<DashboardDto>('/reports/dashboard').then((r) => r.data),
};
```

**Pattern for public-portal:**
- Separate `public-portal.api.ts` file with plain functions (matching `reporting.api.ts` style)
- Functions use `api` from `@/lib/api`
- `queryKey` typed as `['public', string]` — no `@tanstack/react-query` QueryKey helper needed at this scope

**TanStack Query v5 confirmed:** `@tanstack/react-query: ^5.100.0` in `apps/web/package.json`.

### Q10 — Skeleton loading patterns

`DashboardPage.tsx` defines inline skeleton components (`KpiSkeleton`, `GridSkeleton`) in the same file. No shared skeleton component library exists.

**Pattern confirmed:** Define skeletons in `skeletons.tsx` under `components/` — export named components. Use `animate-pulse` + `bg-warm-cream` (established in DashboardPage: `"bg-warm-paper border border-warm-line rounded-xl p-4 animate-pulse"` with `"bg-warm-cream rounded"` inner divs).

No existing `ui/skeleton.tsx` component exists — consistent with the decision to define them per-feature.

### Q11 — Error toast / retry pattern

**No toast library installed** (grep for `toast|sonner|hot-toast|Toaster` → zero matches).

**Existing error pattern:** DashboardPage renders nothing special on error — it just falls through to no content. Phase 11 convention: "Error states use bg-terracotta-tint + text-terracotta instead of bg-red-50".

**Recommendation:** Inline error banner component as described in Pattern 4. Do NOT add `sonner` or any toast dependency — overkill for 3 sections with simple retry UX. Inline keeps the component self-contained.

### Q12 — `api.ts` auth interceptor behavior for public endpoints

**Finding: Safe. No 401 refresh loop possible.**

Analysis of the interceptor logic:

```typescript
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});
```

For a public visitor (no login): `accessToken` is null → no Authorization header sent.

```typescript
if (error.response?.status === 401 && !originalRequest._retry) { ... }
```

The new public endpoints return 200, not 401 → the 401 handler never fires.

**Phase 10 refresh-loop bug (mentioned in CONTEXT.md):** Already fixed in `api.ts` with the "EARLY EXIT" guard:
```typescript
const isRefreshCall = url.includes('/auth/refresh');
if (error.response?.status === 401 && isRefreshCall) {
  useAuthStore.getState().clearAuth();
  return Promise.reject(error);
}
```

The fix prevents recursive refresh calls. This is unrelated to the new public endpoints.

**Conclusion:** Use the existing `api` instance for public portal queries. No need for a separate axios instance without interceptors. The interceptor is harmless for 200-returning public endpoints.

### Q13 — LegacyBookingPage import status

**Grep result:** `LegacyBookingPage` appears ONLY in:
- `apps/web/src/features/public-booking/LegacyBookingPage.tsx` (the file itself — contains `export function LegacyBookingPage()`)

**`router.tsx` does NOT import `LegacyBookingPage`.** The router imports `HotelHomePage` for both `/` and `/booking`. `LegacyBookingPage.tsx` is an orphan file — safe to delete with no other changes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache-Control headers | Custom middleware | `@Header()` NestJS decorator | One-liner per route, no middleware setup |
| Public auth bypass | `@Public()` decorator + IS_PUBLIC_KEY reflector | Simply omit `@UseGuards()` | JwtAuthGuard is NOT global — no bypass mechanism needed |
| DTO response serialization | Custom mapper classes | Plain service methods returning typed objects | No `class-transformer` + `@Expose()` complexity for simple read-only DTOs |
| Photo URL derivation | Store full URL | Store key, compute `${R2_PUBLIC_URL}/${key}` at read time | Existing pattern from `PhotosService` — domain changes require no migration |
| Skeleton components | CSS animations from scratch | Tailwind `animate-pulse` + `bg-warm-cream` | Already established in DashboardPage |
| Query caching | Custom localStorage cache | TanStack Query `staleTime: 60_000` | Built-in, matches backend Cache-Control window |
| Toast library | `sonner` / `react-hot-toast` install | Inline error component with terracotta tokens | Zero new dependencies; simple 3-section retry UX |

---

## Common Pitfalls

### Pitfall 1: `@Controller('public')` double registration

**What goes wrong:** Both `PublicBookingModule` and the new `PublicPortalModule` use `@Controller('public')`. A developer might think this causes a conflict.

**Why it doesn't:** NestJS deduplicates routes by HTTP method + full path, not controller class name. `GET /api/public/hotel-info` is a unique route — no collision with existing `/api/public/csrf-token`, `/api/public/availability`, or `POST /api/public/bookings`.

**Warning sign:** If you accidentally redefine `GET /api/public/availability` in the new controller, NestJS will silently use whichever was registered last. Check route paths carefully.

### Pitfall 2: `RoomPhoto` relation is on `Room`, not `RoomType`

**What goes wrong:** Developer queries `prisma.roomType.findMany({ include: { photos: true } })` → Prisma error because `RoomType` has no `photos` relation.

**Why it happens:** Photos are scoped to individual rooms (`Room.photos`), not room types. The hierarchy is `RoomType → rooms[] → photos[]`.

**How to avoid:** Join `RoomType` → `rooms (isActive: true)` → `photos (orderBy: order ASC)` → take first photo of first room. Or for efficiency, raw query that aggregates per `roomTypeId`.

**Recommended Prisma query:**

```typescript
const roomTypes = await prisma.roomType.findMany({
  where: { isPublished: true, isActive: true },
  orderBy: { basePrice: 'asc' },
  include: {
    rooms: {
      where: { isActive: true },
      take: 1,
      include: {
        photos: { orderBy: { order: 'asc' }, take: 3 }
      }
    }
  }
});
// In service: derive photo URLs from keys
```

### Pitfall 3: `Decimal` type from Prisma must be serialized

**What goes wrong:** `roomType.basePrice` is a `Decimal` object (Prisma's `Decimal` class), not a JavaScript `number`. Returning it directly in a JSON response serializes as a string-wrapped object in some environments.

**Why it happens:** Prisma stores `Decimal(12,2)` columns as its custom `Decimal` type. `JSON.stringify(new Decimal('280000'))` may produce `"280000"` (string) instead of `280000` (number).

**How to avoid:** In the service, convert: `basePrice: Number(roomType.basePrice)`. Already done in `SystemConfigService.getIvaRate()`: `return config ? Number(config.ivaRate) : 0.19`.

### Pitfall 4: Migration adding NOT NULL columns to existing table

**What goes wrong:** `ALTER TABLE system_config ADD COLUMN tagline VARCHAR NOT NULL` fails if existing rows have no value for `tagline`.

**How to avoid:** All new columns in `system_config` should be `String?` (nullable) OR have a `DEFAULT` value. Recommend nullable: the seed script sets real values, the endpoint returns empty string as fallback. Example:

```sql
ALTER TABLE "system_config" ADD COLUMN "tagline" TEXT;
ALTER TABLE "system_config" ADD COLUMN "description" TEXT;
ALTER TABLE "system_config" ADD COLUMN "phone" TEXT;
ALTER TABLE "system_config" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
```

### Pitfall 5: Seed script idempotency

**What goes wrong:** Running `seed-phase12.ts` twice inserts duplicate rows in `hotel_photos` or corrupts `system_config`.

**How to avoid:**
- `system_config` has exactly 1 row (single-hotel invariant). Seed using `updateMany({ where: {}, data: { tagline: '...', ... } })` — updates all rows (there's only 1).
- `hotel_photos` seeded using `createMany` only if table is empty: `const count = await prisma.hotelPhoto.count(); if (count === 0) { await prisma.hotelPhoto.createMany(...) }`.
- `room_types` seed: the `isPublished` column defaults to `true` via migration — no explicit seed action needed for existing rows.

### Pitfall 6: `useHotelInfo` callers expect synchronous return

**What goes wrong:** `HotelHomePage` calls `const hotelInfo = useHotelInfo()` and passes `hotelInfo.hotelName` directly to `TopNav`. After the rewrite, the hook returns `UseQueryResult` — accessing `.hotelName` directly crashes if `data` is `undefined`.

**How to avoid:** Always set `placeholderData: HOTEL_INFO_FALLBACK` on the query. With placeholderData, `data` is ALWAYS defined (never undefined). The TypeScript type `typeof data` resolves to `HotelInfo` when placeholderData matches the return type. `HotelHomePage` can do: `const { data: hotelInfo = HOTEL_INFO_FALLBACK } = useHotelInfo()` for extra safety.

### Pitfall 7: Prisma migration deploy timing on Railway

**What goes wrong:** The Railway backend service restarts before the migration deploy step completes, causing NestJS to boot against the old schema and crash on first query touching new columns.

**Why it happens:** Phase 8 had stale connection pool issues. The pattern in this project is `DIRECT_DATABASE_URL` for migrations (bypasses PgBouncer). Migrations run as a separate Railway job step before the app starts.

**How to avoid:** Ensure the Railway service order is: `prisma migrate deploy` (via DIRECT_DATABASE_URL) → then `node dist/main.js`. This is already the established deploy workflow (INF-02). The seed script (`seed-phase12.ts`) must be run ONCE manually after migration deploy, not as part of the automated deploy pipeline.

### Pitfall 8: `hotelAddress` vs `address` field naming

**What goes wrong:** `HotelInfo` TypeScript interface uses `hotelAddress: string` but the API endpoint returns `address: string` (matching CONTEXT.md payload shape). The hook fetches `{ address }` but tries to assign to `hotelAddress` — TypeScript error.

**How to avoid:** Either (a) API returns `hotelAddress` field name to match existing interface, or (b) the hook maps `address → hotelAddress` explicitly, or (c) rename the interface field to `address` everywhere. Option (b) is safest — contained in the hook:

```typescript
async function fetchHotelInfo(): Promise<HotelInfo> {
  const res = await api.get<{ address: string } & Omit<HotelInfo, 'hotelAddress'>>('/public/hotel-info');
  return { ...res.data, hotelAddress: res.data.address };
}
```

---

## Code Examples

### Backend: `public-portal.module.ts`

```typescript
// Source: mirrors PublicBookingModule structure
import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PublicPortalController } from './public-portal.controller';
import { PublicPortalService } from './public-portal.service';

@Module({
  imports: [
    SystemConfigModule,  // provides SystemConfigService
    InventoryModule,     // provides InventoryRepository (already exported)
  ],
  controllers: [PublicPortalController],
  providers: [PublicPortalService],
})
export class PublicPortalModule {}
```

Register in `AppModule` imports array after `PublicBookingModule`.

### Backend: Migration SQL structure

```sql
-- Migration: phase12_public_portal_data
-- Phase 12 — adds public portal data fields

-- Extend system_config with hotel identity fields
ALTER TABLE "system_config" ADD COLUMN "tagline"     TEXT;
ALTER TABLE "system_config" ADD COLUMN "description" TEXT;
ALTER TABLE "system_config" ADD COLUMN "phone"       TEXT;
ALTER TABLE "system_config" ADD COLUMN "tags"        TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add isPublished to room_types (default TRUE for backwards compat)
ALTER TABLE "room_types" ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT true;

-- Create hotel_photos table (independent from room_photos)
CREATE TABLE "hotel_photos" (
  "id"           TEXT NOT NULL,
  "url"          TEXT NOT NULL,   -- full URL (Unsplash seed) or key in Phase 13+
  "alt"          TEXT NOT NULL DEFAULT '',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_photos_displayOrder_idx" ON "hotel_photos"("displayOrder");
```

### Frontend: `public-portal.api.ts` (new file)

```typescript
// Source: mirrors reporting.api.ts pattern
import { api } from '@/lib/api';
import type { HotelInfo, RoomTypeCard, Photo } from './types';

export const publicPortalApi = {
  getHotelInfo: (): Promise<HotelInfo> =>
    api.get<HotelInfo>('/public/hotel-info').then((r) => r.data),

  getRoomTypes: (): Promise<RoomTypeCard[]> =>
    api.get<RoomTypeCard[]>('/public/room-types').then((r) => r.data),

  getHotelPhotos: (): Promise<Photo[]> =>
    api.get<Photo[]>('/public/hotel-photos').then((r) => r.data),
};
```

### Frontend: Updated `HotelHomePage.tsx` orchestration (skeleton example)

```tsx
export function HotelHomePage() {
  useForceLightTheme();
  const { data: hotelInfo = HOTEL_INFO_FALLBACK, isPending: infoLoading } = useHotelInfo();
  const { data: photos = [], isPending: photosLoading } = useHotelPhotos();
  const { data: rooms = [], isPending: roomsLoading } = useRoomTypes();
  const navigate = useNavigate();

  return (
    <div className="hos min-h-screen bg-warm-white text-ink-1 font-body flex flex-col">
      <TopNav hotelName={hotelInfo.hotelName} ... />
      <main ...>
        <section id="inicio">
          {photosLoading ? <HeroGallerySkeleton /> : <HeroGallery photos={photos} />}
          {infoLoading ? <HotelIdentitySkeleton /> : <HotelIdentity hotelInfo={hotelInfo} />}
        </section>
        <section id="habitaciones">
          {roomsLoading ? <RoomsSectionSkeleton /> : <RoomsSection rooms={rooms} />}
        </section>
        ...
      </main>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Phase Changed | Impact |
|--------------|------------------|---------------|--------|
| Sync env-var hook `useHotelInfo()` | `useQuery` async hook with `placeholderData` | Phase 12 | Loading states required; `data` always defined via placeholderData |
| Hardcoded `PHOTOS: Photo[]` in `data/photos.ts` | DB-backed `hotel_photos` table | Phase 12 | Admin-editable in Phase 13 |
| Hardcoded `ROOM_TYPES: RoomTypeCard[]` | DB-backed `room_types` with `isPublished` filter | Phase 12 | Admin CRUD already exists (Phase 2); now exposed publicly |
| `HotelInfo` without `phone` field | `HotelInfo` + `phone?: string` | Phase 12 | `PortalFooter` uses `hotelInfo.phone ?? fallback` |

**Deprecated after Phase 12:**
- `apps/web/src/features/public-portal/data/hotel.ts` — becomes fallback constant only (not primary source)
- `apps/web/src/features/public-portal/data/roomTypes.ts` — deleted
- `apps/web/src/features/public-portal/data/photos.ts` — deleted
- `apps/web/src/features/public-booking/LegacyBookingPage.tsx` — deleted

---

## Files Inventory (Blast Radius)

### Backend (new files)

| File | Action | Notes |
|------|--------|-------|
| `apps/api/src/modules/public-portal/public-portal.module.ts` | CREATE | |
| `apps/api/src/modules/public-portal/public-portal.controller.ts` | CREATE | 3 GET routes |
| `apps/api/src/modules/public-portal/public-portal.service.ts` | CREATE | Orchestrates SystemConfig + Inventory + HotelPhotos |
| `apps/api/src/modules/public-portal/public-portal.service.spec.ts` | CREATE | Unit tests |
| `apps/api/src/modules/public-portal/dto/public-hotel-info.dto.ts` | CREATE | Zod/TS type |
| `apps/api/src/modules/public-portal/dto/public-room-type.dto.ts` | CREATE | Zod/TS type |
| `apps/api/src/modules/public-portal/dto/public-hotel-photo.dto.ts` | CREATE | Zod/TS type |
| `apps/api/prisma/migrations/{timestamp}_phase12_public_portal_data/migration.sql` | CREATE | ALTER + CREATE |
| `apps/api/prisma/seed-phase12.ts` | CREATE | Idempotent seed |
| `apps/api/src/app.module.ts` | MODIFY | Add `PublicPortalModule` to imports |
| `apps/api/prisma/schema.prisma` | MODIFY | New columns + table |

### Frontend (modify/create/delete)

| File | Action | Notes |
|------|--------|-------|
| `apps/web/src/features/public-portal/hooks/useHotelInfo.ts` | REWRITE | sync → async query |
| `apps/web/src/features/public-portal/hooks/useRoomTypes.ts` | CREATE | |
| `apps/web/src/features/public-portal/hooks/useHotelPhotos.ts` | CREATE | |
| `apps/web/src/features/public-portal/public-portal.api.ts` | CREATE | API client functions |
| `apps/web/src/features/public-portal/components/skeletons.tsx` | CREATE | 3 skeleton components |
| `apps/web/src/features/public-portal/HotelHomePage.tsx` | MODIFY | Query orchestration + skeletons |
| `apps/web/src/features/public-portal/components/HeroGallery.tsx` | MODIFY | Remove photos prop (internal hook) OR keep prop (HotelHomePage passes query data) |
| `apps/web/src/features/public-portal/components/HotelIdentity.tsx` | MODIFY | Add phone field handling |
| `apps/web/src/features/public-portal/components/RoomsSection.tsx` | MODIFY | Update `RoomTypeCard.capacity` type (int vs string) |
| `apps/web/src/features/public-portal/components/PortalFooter.tsx` | MODIFY | Use `hotelInfo.phone` instead of hardcoded string |
| `apps/web/src/features/public-portal/data/hotel.ts` | MODIFY | Remove primary data; keep `HOTEL_INFO_FALLBACK` as exported constant |
| `apps/web/src/features/public-portal/data/roomTypes.ts` | DELETE | Content moved to DB seed |
| `apps/web/src/features/public-portal/data/photos.ts` | DELETE | Content moved to DB seed |
| `apps/web/src/features/public-portal/data/index.ts` | MODIFY | Remove re-exports for roomTypes + photos |
| `apps/web/src/features/public-portal/types.ts` | MODIFY | Add `phone?: string` to HotelInfo; fix `capacity` type in RoomTypeCard |
| `apps/web/src/features/public-booking/LegacyBookingPage.tsx` | DELETE | No router reference — safe to delete |

**Total files: ~11 new + 11 modified + 3 deleted = 25 files touched**

### Recommended Wave Grouping

**Wave 1 (backend foundation — no frontend deps):**
- Prisma migration + schema update
- `PublicPortalModule` + `PublicPortalController` + `PublicPortalService`
- DTOs + `AppModule` registration
- `seed-phase12.ts`

**Wave 2 (frontend wiring — depends on Wave 1 endpoints):**
- `public-portal.api.ts`
- `useHotelInfo` rewrite + `useRoomTypes` + `useHotelPhotos`
- `skeletons.tsx`
- `HotelHomePage.tsx` update
- `types.ts` update
- Data module cleanup (delete roomTypes.ts, photos.ts; update hotel.ts + index.ts)
- `PortalFooter`, `HotelIdentity`, `RoomsSection` minor updates

**Wave 3 (cleanup + verification):**
- Delete `LegacyBookingPage.tsx`
- Run Phase 10 Vitest regression suite
- TypeScript checks (`pnpm --filter api tsc --noEmit`, `pnpm --filter web tsc --noEmit`)
- Manual verification: curl 3 endpoints + admin price edit → portal refresh

---

## Open Questions

1. **`capacity` type mismatch**
   - What we know: `types.ts` defines `RoomTypeCard.capacity: string` ("2 personas"); schema has `RoomType.maxOccupancy: Int`
   - What's unclear: should the API return `capacity: 2` (integer, matching CONTEXT.md payload) or `capacity: "2 personas"` (string, matching current type)?
   - Recommendation: API returns integer `capacity: 2`; update `RoomTypeCard.capacity: number`; `RoomsSection` renders `${room.capacity} personas`

2. **`hotel_photos.url` vs `hotel_photos.key` column design**
   - What we know: `RoomPhoto` stores `key` only (R2-safe). Phase 12 seeds Unsplash URLs which are full URLs, not R2 keys.
   - What's unclear: should `hotel_photos` store `url` (full URL, simpler for seed) or `key` (R2 pattern, requires seed to use a different column)?
   - Recommendation: Use `url` column for now (Phase 12 is Unsplash-backed). Phase 13 will decide the R2 integration pattern for hotel photos. Document the technical debt.

3. **`photo` derivation for `room-types` endpoint when no rooms have photos**
   - What we know: Most room types will have at least one room with photos (Phase 2 photo upload is implemented).
   - What's unclear: What does the response look like when `photos: []`? Does `RoomsSection` gracefully handle a missing thumbnail?
   - Recommendation: Return `photos: []` from API. `RoomsSection` renders a `bg-warm-cream` placeholder div when `room.photos.length === 0`. Update the component.

---

## Sources

### Primary (HIGH confidence — direct code read)

- `apps/api/src/app.module.ts` — confirmed NO global APP_GUARD for JwtAuthGuard
- `apps/api/src/main.ts` — confirmed global prefix `/api`, no CORS for public issue
- `apps/api/src/modules/public-booking/public-booking.controller.ts` — proven public endpoint pattern (no guards, no CSRF for GET)
- `apps/api/src/modules/public-booking/public-booking.module.ts` — module structure for public routes
- `apps/api/src/system-config/system-config.controller.ts` — route `GET /api/system-config/public` confirmed public, no collision
- `apps/api/src/system-config/system-config.service.ts` — SystemConfig query patterns + Decimal Number conversion
- `apps/api/prisma/schema.prisma` lines 1-250 — all existing columns for SystemConfig, RoomType, Room, RoomPhoto
- `apps/api/src/modules/inventory/inventory.repository.ts` — ROOM_TYPE_SELECT constant, photos join pattern
- `apps/api/src/modules/inventory/photos/photos.service.ts` — R2 key-based URL derivation pattern
- `apps/api/src/modules/inventory/dto/create-room-type.dto.ts` — class-validator pattern (auth-gated modules)
- `apps/api/src/modules/public-booking/dto/public-availability-query.dto.ts` — Zod pattern (public modules)
- `apps/web/src/features/public-portal/hooks/useHotelInfo.ts` — current sync signature confirmed
- `apps/web/src/features/public-portal/HotelHomePage.tsx` — consumer of useHotelInfo, passes photos/rooms as props
- `apps/web/src/features/public-portal/data/{hotel,roomTypes,photos}.ts` — confirmed Unsplash URLs, fallback data
- `apps/web/src/features/public-portal/types.ts` — HotelInfo, RoomTypeCard, Photo interfaces
- `apps/web/src/features/public-portal/components/{HeroGallery,HotelIdentity,RoomsSection,PortalFooter}.tsx` — prop shapes confirmed
- `apps/web/src/lib/api.ts` — 401 interceptor logic; confirmed safe for public endpoints
- `apps/web/src/features/reporting/DashboardPage.tsx` — TanStack Query useQuery pattern + inline skeleton pattern
- `apps/web/src/features/reporting/reporting.api.ts` — api.ts-based API client pattern
- `apps/web/src/router.tsx` — confirmed LegacyBookingPage NOT imported; `/` and `/booking` → HotelHomePage
- `apps/web/package.json` — confirmed @tanstack/react-query ^5.100.0, no toast library
- `.planning/config.json` — `workflow.nyquist_validation: false` → Validation Architecture section SKIPPED
- Migration files in `apps/api/prisma/migrations/` — naming convention `{timestamp}_{slug}`

### Secondary (MEDIUM confidence)

- `apps/web/src/features/public-portal/HotelHomePage.test.tsx` — existing test structure; Phase 10 tests confirmed importable
- `.planning/STATE.md` — Phase 10 decisions: "Unsplash CDN for photos in v1.1 — no local files, public/hotel-photos/.gitkeep staged for v1.2 R2"

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new deps
- Architecture: HIGH — confirmed from direct code inspection of existing patterns
- Pitfalls: HIGH — sourced from actual code + established project conventions
- Migration: HIGH — naming convention confirmed from 10 existing migration folders

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (stable domain — no fast-moving libraries)

---

## RESEARCH COMPLETE
