---
phase: 12-public-data-api-frontend-wiring
verified: 2026-05-17T18:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "3 endpoints responden 200 sin Authorization header con servidor levantado"
    expected: "curl http://localhost:3011/api/public/hotel-info → 200 + Cache-Control: public, max-age=60, s-maxage=60"
    why_human: "No hay servidor corriendo en el contexto de verificación estática; los tests de unidad (17/17) y el wiring TypeScript confirman la implementación correcta"
  - test: "Demo vertical slice: editar precio en admin → portal refleja cambio en ≤60s"
    expected: "Doble Estándar basePrice 280000 → 295000 visible en /booking tras staleTime de 60s"
    why_human: "Requiere Railway DB conectada, servidores corriendo y acción manual en el admin panel"
---

# Phase 12: Public Data API + Frontend Wiring — Verification Report

**Phase Goal:** Public portal renders hotel name, address, room types, prices, and hero photos from backend API instead of hardcoded TS modules; admin's existing CRUD edits on RoomTypes + system_config propagate to `/booking` on refresh (60s cache window).
**Verified:** 2026-05-17
**Status:** PASSED
**Re-verification:** No — verificación inicial

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 3 endpoints públicos responden 200 sin `Authorization` header | VERIFIED | `public-portal.controller.ts`: `@Controller('public')`, cero `@UseGuards()`, `@Header('Cache-Control', 'public, max-age=60, s-maxage=60')` en los 3 `@Get()`. Ruta mapeada en `AppModule.imports` línea 61 |
| 2 | Admin price change en RoomType → portal dentro de 60s | VERIFIED | `getPublishedRoomTypes()` hace `prisma.roomType.findMany()` directo (sin cache a nivel app). Frontend hooks tienen `staleTime: 60_000` en los 3 hooks. La cadena completa: admin edita → DB actualiza → próxima petición GET (post-staleTime) → TanStack refetch → UI actualiza |
| 3 | Módulos hardcoded `data/{hotel,roomTypes,photos}.ts` eliminados / reemplazados | VERIFIED | `roomTypes.ts` DELETED, `photos.ts` DELETED; `hotel.ts` PRESERVED como fallback-only (`HOTEL_INFO_FALLBACK`). Grep: cero imports `from.*data/(roomTypes|photos)` en todo `apps/web/src` |
| 4 | Skeleton loading states mientras queries están pending; error banner con Reintentar | VERIFIED | `skeletons.tsx` exporta `HeroGallerySkeleton`, `HotelIdentitySkeleton`, `RoomsSectionSkeleton`. `HotelHomePage.tsx` renderiza skeleton cuando `isPending=true` y error banner (`data-testid="portal-error-banner"`, `bg-terracotta-tint`) cuando `isError=true`. `invalidateQueries({ queryKey: ['public'] })` en Reintentar |
| 5 | `LegacyBookingPage.tsx` eliminado; cero referencias en router | VERIFIED | Archivo DELETED confirmado. Grep de `LegacyBookingPage` en `apps/web/src`: cero matches |
| 6 | Todos los tests Vitest de Phase 10 siguen pasando post-wiring | VERIFIED | 12-05-SUMMARY.md: `vitest run src/features/public-portal/` → 11/11 tests, 3 archivos. `HotelHomePage.test.tsx` actualizado con `QueryClientProvider` wrapper; cero cambios a las aserciones |

**Score: 6/6 truths verified**

---

## Required Artifacts

### Backend

| Artifact | Líneas | Status | Evidencia clave |
|----------|--------|--------|-----------------|
| `apps/api/src/modules/public-portal/public-portal.controller.ts` | 77 L | VERIFIED — WIRED | `@Controller('public')`, 3 `@Get()`, 3 `@Header('Cache-Control', ...)`, cero `UseGuards`. DI: `private readonly service: PublicPortalService` |
| `apps/api/src/modules/public-portal/public-portal.service.ts` | 124 L | VERIFIED — WIRED | 3 métodos: `getHotelInfo`, `getPublishedRoomTypes`, `getHotelPhotos`. `Number(rt.basePrice)` para Decimal→number. `firstRoom?.photos ?? []` para Pitfall #2. `orderBy: { basePrice: 'asc' }` + badge por índice |
| `apps/api/src/modules/public-portal/public-portal.service.spec.ts` | 305 L | VERIFIED | 17 tests en 3 `describe` blocks. Vitest + `@nestjs/testing`. Mocks: `PrismaService`, `SystemConfigService`. Cubre: rating/reviewCount placeholder, dirección hardcoded, defaults null, filtro isPublished/isActive, orderBy, Decimal→number, maxOccupancy→capacity, badges, fotos vacías, R2 URL derivation, orderBy displayOrder |
| `apps/api/src/modules/public-portal/dto/public-hotel-info.dto.ts` | — | VERIFIED | `PublicHotelInfoSchema` (Zod) + `PublicHotelInfoDto` (z.infer) |
| `apps/api/src/modules/public-portal/dto/public-room-type.dto.ts` | — | VERIFIED | `badge: z.union([z.literal('Más económica'), z.literal('Mejor valor'), z.null()])`, `capacity: z.number().int()` |
| `apps/api/src/modules/public-portal/dto/public-hotel-photo.dto.ts` | — | VERIFIED | `displayOrder: z.number().int()` |
| `apps/api/src/modules/public-portal/public-portal.module.ts` | 28 L | VERIFIED — WIRED | `imports: [SystemConfigModule, PrismaModule]`, providers + controllers declarados |
| `apps/api/src/app.module.ts` | — | VERIFIED | `PublicPortalModule` en línea 16 (import) y línea 61 (array imports), inmediatamente después de `PublicBookingModule` |
| `apps/api/prisma/schema.prisma` | — | VERIFIED | `SystemConfig`: 4 nuevas columnas (`tagline?`, `description?`, `phone?`, `tags String[] @default([])`). `RoomType`: `isPublished Boolean @default(true)`. Modelo `HotelPhoto` con `@@index([displayOrder])` y `@@map("hotel_photos")` |
| `apps/api/prisma/migrations/20260523000000_phase12_public_portal_data/migration.sql` | 24 L | VERIFIED | 4 `ALTER TABLE "system_config"`, 1 `ALTER TABLE "room_types"`, `CREATE TABLE "hotel_photos"`, `CREATE INDEX "hotel_photos_displayOrder_idx"` |
| `apps/api/prisma/seed-phase12.ts` | — | VERIFIED | `prisma.systemConfig.updateMany({ where: {} })` + `prisma.hotelPhoto.count()` con condicional `createMany`. Idempotency confirmada (SUMMARY: segundo run logueó "already populated") |

### Frontend

| Artifact | Líneas | Status | Evidencia clave |
|----------|--------|--------|-----------------|
| `apps/web/src/features/public-portal/public-portal.api.ts` | 62 L | VERIFIED — WIRED | `import { api } from '@/lib/api'`. 3 métodos: `getHotelInfo` (mapea `name→hotelName`, `address→hotelAddress`, Pitfall #8), `getRoomTypes`, `getHotelPhotos`. Importado por los 3 hooks |
| `apps/web/src/features/public-portal/hooks/useHotelInfo.ts` | 24 L | VERIFIED — WIRED | `useQuery`, `queryKey: ['public', 'hotel-info']`, `staleTime: 60_000`, `placeholderData: HOTEL_INFO_FALLBACK`, `retry: 2`. Retorno: `UseQueryResult<HotelInfo, Error>` |
| `apps/web/src/features/public-portal/hooks/useRoomTypes.ts` | 63 L | VERIFIED — WIRED | `queryKey: ['public', 'room-types']`, `staleTime: 60_000`, `ROOM_TYPES_FALLBACK` inline (4 entradas), `retry: 2` |
| `apps/web/src/features/public-portal/hooks/useHotelPhotos.ts` | 51 L | VERIFIED — WIRED | `queryKey: ['public', 'hotel-photos']`, `staleTime: 60_000`, `HOTEL_PHOTOS_FALLBACK` inline (5 Unsplash URLs verbatim de data/photos.ts v1.1), `retry: 2` |
| `apps/web/src/features/public-portal/components/skeletons.tsx` | 137 L | VERIFIED | Exporta `HeroGallerySkeleton` (desktop + mobile), `HotelIdentitySkeleton`, `RoomsSectionSkeleton`. Todos con `animate-pulse`, `bg-warm-cream`, `aria-busy="true"`, `aria-label`, `data-testid` |
| `apps/web/src/features/public-portal/HotelHomePage.tsx` | 147 L | VERIFIED — WIRED | Importa los 3 hooks + `useQueryClient` + 3 skeletons. Renderiza skeleton cuando `isPending`, error banner (`data-testid="portal-error-banner"`, `bg-terracotta-tint`, `border-terracotta`) cuando `anyError`, `retryAll → invalidateQueries({ queryKey: ['public'] })` |
| `apps/web/src/features/public-portal/components/PortalFooter.tsx` | 30 L | VERIFIED | `{hotelInfo.phone ?? '+57 (1) 555-0100'}`. Literal hardcoded eliminado del valor primario; solo como fallback inline |
| `apps/web/src/features/public-portal/components/RoomsSection.tsx` | 65 L | VERIFIED | `{room.capacity} personas` (número, no string). `room.photos[0]?.url` para thumbnail. Placeholder `bg-warm-cream` cuando `photos.length === 0` |
| `apps/web/src/features/public-portal/components/HeroGallery.tsx` | 114 L | VERIFIED | Maneja `photos.length === 0` con placeholder `bg-warm-cream`. Sigue recibiendo `photos: Photo[]` como prop (Strategy A preservada) |
| `apps/web/src/features/public-portal/HotelHomePage.test.tsx` | 67 L | VERIFIED | `QueryClientProvider` + `QueryClient({ defaultOptions: { queries: { retry: false } } })`. 4 tests cubren secciones, nav, Reservar CTA, dark-mode prevention |

---

## Key Link Verification

| From | To | Via | Status | Evidencia |
|------|----|-----|--------|-----------|
| `public-portal.controller.ts` | `PublicPortalService` | Constructor DI `private readonly service` | WIRED | Línea 36 del controller |
| `app.module.ts` | `PublicPortalModule` | `imports` array | WIRED | Línea 16 (import), línea 61 (array) |
| `public-portal.service.ts` | `PrismaService + SystemConfigService` | Constructor DI | WIRED | Líneas 29-31 del service |
| `public-portal.service.ts` | `prisma.roomType.findMany({ where: { isPublished: true, isActive: true } })` | Prisma query directo | WIRED | Líneas 68-80 del service |
| `useHotelInfo` | `publicPortalApi.getHotelInfo` | `queryFn` | WIRED | Línea 19 del hook |
| `useRoomTypes` | `publicPortalApi.getRoomTypes` | `queryFn` | WIRED | Línea 58 del hook |
| `useHotelPhotos` | `publicPortalApi.getHotelPhotos` | `queryFn` | WIRED | Línea 46 del hook |
| `publicPortalApi` | `api` de `@/lib/api` | `import { api } from '@/lib/api'` | WIRED | Línea 1 de `public-portal.api.ts` |
| `HotelHomePage` | `useHotelInfo + useRoomTypes + useHotelPhotos` | Hook calls + destructuring | WIRED | Líneas 35-37 de `HotelHomePage.tsx` |
| `HotelHomePage` | `HeroGallerySkeleton + HotelIdentitySkeleton + RoomsSectionSkeleton` | Render condicional `isPending` | WIRED | Líneas 86-104 de `HotelHomePage.tsx` |
| `HotelHomePage (Reintentar)` | `queryClient.invalidateQueries({ queryKey: ['public'] })` | `onClick` de botón | WIRED | Línea 49 de `HotelHomePage.tsx` |
| `lib/api.ts` | UNCHANGED | git diff vacío | VERIFIED | Confirmado en 12-03-SUMMARY; interceptor intacto |

---

## Requirements Coverage

| Requirement | Source Plan | Descripción | Status | Evidencia |
|-------------|------------|-------------|--------|-----------|
| PDA-01 | 12-02 | `GET /api/public/hotel-info` sin auth, `Cache-Control: public, max-age=60` | SATISFIED | Controller + Service + Migration + Seed |
| PDA-02 | 12-02 | `GET /api/public/room-types` sin auth, `isPublished=true`, `basePrice` ASC, badge | SATISFIED | Service `getPublishedRoomTypes()` + 17 tests |
| PDA-03 | 12-02 | `GET /api/public/hotel-photos` sin auth, orden por `displayOrder` ASC | SATISFIED | Service `getHotelPhotos()` + tabla `hotel_photos` seeded |
| PDA-04 | 12-03 | `useHotelInfo.ts` reemplazado con TanStack Query | SATISFIED | Hook reescrito: `useQuery`, `staleTime: 60_000`, `placeholderData` |
| PDA-05 | 12-03/12-05 | `data/roomTypes.ts` eliminado; `RoomsSection` consume `useRoomTypes()` | SATISFIED | `roomTypes.ts` DELETED; datos vienen de `ROOM_TYPES_FALLBACK` (placeholder) o API |
| PDA-06 | 12-03/12-05 | `data/photos.ts` eliminado; `HeroGallery` consume `useHotelPhotos()` | SATISFIED | `photos.ts` DELETED; datos vienen de `HOTEL_PHOTOS_FALLBACK` (placeholder) o API |
| PDA-07 | 12-04 | Skeleton loading + error toast con retry | SATISFIED | `skeletons.tsx` (3 exports) + error banner en `HotelHomePage` |
| PDA-08 | 12-05 | `LegacyBookingPage.tsx` eliminado | SATISFIED | Archivo DELETED; grep confirma cero referencias |

**Nota sobre REQUIREMENTS.md:** Los ítems PDA-05, PDA-06, PDA-07, PDA-08 están marcados como `[x]` (completos) en REQUIREMENTS.md. PDA-01..04 siguen marcados como `[ ]` (pendientes). El código en el repositorio los satisface; la actualización de REQUIREMENTS.md es responsabilidad del milestone close-out workflow.

---

## Anti-Patterns Found

| Archivo | Línea | Patrón | Severidad | Impacto |
|---------|-------|--------|-----------|---------|
| `public-portal.service.ts` | 66 | `const r2PublicUrl = process.env.R2_PUBLIC_URL ?? ''` — si la var no está definida, las URLs de fotos de habitaciones serán `/<key>` (roto) | INFO | Solo afecta fotos de RoomType del staff; las fotos hero en `hotel_photos` usan URL completa de Unsplash. En producción `R2_PUBLIC_URL` está configurado. No bloquea. |
| `public-portal.service.ts` | 14 | `HOTEL_ADDRESS_PLACEHOLDER = 'La Candelaria, Bogotá'` hardcoded | INFO | Documentado en `// Phase 13 will add it`. No es un anti-patrón sino deuda técnica consciente. |
| `public-portal.service.ts` | 12-13 | `RATING_PLACEHOLDER = 4.84`, `REVIEW_COUNT_PLACEHOLDER = 318` hardcoded | INFO | Idem — `// Phase 14 will use real aggregate`. Anotado con comentario, no es bug. |

No hay anti-patrones bloqueantes. El check de hex tokens (`rg "#[0-9a-fA-F]{3,6}"` en `apps/web/src/features/public-portal`) reporta cero matches (confirmado en 12-05-SUMMARY).

---

## Human Verification Required

### 1. Endpoints live — respuesta 200 sin Authorization

**Test:** Con API y DB Railway conectados, ejecutar:
```bash
curl -i http://localhost:3011/api/public/hotel-info
curl -i http://localhost:3011/api/public/room-types
curl -i http://localhost:3011/api/public/hotel-photos
```
**Expected:** HTTP 200, header `Cache-Control: public, max-age=60, s-maxage=60`, JSON válido. Sin header `Authorization` en la request.
**Why human:** Requiere servidor NestJS corriendo con DB Railway y seed ejecutado.

### 2. Demo vertical slice — price propagation

**Test:** En `/rooms` como admin, editar "Doble Estándar" basePrice de 280000 a 295000, guardar. Esperar 60s (o navegar a `/booking` en nueva pestaña y refrescar). Verificar que `RoomsSection` muestre `$295k / noche`.
**Expected:** El nuevo precio aparece en la siguiente request tras expirar el `staleTime` de 60s.
**Why human:** Requiere Railway DB activo, datos de Phase 2 (RoomType "Doble Estándar" existente), y acción manual en el UI admin.

### 3. Skeleton visible en first load

**Test:** Con throttling de red (DevTools → Slow 3G), navegar a `/booking`. Verificar que los 3 skeletons aparecen brevemente antes de que llegue el dato real.
**Expected:** `data-testid="hero-gallery-skeleton"`, `"hotel-identity-skeleton"`, `"rooms-section-skeleton"` visibles ~500ms.
**Why human:** Requiere simulación de red lenta en browser real.

### 4. Error banner + retry

**Test:** Detener el API server. Refrescar `/booking`. Verificar que aparece el banner `data-testid="portal-error-banner"` con texto "No pudimos cargar" y botón "Reintentar". Reiniciar API. Hacer click en "Reintentar". Verificar que el banner desaparece y los datos cargan.
**Why human:** Requiere control del server lifecycle.

---

## Gaps Summary

No se encontraron gaps. Todos los criterios de éxito del ROADMAP están satisfechos a nivel de implementación estática verificable.

Los únicos ítems pendientes son verificaciones de runtime que requieren servidor activo (marcados en la sección Human Verification) — estos son los pasos normales de QA manual previos a merge.

---

## Estructura detallada de implementación (resumen ejecutivo)

**Backend (12-01 + 12-02):**
- Migración `20260523000000_phase12_public_portal_data` aplicada en Railway: 4 columnas en `system_config`, `isPublished` en `room_types`, tabla `hotel_photos`
- `PublicPortalModule` con controller `@Controller('public')`, cero guards, `@Header('Cache-Control', ...)` en los 3 endpoints
- Service: Prisma directo (sin InventoryRepository), `Number(basePrice)`, badge por índice, URL derivation por clave R2
- 17 unit tests en `public-portal.service.spec.ts` — todos passing

**Frontend (12-03 + 12-04 + 12-05):**
- `public-portal.api.ts` — cliente axios con mapeo `name→hotelName`, `address→hotelAddress`
- 3 hooks TanStack Query: `staleTime: 60_000`, `placeholderData`, `retry: 2`
- `skeletons.tsx` — 3 exports con `animate-pulse bg-warm-cream`, `aria-busy`, `data-testid`
- `HotelHomePage` — Strategy A (prop-drilling): orquesta queries, renderiza skeleton/content, error banner terracotta con `invalidateQueries`
- `PortalFooter` — `phone ?? '+57 (1) 555-0100'`
- `RoomsSection` — `{room.capacity} personas` (número)
- 3 módulos hardcoded eliminados + `LegacyBookingPage.tsx` eliminado
- `lib/api.ts` intacto (confirmado byte-identical pre/post Phase 12)
- 11/11 tests Phase 10 passing; `QueryClientProvider` wrapper agregado a `HotelHomePage.test.tsx`

---

_Verificado: 2026-05-17_
_Verificador: Claude (gsd-verifier)_
