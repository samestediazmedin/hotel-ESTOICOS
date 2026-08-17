# Phase 13: Hotel Settings Admin Page — Research

**Researched:** 2026-05-18
**Domain:** NestJS admin CRUD extension + Cloudflare R2 presigned upload + React admin form with gallery management
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Module placement:** Extend existing `apps/api/src/system-config/` module — DON'T create a new module.

**Backend endpoints (5 total):**
1. `PATCH /api/system-config` — extend `SystemConfigController` with `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN')`
2. `POST /api/admin/hotel-photos/presign` — new `HotelPhotosController`
3. `POST /api/admin/hotel-photos` — confirm after R2 upload
4. `PATCH /api/admin/hotel-photos/reorder` — ordinal-based reindex in single transaction
5. `DELETE /api/admin/hotel-photos/:id` — delete row + best-effort R2 delete

**Audit log:** Check if generic `AuditLog` model exists. If not, add `system_config_change_log` table.

**Frontend route:** `/settings/hotel` wrapped in `<ProtectedRoute>` (existing component), ADMIN role only.

**Frontend component:** `apps/web/src/features/settings/HotelSettingsPage.tsx`

**Form fields:** `name` (required, 2-100), `address` (required, 5-200), `tagline` (opt, max 120), `description` (opt, max 2000), `phone` (opt, E.164-ish), `tags` (opt, max 8, 2-40 each)

**Gallery drag-to-reorder:** HTML5 native drag — no @dnd-kit (deferred v1.3)

**After save:** toast + invalidate `['public', 'hotel-info']` query

**Sidebar:** Add "Configuración" under ADMINISTRACIÓN section, `@Roles('ADMIN')` only, lucide `Settings` icon, route `/settings/hotel`

### Claude's Discretion
- Whether `tags` UI uses `<TagsInput>` custom or comma-separated input (recommend custom)
- Whether `@dnd-kit` vs HTML5 drag (locked to HTML5 for v1.2)
- Whether `system_config_change_log` is a new table or reuses generic AuditLog (researcher confirms: new table, no generic AuditLog exists)
- Exact lucide-react icon choices for actions

### Deferred Ideas (OUT OF SCOPE)
- Reviews moderation page — Phase 14
- Multi-language settings (ES/EN copy editing) — v1.3
- Hotel logo upload + color theme override — v1.3
- Booking engine configuration (min stay, cancellation policy) — v1.3
- Rich text description editor (TipTap, Lexical) — v1.3
- Photo cropping / resizing tools — v1.3
- Audit log viewer UI — v1.3
- Bulk photo upload — v1.3
- Soft delete vs hard delete on photos — v1.2 uses hard delete
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HSP-01 | `PATCH /api/system-config` (ADMIN only) accepts partial `{name, address, tagline, description, phone, tags}` with Zod validation + audit log | `SystemConfigService.getConfig()` is the read pattern; add `update(dto)` using `updateMany({where:{}, data:dto})` + write to new `system_config_change_log` table after update |
| HSP-02 | `hotel_photos` schema with `{id, url, alt, displayOrder, uploadedAt}`. Migration adds + indexes `displayOrder`. | `HotelPhoto` model already exists in schema.prisma (Phase 12). Needs `key` column added (nullable) for Phase 13 R2 uploads. `displayOrder` index already present. |
| HSP-03 | Frontend `/settings/hotel` (ADMIN only), form 6 fields, react-hook-form + zod, `PATCH /api/system-config` | Greenfield feature. `RoomTypeDrawer.tsx` is the exact pattern to follow. `ProtectedRoute` has no role-prop support — use inline role check (see finding #10). |
| HSP-04 | Gallery manager: drag-to-reorder, upload via presign flow, delete with confirmation | HTML5 drag pattern documented. `PhotosService` presign/confirm pattern is the exact model. `AlertDialog` not installed — must create primitive. |
| HSP-05 | `POST /api/admin/hotel-photos`, `PATCH /api/admin/hotel-photos/reorder`, `DELETE /api/admin/hotel-photos/:id` (ADMIN role, presigned R2) | New `HotelPhotosModule` needed. R2 logic: duplicate from `PhotosService` (small enough, no cross-module DI coupling). Key pattern: `hotel-photos/<timestamp>-<filename>`. |
| HSP-06 | `/api/public/hotel-info` and `/api/public/hotel-photos` reflect admin edits after save | `PublicPortalService.getHotelInfo()` reads directly from `SystemConfigService.getConfig()` (no app-level cache). `getHotelPhotos()` reads from `hotel_photos` table directly. Invalidate `['public', 'hotel-info']` and `['public', 'hotel-photos']` on frontend after save. |
</phase_requirements>

---

## Summary

Phase 13 adds the admin-facing edit layer for the data that Phase 12 exposed publicly. The backend work is a targeted extension: add `update()` to `SystemConfigService`, add a new `HotelPhotosModule` (controller + service + DTOs) that duplicates the R2 presign/confirm pattern from `InventoryModule/PhotosService`, and add a `system_config_change_log` migration (no generic AuditLog model exists in the schema — confirmed by reading `schema.prisma` in full). The frontend work is a greenfield `features/settings/` folder with a full-page form and gallery manager component.

Two schema changes are required: (1) add `key String?` column to `hotel_photos` table so Phase 13 uploads can store R2 keys (Phase 12 seeded `url` only — old rows keep their URL, new rows use key-derived URL), and (2) create the `system_config_change_log` table. Both go in a single migration.

The `ProtectedRoute` component does NOT accept a `roles` prop — it is a generic auth gate. Role gating for `/settings/hotel` must be done inside `HotelSettingsPage` itself (redirect to `/dashboard` if `user.role !== 'ADMIN'`). This is the existing pattern used by the sidebar's `roles` filter and is safe.

**Primary recommendation:** Duplicate the R2 presign logic from `PhotosService` into the new `HotelPhotosService` (do not attempt cross-module DI sharing — `PhotosService` depends on `InventoryRepository` which is inventory-scoped). All other patterns are direct copies of existing code with minimal adaptation.

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `@nestjs/core` | 11.x | NestJS controller/service/module | `package.json` in api |
| `@aws-sdk/client-s3` | 3.726.1 (pinned) | R2 presigned PUT + DELETE | Already in `PhotosService` |
| `@aws-sdk/s3-request-presigner` | 3.726.1 (pinned) | `getSignedUrl()` | Already in `PhotosService` |
| `prisma` / `@prisma/client` | 7.x | DB + migration | Already in schema |
| `zod` | 4.x | DTO validation (backend pipes) | Already in `package.json` |
| `react-hook-form` | 7.55.x | Form state management | Already in `apps/web/package.json` |
| `@hookform/resolvers` | 3.x | `zodResolver` | Already in `apps/web/package.json` |
| `@tanstack/react-query` | 5.100.x | Server state + invalidation | Already in `apps/web/package.json` |
| `lucide-react` | 0.525.x | Icons (Settings, GripVertical, X, Upload) | Already in `apps/web/package.json` |
| `axios` | 1.7.x | HTTP client via `api` instance | Already in `apps/web/package.json` |

### NOT installed — must create

| Component | Approach | Rationale |
|-----------|----------|-----------|
| `<Textarea>` primitive | Hand-roll or `npx shadcn@latest add textarea` | Not in `apps/web/src/components/ui/`. `RoomTypeDrawer` uses inline `<textarea>` with manual className — both approaches work. Recommended: create `textarea.tsx` matching the existing `input.tsx` token pattern for consistency. |
| `<AlertDialog>` primitive | `npx shadcn@latest add alert-dialog` (installs `@radix-ui/react-alert-dialog`) | Not installed. Needed for delete confirmation. Radix primitives are already in use (@radix-ui/react-slot in package.json). |
| `@dnd-kit` | DO NOT install | CONTEXT.md locks HTML5 native drag for v1.2. |

### Alternatives Considered

| Instead of | Could Use | Why Not in v1.2 |
|------------|-----------|-----------------|
| HTML5 drag-drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Not installed, deferred to v1.3 |
| New `HotelPhotosService` (duplicated R2 logic) | Shared `R2Service` injectable across modules | Premature abstraction; only 2 consumers exist (PhotosService + HotelPhotosService). Duplicate is fine at this scale. |
| `system_config_change_log` new table | Generic `AuditLog` model | No generic AuditLog exists in schema.prisma (confirmed). Domain-specific table is cleaner per Phase 7/8 audit log pattern. |

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
apps/api/src/
├── system-config/
│   ├── system-config.controller.ts       MODIFY — add PATCH endpoint
│   ├── system-config.service.ts          MODIFY — add update() method
│   └── system-config.module.ts           MODIFY — add ConfigModule import for env vars
├── modules/
│   └── hotel-photos/                     NEW MODULE
│       ├── hotel-photos.controller.ts    presign + confirm + reorder + delete
│       ├── hotel-photos.service.ts       R2 + Prisma operations
│       ├── hotel-photos.module.ts        ConfigModule import
│       └── dto/
│           ├── presign-hotel-photo.dto.ts
│           ├── confirm-hotel-photo.dto.ts
│           └── reorder-hotel-photos.dto.ts
├── prisma/
│   └── migrations/
│       └── YYYYMMDDHHMMSS_phase13_hotel_settings/
│           └── migration.sql             ADD key column + system_config_change_log

apps/web/src/features/settings/           NEW FOLDER (greenfield)
├── HotelSettingsPage.tsx
├── hotel-settings.api.ts
├── hooks/
│   ├── useAdminSystemConfig.ts
│   ├── useUpdateSystemConfig.ts
│   ├── useAdminHotelPhotos.ts
│   ├── useUploadHotelPhoto.ts
│   ├── useDeleteHotelPhoto.ts
│   └── useReorderHotelPhotos.ts
└── components/
    ├── HotelInfoForm.tsx
    ├── HotelGalleryManager.tsx
    ├── TagsInput.tsx
    └── PhotoThumbnail.tsx

apps/web/src/components/ui/
├── textarea.tsx                           NEW — shadcn-style primitive
└── alert-dialog.tsx                       NEW — shadcn via Radix (needs @radix-ui/react-alert-dialog)
```

### Pattern 1: SystemConfig single-row UPDATE

**What:** `system_config` has exactly one row. Prisma's `update()` requires a unique `where` filter. For single-row tables, `updateMany({where: {}, data: dto})` is the canonical pattern.

**When to use:** Any service method that mutates the single `system_config` row.

**Example:**
```typescript
// apps/api/src/system-config/system-config.service.ts
async update(dto: UpdateSystemConfigDto): Promise<SystemConfig> {
  // Step 1: capture current state for audit
  const current = await this.prisma.systemConfig.findFirst();
  if (!current) throw new NotFoundException('SystemConfig not initialized');

  // Step 2: determine which fields are actually changing
  const fieldsChanged = (Object.keys(dto) as Array<keyof UpdateSystemConfigDto>)
    .filter(k => dto[k] !== undefined && dto[k] !== (current as any)[k]);

  // Step 3: apply the update
  await this.prisma.systemConfig.updateMany({ where: {}, data: dto });

  // Step 4: fetch updated row to return
  const updated = await this.prisma.systemConfig.findFirst();

  // Step 5: write audit log AFTER update (informational — not in transaction)
  if (fieldsChanged.length > 0) {
    await this.writeAuditLog(userId, fieldsChanged, current, updated!);
  }

  return updated!;
}
```

**Key insight:** Do NOT use `this.prisma.systemConfig.update({ where: { id: current.id }, ... })` — the controller doesn't receive the row ID. `updateMany({where: {}, data: ...})` is semantically correct for a single-row config table and requires no WHERE clause predicate beyond an empty object.

### Pattern 2: R2 presign for HotelPhotos (exact copy from PhotosService)

**What:** Duplicate the R2 initialization block and presign logic from `PhotosService` into the new `HotelPhotosService`. Use the same key pattern adapted for hotel photos.

**Key pattern for hotel photos:** `hotel-photos/<timestamp>-<sanitized-filename>`

**Critical:** The `r2.client.ts` factory at `apps/api/src/modules/inventory/photos/r2.client.ts` exports `createR2Client()`. Import it directly — don't duplicate the S3Client configuration.

```typescript
// apps/api/src/modules/hotel-photos/hotel-photos.service.ts
import { createR2Client } from '../inventory/photos/r2.client';

// Constructor: same 5 env var assertions as PhotosService
// presignUpload: same PutObjectCommand + getSignedUrl pattern
// Key: `hotel-photos/${Date.now()}-${sanitizedFilename}`
// Size limit: 5MB (stricter than room photos' 10MB — gallery UX constraint)
```

### Pattern 3: Confirm flow with `key` vs `url` dual-column handling

**What:** Phase 12 seeded `hotel_photos.url` directly (Unsplash URLs). Phase 13 adds `key` column (nullable). The `getHotelPhotos()` service method must handle both shapes.

**Migration SQL (safe additive):**
```sql
ALTER TABLE "hotel_photos" ADD COLUMN "key" TEXT;
```

**Service read logic:**
```typescript
// In PublicPortalService.getHotelPhotos() — MODIFY to add key resolution
return photos.map(p => ({
  url: p.key ? `${this.r2PublicUrl}/${p.key}` : p.url,  // key-based wins
  alt: p.alt,
  displayOrder: p.displayOrder,
}));
```

**Note:** `PublicPortalService` currently reads `p.url` directly (line 118 of `public-portal.service.ts`). Phase 13 must update this method to handle the dual shape.

### Pattern 4: Reorder via ordinal update in transaction

**What:** The PATCH reorder endpoint receives `{ photoIds: string[] }` and updates `displayOrder` for each entry.

```typescript
async reorderPhotos(photoIds: string[]): Promise<void> {
  await this.prisma.$transaction(
    photoIds.map((id, index) =>
      this.prisma.hotelPhoto.update({
        where: { id },
        data: { displayOrder: index },
      })
    )
  );
}
```

**Important:** Prisma `$transaction` with an array of operations runs them in a single DB transaction. This is the same pattern as Phase 2's RateRule ordering.

### Pattern 5: Frontend ProtectedRoute + Role gate

**What:** `ProtectedRoute` in `router.tsx` does NOT accept a `roles` prop. It only checks `accessToken !== null`. Role gating must happen inside the page component.

**Confirmed from `router.tsx` lines 23-36:** `ProtectedRoute` reads only `isRestoring` and `accessToken` from the auth store. No `roles` prop exists.

**Recommended approach for `/settings/hotel`:**
```tsx
// HotelSettingsPage.tsx — top of component
const user = useAuthStore(s => s.user);
if (user && user.role !== 'ADMIN') {
  return <Navigate to="/dashboard" replace />;
}
```

This matches how the Sidebar handles role-based item visibility: it reads `user.role` from the Zustand store directly.

### Pattern 6: TanStack Query invalidation after admin save

**What:** After a successful `PATCH /api/system-config`, invalidate both admin and public query keys so the portal reflects the change within the 60s cache window.

```typescript
// useUpdateSystemConfig.ts
const queryClient = useQueryClient();
mutate(payload, {
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'system-config'] });
    queryClient.invalidateQueries({ queryKey: ['public', 'hotel-info'] }); // makes portal refresh
  }
});
```

**Confirmed query keys from Phase 12:**
- Public hotel info: `['public', 'hotel-info']` (from `useHotelInfo.ts` line 18)
- Public photos: `['public', 'hotel-photos']` (from `useHotelPhotos.ts`)
- Admin system config: `['admin', 'system-config']` (new key — not yet used)
- Admin hotel photos: `['admin', 'hotel-photos']` (new key — not yet used)

### Pattern 7: HTML5 drag-to-reorder for photo grid

**What:** Native HTML5 drag-and-drop for reordering up to 10 photos. Zero new dependencies.

```tsx
// PhotoThumbnail.tsx
function PhotoThumbnail({ photo, index, onDragStart, onDrop }) {
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', String(index)); onDragStart(index); }}
      onDragOver={e => e.preventDefault()}  // REQUIRED to allow drop
      onDrop={e => { e.preventDefault(); onDrop(index); }}
      className="relative aspect-video ..."
    >
      ...
    </div>
  );
}

// HotelGalleryManager.tsx — parent state
const [dragFrom, setDragFrom] = useState<number | null>(null);

const handleDrop = (dropIndex: number) => {
  if (dragFrom === null || dragFrom === dropIndex) return;
  const newOrder = [...photos];
  const [moved] = newOrder.splice(dragFrom, 1);
  newOrder.splice(dropIndex, 0, moved);
  setPhotos(newOrder);                          // optimistic UI update
  reorderMutation.mutate({ photoIds: newOrder.map(p => p.id) });  // PATCH API call
};
```

**Pitfall:** `onDragOver` must call `e.preventDefault()` — otherwise `onDrop` never fires (browser default is to reject drops).

### Pattern 8: Sidebar nav item addition

**What:** The `NAV_SECTIONS` array in `Sidebar.tsx` is a constant array of `NavSection[]` (lines 41-68). Adding a nav item requires adding an entry to the `ADMINISTRACIÓN` section's `items` array.

**Confirmed existing pattern from lines 59-67:**
```typescript
{ to: '/users', label: 'Usuarios', icon: Settings, roles: ['ADMIN'] },
{ to: '/admin/concierge/venues', label: 'Concierge', icon: Compass, roles: ['ADMIN'] },
```

**Addition (ADMINISTRACIÓN section, after 'Usuarios'):**
```typescript
{ to: '/settings/hotel', label: 'Configuración', icon: Settings, roles: ['ADMIN'] },
```

**Note:** `Settings` icon from lucide-react is already imported at line 10 of `Sidebar.tsx`. No additional import needed. Choose a different icon if visual differentiation from "Usuarios" is desired — both currently use `Settings`. Consider `SlidersHorizontal` or `Building2` for the hotel settings entry.

### Anti-Patterns to Avoid

- **Storing full R2 URL in `hotel_photos.url` for new uploads:** The `RoomPhoto` model explicitly avoids this (comment on line 207 of schema.prisma: `// NO url field — URL is derived at read time`). Phase 13 must follow the same convention — store `key`, derive URL at read time.
- **Cross-module DI for PhotosService:** `PhotosService` depends on `InventoryRepository` which knows about `Room` entities. Do not inject `PhotosService` into `HotelPhotosModule`. Duplicate the R2 client setup (~40 lines) instead.
- **Using `prisma.systemConfig.update({ where: { id: ... } })`:** The controller doesn't receive the row ID. `updateMany({where: {}, data: dto})` is the correct pattern for single-row config tables.
- **Audit log inside Prisma transaction:** The CONTEXT.md originally suggested "synchronous in same transaction" — but the audit log pattern from Phase 7/8 (AuditLogRepository, ConciergeMessageLog) always writes OUTSIDE the main operation with try/catch that never throws. Follow this established pattern: write audit log after the update, in a separate non-transactional write, with try/catch that logs but does not rethrow.
- **AlertDialog without Radix:** Phase 9 installed `@radix-ui/react-slot` but NOT `@radix-ui/react-alert-dialog`. Adding `alert-dialog.tsx` requires either installing the Radix primitive or hand-rolling a modal. The shadcn `npx shadcn@latest add alert-dialog` command installs the dep and creates the component.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| R2 presigned URL generation | Custom fetch to Cloudflare API | `@aws-sdk/client-s3` + `getSignedUrl` (already installed, pinned to 3.726.1) | CORS, signature v4, expiry, error handling all handled by the SDK |
| Form validation with server error mapping | Custom validation state | `react-hook-form` + `zodResolver` (already installed) | Already used in `RoomTypeDrawer` — copy the pattern |
| Confirmation dialog | `window.confirm()` | shadcn `<AlertDialog>` via `@radix-ui/react-alert-dialog` | `window.confirm()` blocks the UI thread, not accessible, looks out of place |
| Tag chip array management | Manual string parsing | Custom `<TagsInput>` component (trivial ~50 lines) | Array-to-input round-trip is error-prone; a proper chip component handles paste, backspace-delete, duplicate prevention |
| Query invalidation cross-component | Global event emitter / Redux action | `queryClient.invalidateQueries()` (TanStack Query) | Already installed and used throughout the app |

**Key insight:** The entire R2 upload flow (presign → direct PUT to R2 → confirm to API) is already proven in Phase 2 room photos. The only new code is adapting the key prefix (`hotel-photos/` instead of `rooms/<id>/`) and removing the room existence check.

---

## Common Pitfalls

### Pitfall 1: HotelPhoto `key` column migration — dual-shape URL resolution

**What goes wrong:** After adding `key String?` to `HotelPhoto`, the existing seeded rows have `key = null`. If `PublicPortalService.getHotelPhotos()` unconditionally tries `${R2_PUBLIC_URL}/${p.key}`, those rows return broken URLs like `https://pub.r2.dev/null`.

**Why it happens:** Phase 12 seeded `hotel_photos` with Unsplash URLs stored directly in the `url` column. The `key` column did not exist then.

**How to avoid:** Update `PublicPortalService.getHotelPhotos()` to use: `p.key ? \`${r2PublicUrl}/${p.key}\` : p.url`. Also update `HotelPhotosService.getAll()` to use the same dual-shape logic.

**Warning signs:** Hero gallery shows broken images in the public portal after migration.

### Pitfall 2: `updateMany` returns count, not the updated row

**What goes wrong:** `prisma.systemConfig.updateMany({where: {}, data: dto})` returns `{ count: number }`, not the updated record.

**Why it happens:** Prisma's `updateMany` batch semantics — returns affected count, not records.

**How to avoid:** After the `updateMany`, call `prisma.systemConfig.findFirst()` to fetch and return the updated row. Pattern already used by `SystemConfigService.advanceBusinessDate()` lines 44-47.

### Pitfall 3: `tags` field is `String[]` (PostgreSQL array) — Zod and class-validator differ

**What goes wrong:** The existing DTOs in this project use `class-validator`. The `tags` field is a `String[]`. If you use `@IsArray() @IsString({ each: true })`, it works for arrays but does not enforce max-8 or individual max-40-chars. Zod handles these naturally with `.array().max(8).element(z.string().max(40))`.

**How to avoid:** The CONTEXT.md locks Zod for this endpoint (consistent with Phase 12's `PublicPortalModule` which uses Zod DTOs). Use:
```typescript
const UpdateSystemConfigSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  address: z.string().min(5).max(200).optional(),
  tagline: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  phone: z.string().regex(/^\+?[\d\s()-]{7,20}$/).optional().nullable(),
  tags: z.array(z.string().min(2).max(40)).max(8).optional(),
});
```

**Note:** The existing `SystemConfigController` uses NO validation pipes — just returns data. Phase 13 must add `@UsePipes(new ZodValidationPipe(UpdateSystemConfigSchema))` or parse the body manually in the service.

### Pitfall 4: R2 browser PUT requires correct CORS on the bucket

**What goes wrong:** The presigned PUT URL works from Postman/curl but the browser's `fetch()` for the direct upload to R2 fails with a CORS error.

**Why it happens:** Browsers enforce CORS for cross-origin requests. R2 needs an explicit CORS rule allowing `PUT` from the app's domain.

**How to avoid:** Confirm in the Cloudflare R2 dashboard that a CORS rule exists:
```json
[{
  "AllowedOrigins": ["*"],
  "AllowedMethods": ["PUT", "GET"],
  "AllowedHeaders": ["Content-Type"],
  "MaxAgeSeconds": 3600
}]
```
Phase 2 already did this (room photos work in production). The same bucket is reused, so CORS is already configured. This is not a new concern for Phase 13, but worth verifying if testing locally with a different origin.

**Warning signs:** DevTools shows `403 Forbidden` or `CORS error` on the direct PUT to `*.r2.cloudflarestorage.com` or the R2 public domain.

### Pitfall 5: `onDragOver` without `preventDefault` silently blocks `onDrop`

**What goes wrong:** `onDrop` never fires on the drop target.

**Why it happens:** Browser default behavior prevents dropping on most elements. `e.preventDefault()` in `onDragOver` is required to signal the element accepts drops.

**How to avoid:** Always pair `onDragOver={e => e.preventDefault()}` with `onDrop` on the same element.

### Pitfall 6: Optimistic update + error rollback for reorder

**What goes wrong:** User drags photo to new position, UI updates, then PATCH fails. Photos show wrong order until page refresh.

**How to avoid:** Use TanStack Query `onError` callback to rollback via `setQueryData`:
```typescript
useMutation({
  mutationFn: reorderPhotos,
  onMutate: async (newOrder) => {
    await queryClient.cancelQueries({ queryKey: ['admin', 'hotel-photos'] });
    const snapshot = queryClient.getQueryData(['admin', 'hotel-photos']);
    queryClient.setQueryData(['admin', 'hotel-photos'], newOrder);
    return { snapshot };
  },
  onError: (err, vars, ctx) => {
    queryClient.setQueryData(['admin', 'hotel-photos'], ctx?.snapshot);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'hotel-photos'] });
  },
});
```

### Pitfall 7: `Settings` icon name collision in Sidebar

**What goes wrong:** The "Usuarios" nav item already uses the `Settings` icon from lucide-react (line 64 of `Sidebar.tsx`). Adding another item with the same icon creates visual ambiguity in the sidebar.

**How to avoid:** Use a different icon for "Configuración". Recommendations (all available in `lucide-react@0.525`):
- `SlidersHorizontal` — settings/adjustment metaphor
- `Building2` — hotel/property metaphor
- `Cog` — classic settings

### Pitfall 8: `address` column does NOT exist yet in SystemConfig

**What goes wrong:** `public-portal.service.ts` line 14 has `const HOTEL_ADDRESS_PLACEHOLDER = 'La Candelaria, Bogotá'` with comment `// Phase 13 will add it`. The `SystemConfig` model in `schema.prisma` does NOT have an `address` column (confirmed — only: `hotelName`, `hotelLogoUrl`, `tagline`, `description`, `phone`, `tags`).

**How to avoid:** Phase 13 must add `address String?` to `SystemConfig` in the migration. The CONTEXT.md says the form field `address` is required (5-200 chars). After the migration, update `PublicPortalService.getHotelInfo()` to return `config?.address ?? HOTEL_ADDRESS_PLACEHOLDER` instead of the hardcoded constant.

**This is a key finding not explicitly called out in CONTEXT.md.** The `address` field migration must be part of Phase 13's single migration.

### Pitfall 9: `HotelPhotosModule` must import `ConfigModule`

**What goes wrong:** `HotelPhotosService` constructor reads `R2_*` env vars via `ConfigService`. If `ConfigModule` is not in `HotelPhotosModule`'s `imports`, NestJS will throw at startup.

**How to avoid:** Mirror the pattern from `InventoryModule` which imports `ConfigModule` (line 20 of `inventory.module.ts`). `ConfigModule.forRoot({ isGlobal: true })` in `AppModule` makes `ConfigService` available globally via DI, but the module still needs `ConfigModule` in imports to access it without `@Global()` re-export issues.

**Actually:** Since `ConfigModule.forRoot({ isGlobal: true })` is in `AppModule`, `ConfigService` is globally injectable. The `imports: [ConfigModule]` in `InventoryModule` may be belt-and-suspenders. Test confirms the pattern works — replicate it.

---

## Code Examples

### SystemConfigController — PATCH extension

```typescript
// Source: pattern from apps/api/src/modules/inventory/inventory.controller.ts lines 21-40
import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';

@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('public')
  async getPublicConfig() { /* existing — unchanged */ }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(@Body() body: unknown, @Req() req: Request) {
    const dto = UpdateSystemConfigSchema.parse(body);
    const userId = (req as any).user.id;
    return this.systemConfigService.update(dto, userId);
  }
}
```

### HotelPhotosController — full structure

```typescript
// Source: pattern from apps/api/src/modules/inventory/photos/photos.controller.ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/hotel-photos')
export class HotelPhotosController {
  @Post('presign')
  @Roles('ADMIN')
  presign(@Body() dto: PresignHotelPhotoDto) {
    return this.hotelPhotosService.presignUpload(dto.filename, dto.contentType, dto.size);
  }

  @Post()
  @Roles('ADMIN')
  confirm(@Body() dto: ConfirmHotelPhotoDto) {
    return this.hotelPhotosService.confirmUpload(dto);
  }

  @Patch('reorder')
  @Roles('ADMIN')
  reorder(@Body() dto: ReorderHotelPhotosDto) {
    return this.hotelPhotosService.reorderPhotos(dto.photoIds);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  delete(@Param('id') id: string) {
    return this.hotelPhotosService.deletePhoto(id);
  }
}
```

### TagsInput component — minimal implementation

```tsx
// Source: apps/web/src/features/settings/components/TagsInput.tsx
export function TagsInput({ value, onChange, max = 8 }: TagsInputProps) {
  const [inputVal, setInputVal] = useState('');

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
    setInputVal('');
  };

  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-warm-line bg-warm-paper px-2 py-1.5 focus-within:ring-1 focus-within:ring-terracotta">
      {value.map(tag => (
        <span key={tag} className="flex items-center gap-1 bg-warm-cream text-ink-2 rounded-full px-2 py-0.5 text-xs">
          {tag}
          <button type="button" onClick={() => onChange(value.filter(t => t !== tag))} aria-label={`Eliminar ${tag}`}>
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputVal); }
          if (e.key === 'Backspace' && !inputVal && value.length > 0) onChange(value.slice(0, -1));
        }}
        placeholder={value.length >= max ? `Máx. ${max} etiquetas` : 'Añadir etiqueta...'}
        disabled={value.length >= max}
        className="flex-1 min-w-[100px] bg-transparent outline-none text-sm text-ink-1 placeholder:text-ink-4"
      />
    </div>
  );
}
```

### Zod schema (shared — backend service + frontend zodResolver)

```typescript
// Can live in: apps/api/src/system-config/dto/update-system-config.dto.ts
// Frontend imports a copy or shared package (in this monorepo, duplicate is simpler)
import { z } from 'zod';

export const UpdateSystemConfigSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  address: z.string().min(5).max(200).optional(),
  tagline: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  phone: z.string().regex(/^\+?[\d\s()+-]{7,20}$/).optional().nullable(),
  tags: z.array(z.string().min(2).max(40)).max(8).optional(),
});

export type UpdateSystemConfigDto = z.infer<typeof UpdateSystemConfigSchema>;
```

---

## State of the Art

| Old Approach | Current Approach | Phase | Impact |
|--------------|------------------|-------|--------|
| `HOTEL_ADDRESS_PLACEHOLDER` hardcoded in `PublicPortalService` | `config.address` from DB after Phase 13 migration | Phase 13 | Address becomes admin-editable, no code change needed |
| Hero gallery photos seeded as full Unsplash URLs | New uploads store R2 `key` only, URL derived at read time | Phase 13 | Consistent with `RoomPhoto` convention; supports domain rename without migration |
| No admin UI for hotel identity | `/settings/hotel` with 6-field form + gallery manager | Phase 13 | Closes the last "hardcoded content" gap before Phase 14 |

**Deprecated/outdated (from Phase 12 verification report):**
- `HOTEL_ADDRESS_PLACEHOLDER` constant — will be replaced by `config?.address` after Phase 13 adds the DB column
- Hardcoded Unsplash URLs as primary photo source — new uploads use R2 keys; seeded rows kept as-is

---

## Open Questions

1. **`address` column in SystemConfig — is it already present?**
   - What we know: `schema.prisma` confirmed as of Phase 12 does NOT have an `address` field in `SystemConfig`. `public-portal.service.ts` line 14 hardcodes `HOTEL_ADDRESS_PLACEHOLDER` with comment `// Phase 13 will add it`.
   - What's clear: Phase 13 must add `address String?` to `SystemConfig` in the migration.
   - Recommendation: Add to the same migration that adds `hotel_photos.key` and `system_config_change_log`. Single migration for all schema changes.

2. **`@radix-ui/react-alert-dialog` not installed — install or hand-roll?**
   - What we know: `@radix-ui/react-slot` is already installed (Phase 9). Other Radix primitives are implicitly available via shadcn CLI.
   - What's clear: `shadcn add alert-dialog` is the fastest path and follows the project's existing component acquisition pattern.
   - Recommendation: Install via `npx shadcn@latest add alert-dialog` in Wave 1 before the UI wave begins.

3. **`Textarea` primitive — install via shadcn or hand-roll?**
   - What we know: `RoomTypeDrawer.tsx` line 177-183 uses an inline `<textarea>` with manual className string. The primitive is not in `components/ui/`.
   - Recommendation: Create `textarea.tsx` matching the `input.tsx` token pattern (4 lines of forwardRef + CVA). This is faster than running the shadcn CLI and avoids an internet call.

---

## Files Inventory — Blast Radius

### Backend — new files (6)

| File | Type | Notes |
|------|------|-------|
| `apps/api/src/modules/hotel-photos/hotel-photos.module.ts` | NEW | ConfigModule import |
| `apps/api/src/modules/hotel-photos/hotel-photos.controller.ts` | NEW | 4 endpoints |
| `apps/api/src/modules/hotel-photos/hotel-photos.service.ts` | NEW | R2 + Prisma |
| `apps/api/src/modules/hotel-photos/dto/presign-hotel-photo.dto.ts` | NEW | |
| `apps/api/src/modules/hotel-photos/dto/confirm-hotel-photo.dto.ts` | NEW | |
| `apps/api/src/modules/hotel-photos/dto/reorder-hotel-photos.dto.ts` | NEW | |

### Backend — modified files (4)

| File | Change |
|------|--------|
| `apps/api/src/system-config/system-config.service.ts` | Add `update(dto, userId)` method |
| `apps/api/src/system-config/system-config.controller.ts` | Add `PATCH /` endpoint with guards |
| `apps/api/src/modules/public-portal/public-portal.service.ts` | Update `getHotelInfo()` to use `config.address`; update `getHotelPhotos()` for key/url dual-shape |
| `apps/api/src/app.module.ts` | Add `HotelPhotosModule` to imports |

### Backend — migration (1)

| File | Change |
|------|--------|
| `apps/api/prisma/migrations/YYYYMMDDHHMMSS_phase13_hotel_settings/migration.sql` | ADD `hotel_photos.key`, ADD `system_config.address`, CREATE `system_config_change_log` |
| `apps/api/prisma/schema.prisma` | Add `key String?` to HotelPhoto, `address String?` to SystemConfig, new `SystemConfigChangeLog` model |

### Frontend — new files (12)

| File | Notes |
|------|-------|
| `apps/web/src/features/settings/HotelSettingsPage.tsx` | Main page |
| `apps/web/src/features/settings/hotel-settings.api.ts` | Axios calls |
| `apps/web/src/features/settings/hooks/useAdminSystemConfig.ts` | GET admin config |
| `apps/web/src/features/settings/hooks/useUpdateSystemConfig.ts` | PATCH mutation |
| `apps/web/src/features/settings/hooks/useAdminHotelPhotos.ts` | GET photos |
| `apps/web/src/features/settings/hooks/useUploadHotelPhoto.ts` | presign+PUT+confirm |
| `apps/web/src/features/settings/hooks/useDeleteHotelPhoto.ts` | DELETE mutation |
| `apps/web/src/features/settings/hooks/useReorderHotelPhotos.ts` | PATCH reorder |
| `apps/web/src/features/settings/components/HotelInfoForm.tsx` | 6-field form |
| `apps/web/src/features/settings/components/HotelGalleryManager.tsx` | Grid + drag + upload |
| `apps/web/src/features/settings/components/TagsInput.tsx` | Chip input |
| `apps/web/src/features/settings/components/PhotoThumbnail.tsx` | Draggable card |
| `apps/web/src/components/ui/textarea.tsx` | NEW shadcn-style primitive |
| `apps/web/src/components/ui/alert-dialog.tsx` | NEW via Radix |

### Frontend — modified files (3)

| File | Change |
|------|--------|
| `apps/web/src/router.tsx` | Add `/settings/hotel` route inside `StaffLayout` children |
| `apps/web/src/components/layout/Sidebar.tsx` | Add "Configuración" item to ADMINISTRACIÓN section |
| `apps/web/src/features/public-portal/hooks/useHotelInfo.ts` | No change needed — invalidation happens via `queryClient.invalidateQueries` in the mutation hook |

**Total blast radius:** 6 new backend files + 4 modified backend files + 1 migration + 14 new frontend files + 3 modified frontend files = **28 files**

---

## Sources

### Primary (HIGH confidence — direct code reading)

- `apps/api/src/system-config/system-config.service.ts` — existing methods; `update()` does NOT exist; `findFirst()` is the read pattern
- `apps/api/src/system-config/system-config.controller.ts` — GET public only; PATCH does NOT exist
- `apps/api/src/modules/inventory/photos/photos.service.ts` — exact R2 presign pattern to replicate
- `apps/api/src/modules/inventory/photos/r2.client.ts` — importable factory
- `apps/api/prisma/schema.prisma` — confirmed: `HotelPhoto` has `{id, url, alt, displayOrder, createdAt}`, NO `key` column; `SystemConfig` has `{tagline, description, phone, tags}` but NO `address`; NO generic `AuditLog` model
- `apps/web/src/router.tsx` — `ProtectedRoute` has NO `roles` prop; all protected routes are in `StaffLayout` children
- `apps/web/src/components/layout/Sidebar.tsx` — `NAV_SECTIONS` array; `roles` filter pattern confirmed; `Settings` icon already imported (at line 10) and used by "Usuarios"
- `apps/web/src/features/inventory/RoomTypeDrawer.tsx` — react-hook-form + zodResolver + axios pattern; amenities as comma-separated string (no chip input exists)
- `apps/web/package.json` — `@dnd-kit` NOT installed; `@radix-ui/react-alert-dialog` NOT installed
- `apps/web/src/components/ui/` glob — confirms no `textarea.tsx` or `alert-dialog.tsx` exist
- `apps/api/src/modules/public-portal/public-portal.service.ts` — `getHotelPhotos()` at line 118: reads `p.url` directly (no key logic); `getHotelInfo()` uses `HOTEL_ADDRESS_PLACEHOLDER` hardcoded
- `.planning/config.json` — `nyquist_validation: false` confirmed; Validation Architecture section omitted

### Secondary (MEDIUM confidence)

- Phase 12 VERIFICATION.md — confirmed Phase 12 shipped state; `hotel_photos` seeded with 5 Unsplash URLs in `url` column; `key` column does not exist post-Phase-12

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified via direct file reading
- Architecture patterns: HIGH — based on direct analysis of existing code; all patterns are extrapolations of patterns already used in Phases 2, 7, 8, 12
- Schema gaps: HIGH — confirmed by reading `schema.prisma` in full (no `address` in SystemConfig, no `key` in HotelPhoto, no generic AuditLog)
- Pitfalls: HIGH — derived from reading actual code that will be affected

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable codebase — no fast-moving external dependencies)

---

## RESEARCH COMPLETE
