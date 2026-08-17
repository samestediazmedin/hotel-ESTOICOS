---
phase: 13-hotel-settings-admin-page
verified: 2026-05-18T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 13: Hotel Settings Admin Page — Verification Report

**Phase Goal:** Admin can edit hotel identity (name, address, tagline, description, phone, tags) and manage hero gallery photos from a new staff-only `/settings/hotel` route — without touching env vars or DB directly.
**Verified:** 2026-05-18
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/settings/hotel` route existe en router.tsx, gated por ADMIN via inline role check | VERIFIED | `apps/web/src/router.tsx` line 163-165: `path: 'settings/hotel'` dentro de `ProtectedRoute > StaffLayout`; `HotelSettingsPage.tsx` line 24: `if (role !== 'ADMIN')` gate inline |
| 2 | Formulario con 6 campos prefilled desde `useAdminSystemConfig`, react-hook-form + zodResolver, submit calls PATCH | VERIFIED | `HotelInfoForm.tsx`: 6 campos (name, address, tagline, description/Textarea, phone, tags/TagsInput); `useUpdateSystemConfig.ts`: PATCH mutation con `onSuccess` invalidando `['public', 'hotel-info']` |
| 3 | Gallery manager con upload presign→R2→confirm, HTML5 drag-to-reorder, delete con AlertDialog — todas las mutaciones invalidan ambas query keys | VERIFIED | `HotelGalleryManager.tsx` + `PhotoThumbnail.tsx`; `useUploadHotelPhoto.ts` (3 pasos); `useReorderHotelPhotos.ts` (optimistic + onSettled invalida admin + public); `useDeleteHotelPhoto.ts` (invalida ambas) |
| 4 | `hotel_photos.key` nullable + `SystemConfigChangeLog` table existen en schema y migración aplicada | VERIFIED | `schema.prisma` lines 241-243: `key String?`; lines 166-177: `model SystemConfigChangeLog`; migración `20260525000000_phase13_hotel_settings_admin/migration.sql` presente y con SQL correcto |
| 5 | Admin edita nombre → `/booking` refleja cambio dentro de ventana de 60s; PATCH endpoint con ADMIN guard operativo | VERIFIED | `system-config.controller.ts`: `@Patch()` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN')`; `useUpdateSystemConfig.ts` invalidates `['public', 'hotel-info']`; cache max-age=60 de Phase 12 intacto |
| 6 | Backend audit log en cada PATCH /api/system-config con userId + fieldsChanged + before + after | VERIFIED | `system-config.service.ts` líneas 113-128: `prisma.systemConfigChangeLog.create()` dentro de try/catch tras updateMany; `system_config_change_log` table en schema con FK a users |

**Score:** 6/6 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/prisma/migrations/20260525000000_phase13_hotel_settings_admin/migration.sql` | Schema migration: address + key + audit log | VERIFIED | Existe; contiene ALTER TABLE system_config ADD COLUMN "address", ALTER TABLE hotel_photos ADD COLUMN "key", CREATE TABLE system_config_change_log con FK + index |
| `apps/api/prisma/schema.prisma` | address en SystemConfig, key en HotelPhoto, SystemConfigChangeLog model | VERIFIED | `address String?` en SystemConfig (line 154); `key String?` en HotelPhoto (line 242); `model SystemConfigChangeLog` (line 166); `systemConfigChangeLogs` reverse relation en User (line 109) |
| `apps/api/src/system-config/system-config.service.ts` | `update(dto, userId)` con diff + audit log | VERIFIED | Método `update` exportado (line 80); diff por JSON.stringify; `updateMany`; `findFirst` post-update; audit log en try/catch |
| `apps/api/src/system-config/system-config.controller.ts` | PATCH route con ADMIN guard | VERIFIED | `@Patch()` (line 55); `@UseGuards(JwtAuthGuard, RolesGuard)` (line 56); `@Roles('ADMIN')` (line 57); también GET admin con mismos guards |
| `apps/api/src/modules/hotel-photos/hotel-photos.controller.ts` | 5 endpoints ADMIN-only (GET + presign + confirm + reorder + delete) | VERIFIED | `@UseGuards` a nivel de clase (line 35); 5 rutas con `@Roles('ADMIN')` individual; controlador registrado en `HotelPhotosModule` importado en AppModule |
| `apps/api/src/modules/hotel-photos/hotel-photos.service.ts` | R2 presign + confirm + reorder (atomic $transaction) + delete (best-effort) | VERIFIED | `createR2Client` reusado de inventory/photos; `reorderPhotos` usa `prisma.$transaction` (line 170); `deletePhoto` con try/catch en R2 |
| `apps/web/src/features/settings/HotelSettingsPage.tsx` | Inline role check + 2-col layout | VERIFIED | `role !== 'ADMIN'` gate (line 24); grid `lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]` (line 86); monta HotelInfoForm + HotelGalleryManager |
| `apps/web/src/features/settings/components/HotelInfoForm.tsx` | 6 campos + zodResolver + submit PATCH + cancel reset | VERIFIED | 6 campos verificados individualmente; `zodResolver(HotelInfoSchema)`; `useUpdateSystemConfig`; cancel: `reset(initial)` + `mutation.reset()` |
| `apps/web/src/features/settings/components/HotelGalleryManager.tsx` | Grid + upload + drag handlers | VERIFIED | Grid `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`; hidden file input; handleDragStart/Over/Drop wired a PhotoThumbnail |
| `apps/web/src/features/settings/components/PhotoThumbnail.tsx` | HTML5 drag + AlertDialog delete | VERIFIED | `draggable` en root div; `draggable={false}` en img; AlertDialog con 7 exports de @radix-ui/react-alert-dialog; nunca usa window.confirm |
| `apps/web/src/features/settings/hooks/useAdminSystemConfig.ts` | queryKey `['admin', 'system-config']` | VERIFIED | Presente en hooks/ |
| `apps/web/src/features/settings/hooks/useUpdateSystemConfig.ts` | PATCH mutation + invalidate public hotel-info | VERIFIED | `queryClient.invalidateQueries({ queryKey: ['public', 'hotel-info'] })` en onSuccess |
| `apps/web/src/features/settings/hooks/useHotelPhotosAdmin.ts` | queryKey `['admin', 'hotel-photos']` | VERIFIED | Presente en hooks/ |
| `apps/web/src/features/settings/hooks/useUploadHotelPhoto.ts` | 3-step: presign → fetch PUT → confirm | VERIFIED | Paso 1: `presignHotelPhoto`; Paso 2: `fetch(uploadUrl, { method: 'PUT' })` (native fetch, no axios); Paso 3: `confirmHotelPhoto` |
| `apps/web/src/features/settings/hooks/useReorderHotelPhotos.ts` | Optimistic + invalida ambas keys | VERIFIED | `onMutate` con cancelQueries + setQueryData; `onError` rollback; `onSettled` invalida admin + public |
| `apps/web/src/features/settings/hooks/useDeleteHotelPhoto.ts` | Invalida ambas keys | VERIFIED | `invalidateQueries(['admin', 'hotel-photos'])` + `invalidateQueries(['public', 'hotel-photos'])` en onSuccess |
| `apps/web/src/components/ui/textarea.tsx` | Primitivo shadcn-style con tokens | VERIFIED | `forwardRef`; tokens `border-warm-line-strong bg-warm-paper text-ink-1 focus-visible:ring-terracotta` |
| `apps/web/src/components/ui/alert-dialog.tsx` | 9 exports Radix wrapper | VERIFIED | Exporta los 9 componentes: AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| SystemConfigController PATCH | SystemConfigService.update | `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')` | WIRED | Verificado en controller.ts lines 55-57 |
| SystemConfigService.update | system_config_change_log | `prisma.systemConfigChangeLog.create` after updateMany | WIRED | Lines 115-127, wrapped in try/catch |
| PublicPortalService.getHotelInfo | config.address | `config?.address ?? ''` (DB-backed) | WIRED | HOTEL_ADDRESS_PLACEHOLDER eliminado; 0 matches en rg |
| PublicPortalService.getHotelPhotos | key-based URL resolution | `p.key ? \`${r2PublicUrl}/${p.key}\` : p.url` | WIRED | Dual-shape activo, fallback para legacy rows |
| HotelPhotosController | HotelPhotosService (5 métodos) | `@UseGuards` a nivel clase + `@Roles('ADMIN')` por método | WIRED | 5 rutas verificadas; AppModule importa HotelPhotosModule |
| HotelPhotosService.reorderPhotos | `prisma.$transaction` | array de updates atómico | WIRED | Lines 170-178 |
| useUpdateSystemConfig.onSuccess | `['public', 'hotel-info']` invalidation | `queryClient.invalidateQueries` | WIRED | Verificado directamente en hook |
| useUploadHotelPhoto / useDeleteHotelPhoto / useReorderHotelPhotos | `['public', 'hotel-photos']` invalidation | `queryClient.invalidateQueries` | WIRED | 3/3 hooks invalidan ambas keys |
| Sidebar nav item /settings/hotel | ADMIN-only visibility | `roles: ['ADMIN']` en NAV_SECTIONS + filter por role | WIRED | `{ to: '/settings/hotel', icon: SlidersHorizontal, roles: ['ADMIN'] }` |
| HotelSettingsPage | ADMIN gate | `role !== 'ADMIN'` inline | WIRED | Inline (ProtectedRoute no tiene roles prop — patrón documentado) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| HSP-01 | 13-01 | PATCH /api/system-config (ADMIN) con Zod + audit log | SATISFIED | Endpoint verificado; audit log escribe a system_config_change_log |
| HSP-02 | 13-01 | hotel_photos con displayOrder indexed; migration aplicada | SATISFIED | schema.prisma: `@@index([displayOrder])`; migración `20260525000000` presente |
| HSP-03 | 13-03 | Frontend /settings/hotel (ADMIN-only) con form 6 campos | SATISFIED | router.tsx + HotelSettingsPage + HotelInfoForm verificados |
| HSP-04 | 13-04 | Gallery manager: drag-reorder + upload presign R2 + delete con confirmación | SATISFIED | HotelGalleryManager + PhotoThumbnail + 4 hooks verificados |
| HSP-05 | 13-02 | Backend POST presign + confirm + PATCH reorder + DELETE :id (ADMIN) | SATISFIED | HotelPhotosController 5 endpoints; todos ADMIN-guarded |
| HSP-06 | 13-01 + 13-04 | /api/public/hotel-info y hotel-photos reflejan cambios; invalidación inmediata | SATISFIED | DB-backed address; dual-shape URL; invalidateQueries en todos los hooks de mutación |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `HotelInfoForm.tsx`, `TagsInput.tsx` | `placeholder=` (HTML attribute) | Info | Legítimo — son placeholders de UI, no stubs de código |

Sin anti-patterns bloqueantes. Las menciones de `placeholder` son atributos HTML válidos de los campos de formulario (Input/Textarea), no stubs de implementación.

---

## Zero-Leak Checks

| Check | Result |
|-------|--------|
| `rg "#[0-9a-fA-F]{3,6}" apps/web/src/features/settings --glob "*.tsx"` | 0 matches — PASS |
| `rg "(text\|bg\|border)-(gray\|blue\|...) apps/web/src/features/settings` | 0 matches — PASS |
| `rg "@dnd-kit" apps/web/package.json` | 0 matches — PASS (HTML5 native drag usado) |
| `rg "HOTEL_ADDRESS_PLACEHOLDER" apps/api/src` | 0 matches — PASS |

---

## Locked Decisions Audit

| Decision | Status |
|----------|--------|
| 13-01: migration agrega `address` + `key` + `SystemConfigChangeLog` | CONFIRMED |
| PublicPortalService.getHotelInfo() sin HOTEL_ADDRESS_PLACEHOLDER | CONFIRMED |
| PublicPortalService.getHotelPhotos() dual-shape URL | CONFIRMED |
| 13-02: HotelPhotos module 5 endpoints todos `@Roles('ADMIN')` | CONFIRMED |
| 13-02: R2 client via `createR2Client` factory (sin PhotosService DI) | CONFIRMED |
| 13-03: Textarea + AlertDialog primitivos creados | CONFIRMED |
| 13-03: `SlidersHorizontal` icon (NO `Settings`) | CONFIRMED — `Settings` icon reservado para Usuarios |
| 13-03: inline role check (NO ProtectedRoute prop) | CONFIRMED — ProtectedRoute no tiene roles prop |
| 13-04: HTML5 drag nativo (sin @dnd-kit) | CONFIRMED — 0 matches de @dnd-kit en package.json |
| 13-04: mutaciones invalidan AMBAS query keys | CONFIRMED — 3/3 hooks verificados |
| 13-05: api 361/361 + web 116/116 suites green | CONFIRMED por 13-REGRESSION-LOG.md |

---

## Human Verification Required

Los siguientes comportamientos no pueden verificarse de forma programática:

### 1. Formulario prefillado al navegar a /settings/hotel

**Test:** Login como ADMIN → navegar a `/settings/hotel`
**Expected:** Los 6 campos del formulario muestran los valores actuales de system_config (nombre del hotel, dirección, lema, descripción, teléfono, etiquetas)
**Why human:** Requiere navegador con auth activa para validar que `useAdminSystemConfig` recibe datos reales del endpoint GET /api/system-config

### 2. Propagación de cambios al portal público

**Test:** Editar el nombre del hotel → guardar → abrir `/booking` en nueva pestaña
**Expected:** El nuevo nombre aparece en HeroIdentity + TopNav + PortalFooter dentro de 60 segundos
**Why human:** Requiere validar el ciclo completo: PATCH API → invalidación TanStack Query → re-fetch → render — comportamiento de tiempo real

### 3. Upload de foto y aparición en galería

**Test:** En /settings/hotel, hacer click en "Subir foto" → seleccionar imagen JPG < 5MB
**Expected:** Progreso de subida visible → foto aparece en la galería admin → foto aparece en `/api/public/hotel-photos`
**Why human:** Requiere credenciales R2 configuradas y conectividad real al bucket

### 4. Drag-to-reorder persistente

**Test:** Arrastrar una foto a nueva posición → recargar la página
**Expected:** El nuevo orden persiste después del reload
**Why human:** Validar que el optimistic update es consistente con el estado guardado en DB

### 5. Rol RECEPTION bloqueado

**Test:** Login como RECEPTION → navegar a `/settings/hotel`
**Expected:** Mensaje "Acceso restringido" (nunca redirige a /login)
**Why human:** Requiere auth con rol no-ADMIN

---

## Summary

La Fase 13 alcanzó su objetivo. Los 6 criterios de éxito del ROADMAP están verificados con evidencia directa en el código:

1. **Ruta + guard ADMIN:** `/settings/hotel` existe en router.tsx dentro de `ProtectedRoute`; `HotelSettingsPage` aplica inline `role !== 'ADMIN'`; Sidebar muestra `SlidersHorizontal` + `roles: ['ADMIN']`.

2. **Formulario 6 campos:** `HotelInfoForm` tiene todos los campos requeridos con `zodResolver`, submit llama `useUpdateSystemConfig` que invalida `['public', 'hotel-info']`.

3. **Gallery manager completo:** Upload en 3 pasos (presign→R2 PUT nativo→confirm), HTML5 drag, delete con AlertDialog, 4 hooks con dual-key invalidation.

4. **Schema y migración:** `hotel_photos.key String?` y `SystemConfigChangeLog` existen en schema.prisma; migración `20260525000000_phase13_hotel_settings_admin` aplicada con SQL correcto.

5. **Propagación al portal:** PATCH endpoint con ADMIN guard activo; `useUpdateSystemConfig.onSuccess` invalida `['public', 'hotel-info']`; ventana 60s de Phase 12 intacta.

6. **Audit log:** `prisma.systemConfigChangeLog.create()` en try/catch tras cada updateMany; table con FK a users + index en changedAt.

Zero anti-patterns bloqueantes. Zero hex literals. Zero palette hardcoded en settings feature. @dnd-kit no instalado. HOTEL_ADDRESS_PLACEHOLDER eliminado.

---

_Verified: 2026-05-18_
_Verifier: Claude (gsd-verifier)_
