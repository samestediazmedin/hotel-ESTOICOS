# Phase 13: Hotel Settings Admin Page — Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Source:** REQUIREMENTS.md (HSP-01..06) + Phase 12 wiring complete (admin edits → portal reflects)

<domain>
## Phase Boundary

Build the **admin UI layer** that lets staff edit hotel identity (name, address, tagline, description, phone, tags) and manage the hero gallery photos that Phase 12 already exposes publicly. Today the admin can only edit RoomTypes via `RoomTypeDrawer` — Phase 13 adds the missing piece so SystemConfig and hotel_photos are also editable from the staff UI.

**What this phase delivers:**
- New route `/settings/hotel` (ADMIN role only via existing `RolesGuard`)
- Form to edit 6 SystemConfig fields with react-hook-form + zod
- Gallery manager: upload (presigned R2) + drag-to-reorder + delete with confirmation
- 4 new backend endpoints: PATCH SystemConfig + 3 CRUD ops on hotel_photos
- Audit log entry on every SystemConfig save

**Out of scope:**
- RoomType editing UI improvements (existing RoomTypeDrawer is fine)
- Reviews moderation page (Phase 14)
- Multi-language settings
- Hotel branding (logo upload, color theme override) — v1.3+
- Booking engine config (cancellation policies, minimum stay) — v1.3+

</domain>

<decisions>
## Implementation Decisions (locked)

### Backend new endpoints

**Module placement:** Extend existing `apps/api/src/system-config/` module — DON'T create a new module. SystemConfigService already exists with `get()` + needs `update()`.

1. **`PATCH /api/system-config`** (extend `SystemConfigController`)
   - Guards: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN')`
   - Body: Zod schema with partial updates of `{ name, address, tagline, description, phone, tags[] }`
   - Returns the updated SystemConfig record
   - Calls `SystemConfigService.update(dto)` which: validates, calls `prisma.systemConfig.updateMany({where: {}, data: dto})`, returns the updated row, writes audit log entry

2. **`POST /api/admin/hotel-photos/presign`** (new controller `apps/api/src/modules/hotel-photos/hotel-photos.controller.ts`)
   - Guards: ADMIN only
   - Body: `{ filename, contentType }`
   - Returns: `{ uploadUrl, photoId, key }` — presigned PUT URL valid 5 min
   - Reuses `PhotosService.generatePresignedUploadUrl()` from inventory module (refactor to shared service OR duplicate the R2 logic — small enough to duplicate)

3. **`POST /api/admin/hotel-photos`** (confirm after R2 upload)
   - Guards: ADMIN only
   - Body: `{ photoId, key, alt }`
   - Creates `hotel_photo` row with computed `url` (from R2 public URL pattern) and `displayOrder = MAX + 1`

4. **`PATCH /api/admin/hotel-photos/reorder`**
   - Guards: ADMIN only
   - Body: `{ photoIds: string[] }` (new order — ordinal-based reindex)
   - Service iterates: `displayOrder = i` for each photoId in the array. Single Prisma transaction.

5. **`DELETE /api/admin/hotel-photos/:id`**
   - Guards: ADMIN only
   - Deletes the row + best-effort delete from R2 (fire-and-forget — if R2 delete fails, log but don't block; orphan file cleanup deferred to v1.3)

### Audit log

- Reuse existing audit log mechanism (Phase 7 has `ai_tool_call_log`; Phase 8 has audit pattern for concierge). Check if there's a generic `AuditLog` model — if yes, extend. If no, add a small `system_config_change_log` table.
- Schema: `{ id, userId, fieldsChanged: string[], before: Json, after: Json, changedAt }`
- Service calls audit BEFORE returning the response (synchronous in same transaction).

### Frontend page structure

**Route:** `/settings/hotel`
**Component:** `apps/web/src/features/settings/HotelSettingsPage.tsx`
**Layout:** Renders inside `StaffLayout` (sidebar + topbar via existing route gating)
**Guard:** Wrap in `<ProtectedRoute roles={['ADMIN']}>` (existing pattern from v1.0)

Page sections:
1. **Header**: `<h1 className="font-display italic text-3xl">Configuración del hotel</h1>`
2. **Identity form** (left column on lg, full-width on mobile): 6 fields with react-hook-form
3. **Hero gallery manager** (right column on lg, below form on mobile): existing photos as draggable thumbnails + upload button + delete buttons

### Identity form fields

| Field | Type | Validation |
|-------|------|-----------|
| `name` | text input | required, 2-100 chars |
| `address` | text input | required, 5-200 chars |
| `tagline` | text input | optional, max 120 chars |
| `description` | textarea | optional, max 2000 chars |
| `phone` | text input | optional, regex E.164-ish `^\+?[\d\s()-]{7,20}$` |
| `tags` | tag chip input | optional, max 8 tags, each 2-40 chars |

- Use existing shadcn `Input` + `Textarea` (verify Textarea exists; if not, create from shadcn CLI OR composition)
- For `tags`, use a simple chip input pattern: type + enter to add, X to remove. Custom component `<TagsInput />` under `apps/web/src/features/settings/components/`
- Submit button: `<Button variant="terracotta">Guardar cambios</Button>`
- After successful save: toast (inline alert) + invalidate `['public', 'hotel-info']` query so portal updates instantly
- Cancel button: `<Button variant="outline">Cancelar</Button>` resets form to last-saved values

### Gallery manager

**Layout**: grid of photo thumbnails (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3`)
**Each thumbnail card**:
- Aspect-video preview image
- `displayOrder` indicator (small badge top-left)
- Delete button (X) top-right on hover
- Drag handle (lucide `GripVertical`) bottom-left
- Alt text inline-editable on click

**Upload area**: dashed border placeholder at end of grid with `lucide-upload` icon + "Subir foto"

**Drag-to-reorder**:
- Use `@dnd-kit/core` + `@dnd-kit/sortable` IF not installed; OR simple HTML5 drag-and-drop if minimal. Recommend: native HTML5 drag for v1.2 (zero deps, sufficient for 5-10 photos). `@dnd-kit` deferred to v1.3 if reorder gets gnarly.
- On drop: call `PATCH /api/admin/hotel-photos/reorder` with new photoIds array
- Optimistic update: `queryClient.setQueryData(['admin', 'hotel-photos'], newOrder)` then mutate

**Upload flow**:
1. User picks file → POST `/api/admin/hotel-photos/presign` → receive `{uploadUrl, photoId, key}`
2. PUT file to R2 directly via `uploadUrl` (no proxy through API)
3. POST `/api/admin/hotel-photos` with `{photoId, key, alt}` to confirm
4. Invalidate `['admin', 'hotel-photos']` AND `['public', 'hotel-photos']` queries

**Delete flow**:
1. Click X → shadcn `<AlertDialog>` "¿Borrar esta foto?"
2. Confirm → DELETE `/api/admin/hotel-photos/:id`
3. Invalidate both query keys

### Frontend hooks structure

```
apps/web/src/features/settings/
├── HotelSettingsPage.tsx
├── hotel-settings.api.ts            (axios calls)
├── hooks/
│   ├── useSystemConfig.ts            (admin GET — returns ALL fields)
│   ├── useUpdateSystemConfig.ts      (PATCH mutation)
│   ├── useHotelPhotosAdmin.ts        (admin GET — full list with displayOrder)
│   ├── useUploadHotelPhoto.ts        (presign + R2 PUT + confirm — multi-step)
│   ├── useDeleteHotelPhoto.ts        (DELETE mutation)
│   └── useReorderHotelPhotos.ts      (PATCH reorder mutation)
└── components/
    ├── HotelInfoForm.tsx             (6 fields)
    ├── HotelGalleryManager.tsx       (grid + drag + upload)
    ├── TagsInput.tsx                 (chip input)
    └── PhotoThumbnail.tsx            (individual draggable card)
```

### Sidebar nav entry

Add new nav item to `Sidebar.tsx` under "Administración" section:
- Label: "Configuración"
- Icon: lucide `Settings` (size 18)
- Route: `/settings/hotel`
- Visible only when `user.role === 'ADMIN'`

### Verification commands

1. `curl -X PATCH http://localhost:3011/api/system-config -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" -d '{"name":"Test"}'` → 200
2. Same call without JWT → 401
3. Same call with non-admin JWT → 403
4. Navigate to `/settings/hotel` as admin → form prefilled with current values
5. Edit name + save → toast appears + portal `/booking` reflects new name within 60s (already covered by Phase 12 cache window)
6. Upload 1 photo → appears in admin gallery + in portal hero (after 60s)
7. Drag to reorder → order persists across page refresh
8. Delete photo → confirmation → photo gone from admin + portal
9. `pnpm --filter web vitest run src/features/settings/` → tests pass
10. `pnpm --filter api vitest run src/system-config/` → tests pass

### Claude's Discretion
- Whether `tags` UI uses `<TagsInput>` custom or a simpler comma-separated input (recommend custom — better UX, low cost)
- Whether to use `@dnd-kit/core` vs HTML5 drag (recommend HTML5 — zero deps)
- Whether `system_config_change_log` is a new table or reuse a generic AuditLog if one exists (researcher confirms)
- Exact `lucide-react` icon choices for actions

</decisions>

<canonical_refs>
## Canonical References

### Existing backend code
- `apps/api/src/system-config/system-config.controller.ts` (20L) — extend with PATCH route
- `apps/api/src/system-config/system-config.service.ts` (66L) — add update method
- `apps/api/src/modules/inventory/photos/photos.service.ts` (198L) — R2 presigned URL pattern to reuse
- `apps/api/src/modules/inventory/photos/photos.controller.ts` (83L) — presign + confirm pattern
- `apps/api/src/modules/inventory/inventory.controller.ts` lines 12-21 — RolesGuard + @Roles pattern
- `apps/api/src/shared/guards/roles.guard.ts` — existing guard, reuse verbatim
- `apps/api/src/shared/decorators/roles.decorator.ts` — existing decorator
- `apps/api/prisma/schema.prisma` — SystemConfig + HotelPhoto models (Phase 12 added)
- `apps/api/src/modules/concierge/audit-log.repository.ts` — audit log pattern reference

### Existing frontend code
- `apps/web/src/router.tsx` — wire new `/settings/hotel` route with ProtectedRoute
- `apps/web/src/components/layout/Sidebar.tsx` — add nav item under Administración
- `apps/web/src/features/inventory/RoomTypeDrawer.tsx` — form pattern reference (react-hook-form + zod)
- `apps/web/src/features/public-portal/hooks/useHotelInfo.ts` — Phase 12 hook to invalidate after admin save
- `apps/web/src/features/public-portal/public-portal.api.ts` — endpoint URL pattern reference
- `apps/web/src/components/ui/{button,input,card,badge}.tsx` — Phase 9 primitives
- `apps/web/src/lib/api.ts` — existing axios client (reuse)

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` — HSP-01..06
- `.planning/ROADMAP.md` — Phase 13 section: 6 success criteria

</canonical_refs>

<specifics>
## Specific Ideas

### Tag chip input minimal implementation
- Internal state: `string[]`
- Render: chips rendered before input; input at end
- Keydown Enter or comma → add tag (trim, lowercase optional, dedupe)
- Backspace on empty input → remove last chip
- X on chip → remove that chip
- Token utilities: `bg-warm-paper border border-warm-line text-ink-2 rounded-full px-2 py-1 text-xs`

### Photo URL construction
- Backend stores `key` (S3-style path like `hotel-photos/uuid.jpg`)
- Public URL = `R2_PUBLIC_URL` env var + `/` + `key`
- Service exposes `url` field in API response (compute on read; don't store the full URL — that breaks if R2 bucket renames)
- For Phase 12 we seeded URLs directly (Unsplash); Phase 13 should populate `key` for new uploads. Migration NOT needed — old rows keep their URL, new rows have key.
  - Actually: Phase 12 only has `url` column. Phase 13 adds `key` column (nullable) — uploaded photos have key, seeded photos don't. Service `getPhotos()` returns `{ url: row.key ? buildR2Url(row.key) : row.url }`.

### Audit log table (if no existing generic one)
```prisma
model SystemConfigChangeLog {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  fieldsChanged String[] // names of fields that changed
  before        Json
  after         Json
  changedAt     DateTime @default(now())
  
  @@index([changedAt])
}
```
Phase 13 adds this in migration.

### Sidebar nav guard
Sidebar already has section labels (PRINCIPAL · OPERACIÓN · ADMINISTRACIÓN). Add under ADMINISTRACIÓN:
```tsx
{user.role === 'ADMIN' && (
  <NavItem to="/settings/hotel" icon={Settings} label="Configuración" />
)}
```

</specifics>

<deferred>
## Deferred Ideas

- **Reviews moderation page** — Phase 14
- **Multi-language settings** (ES/EN copy editing) — v1.3
- **Hotel logo upload + color theme override** — v1.3 (would need new schema fields)
- **Booking engine configuration** (min stay, cancellation policy, advance booking window) — v1.3 (admin operational config beyond identity)
- **Rich text description editor** (TipTap, Lexical) — v1.3; v1.2 uses plain textarea
- **Photo cropping / resizing tools** — v1.3; v1.2 uploads original
- **Audit log viewer UI** — v1.3; v1.2 just writes the log (DB-queryable)
- **Bulk photo upload** — v1.3; v1.2 one at a time
- **Soft delete vs hard delete on photos** — v1.2 uses hard delete (assumes admin won't undo); v1.3 may add trash bin

</deferred>

---

*Phase: 13-hotel-settings-admin-page*
*Context gathered: 2026-05-17 — milestone v1.2 Phase 2*
