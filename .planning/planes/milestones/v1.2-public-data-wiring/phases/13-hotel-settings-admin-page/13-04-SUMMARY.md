---
phase: 13-hotel-settings-admin-page
plan: 04
subsystem: web/settings
tags: [react, tanstack-query, gallery, drag-drop, r2, upload, hotel-photos, html5-dnd]
dependency_graph:
  requires:
    - "13-02 — GET /api/admin/hotel-photos + presign/confirm/reorder/delete endpoints"
    - "13-03 — HotelSettingsPage shell + AlertDialog primitive"
  provides:
    - "HotelGalleryManager — gallery grid with drag-to-reorder + upload + delete"
    - "PhotoThumbnail — individual draggable card with AlertDialog delete confirmation"
    - "useHotelPhotosAdmin — queryKey ['admin', 'hotel-photos']"
    - "useUploadHotelPhoto — presign → R2 direct PUT → confirm (3-step)"
    - "useReorderHotelPhotos — optimistic update with rollback"
    - "useDeleteHotelPhoto — DELETE mutation"
    - "AdminHotelPhoto interface exported from hotel-settings.api.ts"
  affects:
    - "HotelSettingsPage — 2-col lg layout, max-w-6xl"
    - "['public', 'hotel-photos'] query — invalidated by all photo mutations"
tech_stack:
  added: []
  patterns:
    - "HTML5 native drag-and-drop (no @dnd-kit) — onDragOver preventDefault, splice-based reorder"
    - "Multi-step upload orchestration in single useMutation (presign + fetch PUT + confirm)"
    - "Optimistic update with queryClient.cancelQueries + setQueryData + rollback on error"
    - "Direct R2 PUT via native fetch (bypass axios interceptors — presigned URL carries its own auth)"
    - "Dual query key invalidation: ['admin', 'hotel-photos'] AND ['public', 'hotel-photos'] on every mutation"
key_files:
  created:
    - apps/web/src/features/settings/hooks/useHotelPhotosAdmin.ts
    - apps/web/src/features/settings/hooks/useUploadHotelPhoto.ts
    - apps/web/src/features/settings/hooks/useReorderHotelPhotos.ts
    - apps/web/src/features/settings/hooks/useDeleteHotelPhoto.ts
    - apps/web/src/features/settings/components/HotelGalleryManager.tsx
    - apps/web/src/features/settings/components/PhotoThumbnail.tsx
  modified:
    - apps/web/src/features/settings/hotel-settings.api.ts (AdminHotelPhoto interface + 5 photo functions)
    - apps/web/src/features/settings/HotelSettingsPage.tsx (2-col layout + HotelGalleryManager)
decisions:
  - "HTML5 native drag over @dnd-kit — zero new dependencies, sufficient for 5-10 photos at v1.2"
  - "Upload via native fetch (not axios) for R2 direct PUT — axios interceptors would inject Authorization header that R2 presigned URLs do not expect"
  - "ACCEPTED_TYPES includes image/avif in addition to JPEG/PNG/WebP — broader modern format support"
  - "upload.reset() called in handleFile before new upload attempt — clears previous error banner"
  - "Backend Task 1 already implemented in 13-02 — no controller/service changes needed"
metrics:
  duration: "18 minutes"
  completed: "2026-05-18"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 2
---

# Phase 13 Plan 04: Gallery manager + HTML5 drag + 4 photo hooks Summary

**One-liner:** Gallery manager with HTML5 drag-to-reorder, 3-step R2 upload (presign → direct PUT → confirm), AlertDialog delete, and optimistic reorder — wired into HotelSettingsPage as a second column on lg.

## What Was Built

### Task 1 — Backend GET endpoint (already present from 13-02)

`GET /api/admin/hotel-photos` was implemented in Plan 13-02 as part of `HotelPhotosService.listPhotos()` and `HotelPhotosController.list()`. No backend changes required in this plan. TypeScript verified clean at `EXIT_0`.

### Task 2 — 4 frontend hooks + API functions (commit c230757)

**`hotel-settings.api.ts` extended with:**
- `AdminHotelPhoto` interface (`id`, `url`, `alt`, `displayOrder`)
- `fetchAdminHotelPhotos()` — GET `/admin/hotel-photos`
- `presignHotelPhoto()` — POST `/admin/hotel-photos/presign`
- `confirmHotelPhoto()` — POST `/admin/hotel-photos`
- `reorderHotelPhotos()` — PATCH `/admin/hotel-photos/reorder`
- `deleteHotelPhoto()` — DELETE `/admin/hotel-photos/:id`

**4 hooks:**

| Hook | Pattern | Invalidates |
|------|---------|-------------|
| `useHotelPhotosAdmin` | `useQuery`, staleTime 30s | — |
| `useUploadHotelPhoto` | `useMutation`, 3-step async | admin + public |
| `useReorderHotelPhotos` | `useMutation` + optimistic update | admin + public (onSettled) |
| `useDeleteHotelPhoto` | `useMutation` | admin + public |

**Reorder optimistic update pattern:**
1. `cancelQueries` — stop in-flight GET from overwriting optimistic state
2. `getQueryData` — save snapshot for rollback
3. `setQueryData` — apply new order immediately
4. `onError` — restore snapshot if PATCH fails
5. `onSettled` — always invalidate both keys to reconcile with server

**Upload R2 bypass:**
The `fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })` call uses native `fetch`, NOT the axios `api` client. This is intentional: axios interceptors add an `Authorization: Bearer` header that R2 presigned URLs do not tolerate.

### Task 3 — HotelGalleryManager + PhotoThumbnail + HotelSettingsPage wiring (commit f466c4c)

**`PhotoThumbnail.tsx`:**
- `draggable` on root div; `draggable={false}` on `<img>` (prevents browser default image drag ghost)
- `onDragStart`: sets `effectAllowed = 'move'`, calls parent handler
- `onDragOver`: forwarded to parent's `e.preventDefault()` handler
- `onDrop`: calls `e.preventDefault()` locally + parent drop handler
- Order badge: top-left, `bg-ink-1/70 text-warm-white font-mono`
- Drag handle: `GripVertical` bottom-left (decorative)
- Delete: `AlertDialog` with cancel + terracotta action button (never `window.confirm`)

**`HotelGalleryManager.tsx`:**
- Grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3`
- Upload: hidden `<input type="file">` triggered by button click; validates type + size before mutating
- Client validation: JPEG/PNG/WebP/AVIF only; max 5 MB; inline error alert on rejection
- States: loading skeleton (4 pulse placeholders), error with retry, empty state, populated grid
- `upload.reset()` called before each new upload to clear previous error banner

**`HotelSettingsPage.tsx` changes:**
- `max-w-4xl` → `max-w-6xl` (accommodates 2-column layout)
- `{data && ...}` block replaced with `grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start`
- Gallery column rendered in its own `rounded-lg border border-warm-line bg-warm-white p-6` card

## Deviations from Plan

### No deviations — plan executed exactly as written

Backend Task 1 was already fully implemented in 13-02 (GET /api/admin/hotel-photos with `id` field present in `listPhotos()` return shape). No controller or service changes were needed.

All 3 frontend tasks implemented without blocking issues.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter web tsc --noEmit` | EXIT_0 |
| `pnpm --filter api tsc --noEmit` | EXIT_0 |
| `rg "queryKey: ['admin', 'hotel-photos']" useHotelPhotosAdmin.ts` | 1 match |
| `rg "['public', 'hotel-photos']"` in upload/reorder/delete hooks | 3 files, all match |
| `rg "method: 'PUT'"` in useUploadHotelPhoto | 1 match (R2 direct PUT confirmed) |
| `rg "onMutate"` in useReorderHotelPhotos | 1 match (optimistic confirmed) |
| `rg "draggable"` in PhotoThumbnail | 2 matches (root div + img false) |
| `rg "e\.preventDefault\(\)"` in PhotoThumbnail | 1 match (onDrop) |
| `rg "AlertDialog"` in PhotoThumbnail | imports + usage confirmed |
| `rg "HotelGalleryManager"` in HotelSettingsPage | 2 matches (import + usage) |

## Commits

| Hash | Message |
|------|---------|
| c230757 | feat(13-04): 4 photo hooks + photo API functions (list, upload, reorder, delete) |
| f466c4c | feat(13-04): HotelGalleryManager + PhotoThumbnail + wire into HotelSettingsPage |

## Self-Check: PASSED
