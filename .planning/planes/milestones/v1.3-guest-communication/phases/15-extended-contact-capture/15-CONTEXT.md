# Phase 15: Extended Contact Capture — Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Source:** REQUIREMENTS.md (GCC-01..05) + user explicit ask: "tome los datos de correo, celular, y etc"

<domain>
## Phase Boundary

Capturar **datos extendidos de contacto y preferencias del huésped** durante la reserva pública. Backend persiste todo en `Guest` (no breaking changes — todos los campos nuevos son nullable/opcionales). Email de confirmación incluye resumen de las preferencias capturadas. Phase 16 (próxima) consumirá estos datos para los botones click-to-contact.

**What this phase delivers:**
- Schema `Guest` extendido con 6 columnas nullable
- DTOs (Create + Update + Public booking payload) extendidos vía Zod
- BookingFormPage público con 2 secciones nuevas (colapsables)
- Email de confirmación incluye sección "Sus preferencias" condicional
- Validación E.164 para `whatsappNumber`
- Migration aplicada a Railway DB

**Out of scope (Phase 16+):**
- Guest detail page (Phase 16)
- ContactButtons component (Phase 16)
- guest_contact_events table (Phase 16)
- Socket.io realtime push (Phase 16)
- Plantillas adicionales de email (v1.4+)
- WhatsApp Business API real (v1.4+)

</domain>

<decisions>
## Implementation Decisions (locked)

### Schema additions

```prisma
enum ContactPreference {
  EMAIL
  PHONE
  WHATSAPP
}

model Guest {
  // ... existing fields (fullName, email, phone, documentType, documentNumber, nationality, dateOfBirth, anonymizedAt)
  
  // Phase 15 additions — all nullable for backwards compat
  preferredLanguage    String              @default("es")   // ISO 639-1 — 'es' | 'en' | future others
  contactPreference    ContactPreference?
  whatsappNumber       String?                              // E.164 format, validated by Zod
  marketingConsent     Boolean             @default(false)
  dietaryRestrictions  String?             @db.VarChar(500)
  specialRequests      String?             @db.VarChar(1000)
}
```

- **Migration name**: `{timestamp}_phase15_extended_guest_contact`
- **Backfill strategy**: NONE needed — all columns nullable or have defaults; existing guests untouched
- **E.164 validation**: regex `/^\+[1-9]\d{6,14}$/` enforced at Zod level (not DB CHECK — easier evolution)

### DTO extensions

**Backend** (`apps/api/src/modules/guests/dto/`):

```ts
// create-guest.dto.ts (Phase 3) — extend with new optional fields
import { z } from 'zod';

export const CreateGuestSchema = z.object({
  // ... existing fields
  preferredLanguage: z.enum(['es', 'en']).optional().default('es'),
  contactPreference: z.enum(['EMAIL', 'PHONE', 'WHATSAPP']).nullable().optional(),
  whatsappNumber: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable().optional(),
  marketingConsent: z.boolean().optional().default(false),
  dietaryRestrictions: z.string().max(500).nullable().optional(),
  specialRequests: z.string().max(1000).nullable().optional(),
});
```

- **Update DTO**: extends `CreateGuestSchema.partial()` — all fields optional in PATCH
- **Public booking DTO**: same schema as CreateGuest (public form sends same shape)

### Frontend form extension

**Target file**: `apps/web/src/features/public-booking/BookingFormPage.tsx` (240L existing)

**Two new collapsible sections** (default collapsed to avoid overwhelming the form):

1. **"Preferencias de contacto"** (icon: lucide `MessageCircle`):
   - WhatsApp number input (with country code helper text `+57 300 123 4567`)
   - Contact preference radio: Email · Teléfono · WhatsApp (or "Cualquiera" = null)
   - Marketing consent checkbox: "Quiero recibir ofertas y novedades del hotel" (default unchecked — opt-in)
   - Idioma preferido radio: Español · English (default Español)

2. **"Preferencias adicionales"** (icon: lucide `Heart`):
   - Restricciones dietarias (textarea, placeholder "Ej: vegetariano, sin gluten, alergia a frutos secos", max 500 chars)
   - Solicitudes especiales (textarea, placeholder "Ej: cama extra, cuna para bebé, vista a los cerros si es posible", max 1000 chars)

**UX rules**:
- Both sections rendered as `<Collapsible>` / disclosure component (Phase 9 doesn't have one shipped — create minimal inline OR use details/summary HTML)
- Click to expand reveals fields below
- Tab order preserved natural (top to bottom)
- Submit button enabled regardless of these fields (all optional)
- Validation feedback inline (Zod error → red ink-2 text under field, NO red palette — use ink/terracotta tokens)

### Email confirmation extension

**Target**: `buildConfirmationHtml()` in `apps/api/src/modules/email/email.service.ts` (line 134)

**Change**: After the existing reservation summary, append a **conditional section** "Sus preferencias":

```html
{if any of [whatsappNumber, contactPreference, dietaryRestrictions, specialRequests] is truthy}
<div style="margin-top: 24px; padding: 16px; background: #f4efe6; border-radius: 8px;">
  <h2 style="font-family: 'Instrument Serif'; color: #2a221a; margin: 0 0 12px;">Sus preferencias</h2>
  
  {if whatsappNumber}
  <p style="font-size: 14px; color: #5a4d3f;">WhatsApp: <strong>{whatsappNumber}</strong></p>
  {endif}
  
  {if contactPreference}
  <p style="font-size: 14px; color: #5a4d3f;">Prefiere ser contactado por: <strong>{contactPreference}</strong></p>
  {endif}
  
  {if dietaryRestrictions}
  <p style="font-size: 14px; color: #5a4d3f;">Restricciones dietarias: <em>{dietaryRestrictions}</em></p>
  {endif}
  
  {if specialRequests}
  <p style="font-size: 14px; color: #5a4d3f;">Solicitudes especiales: <em>{specialRequests}</em></p>
  {endif}
</div>
{endif}
```

- Pure HTML string templating (NO @react-email — confirmed not installed)
- All hex values are warm palette tokens hardcoded in the email (acceptable — emails don't share CSS)
- Marketing consent NOT echoed in email (it's a hotel-internal flag, not user-facing)

### Public booking flow integration

**Path**: `POST /api/public/bookings` (Phase 3 — `public-booking.controller.ts`)

- Accept the new fields in the request body
- Backend creates Guest with extended fields
- Backend creates Reservation as before
- `EmailService.sendConfirmation(...)` receives the guest object — uses preferences for the conditional section
- **No new endpoints needed** in this phase

### Verification commands

1. `pnpm --filter api prisma migrate status` → phase15 migration applied
2. `pnpm --filter api tsc --noEmit` → exit 0
3. `pnpm --filter web tsc --noEmit` → exit 0
4. `pnpm --filter api vitest run src/modules/{guests,public-booking,email}/` → all pass (extended tests cover new fields)
5. `pnpm --filter web vitest run src/features/public-booking/` → all pass
6. Manual: submit reservation con todos los campos opcionales → verify Guest row has values + email contains preferences section
7. Manual: submit reservation con SOLO los campos requeridos → verify guest row has nulls + email omits preferences section
8. Manual: submit con `whatsappNumber: "abc"` → backend rejects 400 (Zod E.164)

### Claude's Discretion
- Whether `<Collapsible>` uses native `<details>` HTML or custom React state (recommend native `<details>` — zero deps, accessible by default, has built-in disclosure animation)
- Exact lucide icon choices for section headers (`MessageCircle` + `Heart` proposed but flexible)
- Whether to add a "Saltar este paso" link (recommend NO — sections already collapsed by default)
- Marketing consent default: false (opt-in) is locked per Colombian Habeas Data — DO NOT change to opt-out

</decisions>

<canonical_refs>
## Canonical References

### Existing backend code (extend, don't replace)
- `apps/api/prisma/schema.prisma` — Guest model lines ~95-115 (estimate; researcher will confirm)
- `apps/api/src/modules/guests/dto/create-guest.dto.ts` (40L) — extend Zod schema
- `apps/api/src/modules/guests/dto/update-guest.dto.ts` (21L) — extend
- `apps/api/src/modules/guests/guests.service.ts` (244L) — should not need changes (Prisma handles new fields automatically once schema updates)
- `apps/api/src/modules/public-booking/public-booking.controller.ts` — accept new fields in body (Phase 3)
- `apps/api/src/modules/public-booking/public-booking.service.ts` — pass new fields to GuestsService.create
- `apps/api/src/modules/email/email.service.ts` — line 134 buildConfirmationHtml extension

### Existing frontend code (extend, don't replace)
- `apps/web/src/features/public-booking/BookingFormPage.tsx` (240L) — add 2 collapsible sections
- `apps/web/src/components/ui/{input,textarea,button,card}.tsx` — Phase 9 + 13 primitives (reuse)
- Public booking API client — likely in `apps/web/src/features/public-booking/` (researcher confirms)

### Project requirements + roadmap
- `.planning/REQUIREMENTS.md` — GCC-01..05
- `.planning/ROADMAP.md` — Phase 15 section: 5 success criteria
- `.planning/PROJECT.md` — v1.3 milestone scope

### Dependencies (already installed)
- `prisma` v7 — schema + migration
- `zod` v4 — validation (existing pattern in `public-booking`)
- `react-hook-form` + `@hookform/resolvers/zod` — frontend form state (Phase 3 already uses this)
- `lucide-react` — icons
- `resend` v4 — email send (Phase 3 + 14 use it)

</canonical_refs>

<specifics>
## Specific Ideas

### Migration column types (Prisma → PostgreSQL)
- `preferredLanguage String @default("es")` → `VARCHAR DEFAULT 'es'`
- `contactPreference ContactPreference?` → new enum type `ContactPreference` + `contact_preference contact_preference_enum NULL`
- `whatsappNumber String?` → `VARCHAR NULL` (E.164 max 16 chars)
- `marketingConsent Boolean @default(false)` → `BOOLEAN DEFAULT false`
- `dietaryRestrictions String? @db.VarChar(500)` → `VARCHAR(500) NULL`
- `specialRequests String? @db.VarChar(1000)` → `VARCHAR(1000) NULL`

### Collapsible section pattern (native HTML)
```tsx
<details className="border border-warm-line rounded-lg overflow-hidden">
  <summary className="flex items-center gap-2 px-4 py-3 bg-warm-paper cursor-pointer hover:bg-warm-cream">
    <MessageCircle className="w-4 h-4 text-terracotta" />
    <span className="font-medium text-ink-1">Preferencias de contacto</span>
    <span className="ml-auto text-xs text-ink-3">(opcional)</span>
  </summary>
  <div className="p-4 space-y-4">
    {/* fields */}
  </div>
</details>
```

Native disclosure animation, accessible (`<summary>` is focusable), zero JS state needed.

### WhatsApp E.164 helper
- Input placeholder: `+57 300 123 4567` (Colombian default)
- Backend validates regex `^\+[1-9]\d{6,14}$` strict — Zod rejects bad format with 400
- Frontend: strip spaces before submit (allow user to type with spaces for readability)
- No country code selector dropdown for v1.3 — user types the `+` prefix (keeps form simple)

### Marketing consent legal text
"Quiero recibir ofertas y novedades del hotel. Puedo darme de baja en cualquier momento." (Colombian Habeas Data compliant — opt-in, revocable)

### Email preferences section conditional
The HTML template uses if/else logic via string concatenation in the JS function (not real template engine):
```ts
private buildPreferencesSection(guest: Guest): string {
  const parts: string[] = [];
  if (guest.whatsappNumber) parts.push(`<p>WhatsApp: <strong>${guest.whatsappNumber}</strong></p>`);
  if (guest.contactPreference) parts.push(`<p>Prefiere contacto por: <strong>${this.formatPreference(guest.contactPreference)}</strong></p>`);
  if (guest.dietaryRestrictions) parts.push(`<p>Restricciones: <em>${escapeHtml(guest.dietaryRestrictions)}</em></p>`);
  if (guest.specialRequests) parts.push(`<p>Solicitudes: <em>${escapeHtml(guest.specialRequests)}</em></p>`);
  if (parts.length === 0) return '';
  return `<div style="margin-top: 24px; ...">${parts.join('')}</div>`;
}
```
- `escapeHtml` to prevent XSS in user-provided text
- `formatPreference('WHATSAPP')` → "WhatsApp" (display label)

</specifics>

<deferred>
## Deferred Ideas

- **Guest detail page** — Phase 16
- **ContactButtons component** — Phase 16
- **guest_contact_events table + Socket.io push** — Phase 16
- **Email templates library** (welcome / pre-arrival / thank-you) — v1.4+
- **WhatsApp Business API** (templated outbound messages, not just deep links) — v1.4+
- **Country code dropdown for phone inputs** — v1.4 if too many international guests need it
- **i18n EN/ES toggle on portal** — separate v1.4+ milestone
- **Guest profile edit by guest** (self-service portal) — v2
- **Photo upload by guest** (profile pic) — v2
- **Dietary restrictions structured taxonomy** (vs free text) — v2 if data quality becomes an issue

</deferred>

---

*Phase: 15-extended-contact-capture*
*Context gathered: 2026-05-19 — milestone v1.3 Phase 1*
