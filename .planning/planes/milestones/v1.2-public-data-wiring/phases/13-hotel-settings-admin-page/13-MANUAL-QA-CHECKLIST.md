# Phase 13 — Manual QA Checklist

**Phase:** 13 — Hotel Settings Admin Page
**Milestone:** v1.2 — Public Data Wiring
**Date authored:** 2026-05-18
**Operator:** ___________________________
**Date executed:** ___________________________

---

## Setup

Before running scenarios, ensure the local stack is running:

```bash
# Terminal 1 — API
pnpm --filter api dev

# Terminal 2 — Web
pnpm --filter web dev
```

Expected base URLs:
- Backend API: `http://localhost:3011`
- Frontend: `http://localhost:5173`

Credentials required:
- ADMIN user: email + password (seeded via `pnpm --filter api seed:admin`)
- RECEPTION user: (create from admin panel if needed, or use an existing non-admin user)

---

## Scenarios

---

### Scenario 1 — Sidebar navigation to /settings/hotel (HSP-03)

**Pre-condition:** Logged in as ADMIN.

**Steps:**
1. Navigate to `http://localhost:5173/dashboard`
2. Observe the left Sidebar under the "ADMINISTRACIÓN" section
3. Verify "Configuración" item is visible with a `SlidersHorizontal` icon
4. Click "Configuración"

**Expected:**
- Item is present in sidebar under ADMINISTRACIÓN
- Click navigates to `/settings/hotel` without full page reload
- Page renders the hotel settings form with a title such as "Configuración del Hotel"

**Result:** [ ] PASS  [ ] FAIL
**Timestamp:** ___________
**Notes:** _______________

---

### Scenario 2 — Role gate: RECEPTION cannot access /settings/hotel (HSP-03)

**Pre-condition:** Logged in as a RECEPTION or MANAGER user (non-ADMIN).

**Steps:**
1. Log out from ADMIN account
2. Log in with a RECEPTION or MANAGER role user
3. Observe the Sidebar — "Configuración" should NOT appear under ADMINISTRACIÓN
4. Manually type `http://localhost:5173/settings/hotel` in the browser address bar and press Enter
5. Open DevTools → Network → filter by "system-config"

**Expected:**
- Sidebar does NOT show "Configuración" item for non-ADMIN users
- Direct URL navigation renders a "Acceso restringido" (403) state inline — no form, no leaked data
- Network shows `GET /api/system-config` returns `403 Forbidden`

**Result:** [ ] PASS  [ ] FAIL
**Timestamp:** ___________
**Notes:** _______________

---

### Scenario 3 — Form pre-fills with current values (HSP-03)

**Pre-condition:** Logged in as ADMIN. Local stack running with DB containing seeded SystemConfig.

**Steps:**
1. Navigate to `http://localhost:5173/settings/hotel`
2. Wait for the form to load (skeleton → populated fields)
3. Observe the 6 fields: Nombre del hotel, Dirección, Tagline, Descripción, Teléfono, Tags

**Expected:**
- Form renders without error
- Fields are populated with values from the DB (not empty, not placeholder text)
- Tags field shows chip pills if tags exist
- No loading state stuck indefinitely

**Result:** [ ] PASS  [ ] FAIL
**Timestamp:** ___________
**Notes:** _______________

---

### Scenario 4 — PATCH happy path: edit name + save + cache propagation (HSP-01, HSP-06)

**Pre-condition:** Logged in as ADMIN.

**Steps:**
1. Navigate to `http://localhost:5173/settings/hotel`
2. Clear the "Nombre del hotel" field and type: `Hotel Sumapaz Verificación`
3. Click "Guardar cambios"
4. Observe the response
5. Open a new browser tab and navigate to `http://localhost:5173/` (or `/booking`)
6. Hard-refresh the new tab (Ctrl+Shift+R / Cmd+Shift+R)

**Expected:**
- After saving: a success banner or toast appears within 1 second ("Cambios guardados" or similar)
- The field retains the new value "Hotel Sumapaz Verificación" after save
- In the new `/booking` tab after hard refresh: the hotel name in HeroIdentity, TopNav, and/or PortalFooter shows "Hotel Sumapaz Verificación"
  - Note: If TanStack staleTime (30s–60s) has not expired, a hard refresh should force a new fetch

**Result:** [ ] PASS  [ ] FAIL
**Timestamp:** ___________
**Notes:** _______________

---

### Scenario 5 — Client-side validation: name empty + phone invalid (HSP-03)

**Pre-condition:** Logged in as ADMIN. Form is visible at `/settings/hotel`.

**Steps:**
1. Clear the "Nombre del hotel" field (leave it empty)
2. Click "Guardar cambios"
3. Observe inline error
4. Now fill in a name, then enter an invalid phone: `abc` (non-E.164 format)
5. Click "Guardar cambios"
6. Observe inline error for phone

**Expected:**
- Empty name: inline error message below the field ("El nombre es requerido" or similar)
- Form does NOT submit (no network request)
- Invalid phone: inline error message below the phone field
- Form does NOT submit

**Result:** [ ] PASS  [ ] FAIL
**Timestamp:** ___________
**Notes:** _______________

---

### Scenario 6 — Tags management: add, persist, remove, max limit (HSP-03)

**Pre-condition:** Logged in as ADMIN. Form visible at `/settings/hotel`.

**Steps:**
1. Click in the Tags input field
2. Type "Boutique" and press Enter → observe chip appears
3. Type "Bogotá" and press Enter → observe chip appears
4. Type "Lujo" and press Enter → observe chip appears
5. Click "Guardar cambios"
6. Refresh the page
7. Observe tags are still present (persisted)
8. Click the X on "Lujo" chip → observe chip removed
9. (Optional) If 8 tags exist, try adding a 9th → expect enforcement of max-8 limit

**Expected:**
- Tags added on Enter appear as chips immediately
- After save + refresh, tags persist (fetched from DB)
- Clicking X removes chip from the UI
- If max-8 enforcement is active: adding a 9th tag is blocked with an inline message

**Result:** [ ] PASS  [ ] FAIL
**Timestamp:** ___________
**Notes:** _______________

---

### Scenario 7 — Gallery: current photos visible (HSP-02, HSP-05)

**Pre-condition:** Logged in as ADMIN. Phase 12 seed applied (5 hero photos in DB + R2).

**Steps:**
1. Navigate to `http://localhost:5173/settings/hotel`
2. Scroll to the gallery section (right column on lg, below form on mobile)

**Expected:**
- Gallery shows the current hotel photos (at least those seeded in Phase 12)
- Each photo renders as a thumbnail card with a delete button (X)
- Photos show in their current `displayOrder`
- No broken image URLs (if R2 credentials are set locally; if R2 is unavailable, placeholder/broken images are acceptable)

**Result:** [ ] PASS  [ ] FAIL
**Timestamp:** ___________
**Notes:** _______________

---

### Scenario 8 — Photo upload: new photo appears in admin gallery + public API (HSP-04, HSP-05, HSP-06)

**Pre-condition:** Logged in as ADMIN. R2 credentials configured in local `.env`. A test JPG or PNG file ≤5MB available.

**Steps:**
1. Navigate to `http://localhost:5173/settings/hotel`
2. Click "Subir foto" (or the upload button in the gallery section)
3. Select a valid JPG/PNG/WebP image ≤5MB via the file picker
4. Observe the upload progress/feedback
5. After upload completes, observe the gallery
6. Open a new tab → navigate to `http://localhost:3011/api/public/hotel-photos`

**Expected:**
- Upload progress feedback is shown (spinner or progress indicator)
- After ~1-3 seconds, the new photo appears at the end of the admin gallery grid
- `GET /api/public/hotel-photos` JSON response includes the new photo URL (the URL derived from the R2 key)

**Result:** [ ] PASS  [ ] FAIL
**Timestamp:** ___________
**Notes:** _______________
**Note:** If R2 credentials are not configured locally, skip this scenario and mark as N/A.

---

### Scenario 9 — Photo reorder (drag) + delete with confirmation (HSP-04)

**Pre-condition:** Logged in as ADMIN. At least 2 photos in the gallery.

**Steps (Reorder):**
1. Note the current order of photos
2. Drag the last photo to the first position
3. Observe the grid reorders immediately (optimistic update)
4. Refresh the page
5. Observe that the new order is preserved

**Steps (Delete):**
1. Click the X / delete button on any photo
2. Observe an `AlertDialog` confirmation appears: "¿Eliminar esta foto?" with "Cancelar" and "Eliminar" buttons
3. Click "Cancelar" → observe dialog closes, photo remains
4. Click the delete button again → click "Eliminar"
5. Observe the photo disappears from the admin gallery grid
6. Navigate to `http://localhost:3011/api/public/hotel-photos` and verify the deleted photo is no longer in the response

**Expected:**
- Drag reorder: optimistic reorder visible immediately; order persists after page refresh
- Delete dialog: `AlertDialog` (not browser `window.confirm`) appears on delete click
- Cancelar: dialog closes, photo stays
- Confirmar eliminar: photo removed from admin gallery AND absent from public API response

**Result:** [ ] PASS  [ ] FAIL
**Timestamp:** ___________
**Notes:** _______________

---

## Sign-Off

| Scenario | Result | Notes |
|----------|--------|-------|
| 1 — Sidebar nav (ADMIN) | | |
| 2 — Role gate (non-ADMIN) | | |
| 3 — Form pre-fill | | |
| 4 — PATCH happy path + cache | | |
| 5 — Validation (empty name + bad phone) | | |
| 6 — Tags management | | |
| 7 — Gallery visible | | |
| 8 — Photo upload | | |
| 9 — Reorder + Delete with dialog | | |

**Overall result:** [ ] ALL PASS  [ ] FAILURES (list below)

**Failures (if any):**
```
Scenario N: [description of failure]
```

**QA operator signature:** ___________________________
**Date:** ___________________________

---

## Screenshot Placeholders

_Add screenshots below each scenario during execution to provide evidence for audit._

**Scenario 1:** [screenshot — sidebar with Configuración visible]

**Scenario 2:** [screenshot — sidebar without Configuración; 403 state on direct URL]

**Scenario 3:** [screenshot — form pre-filled]

**Scenario 4:** [screenshot — success banner; /booking showing updated name]

**Scenario 5:** [screenshot — validation errors inline]

**Scenario 6:** [screenshot — tags chips added; persisted after refresh]

**Scenario 7:** [screenshot — gallery grid with seeded photos]

**Scenario 8:** [screenshot — photo appearing in gallery; /api/public/hotel-photos JSON]

**Scenario 9:** [screenshot — reorder; AlertDialog; photo deleted from gallery]
