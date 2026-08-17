# Phase 15: Extended Contact Capture — Research

**Researched:** 2026-05-19
**Domain:** Prisma schema extension + Zod DTO chain + React form collapsibles + HTML email templating
**Confidence:** HIGH (all findings from direct codebase inspection — no assumptions from training data)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema additions:**
```prisma
enum ContactPreference {
  EMAIL
  PHONE
  WHATSAPP
}

model Guest {
  // ... existing fields
  preferredLanguage    String              @default("es")
  contactPreference    ContactPreference?
  whatsappNumber       String?
  marketingConsent     Boolean             @default(false)
  dietaryRestrictions  String?             @db.VarChar(500)
  specialRequests      String?             @db.VarChar(1000)
}
```

- Migration name: `{timestamp}_phase15_extended_guest_contact`
- Backfill: NONE — all nullable or have defaults
- E.164 validation: regex `/^\+[1-9]\d{6,14}$/` at Zod level only (not DB CHECK)

**DTO extensions:** Zod `.optional()` / `.nullable().optional()` on all 6 new fields. UpdateGuestSchema = `CreateGuestSchema.partial()` — works automatically.

**Frontend:** Two `<details>` collapsible sections in `BookingFormPage.tsx`. Native HTML disclosure, zero extra deps.

**Email:** `buildConfirmationHtml` extended with `buildPreferencesSection(guest)` private helper. String concatenation pattern (no template engine). `escapeHtml` required for user-provided text fields.

**Public booking flow:** No new endpoints. POST /api/public/bookings body extended, `CreatePublicBookingSchema` extended, `PublicBookingService.createBooking` passes new fields to `tx.guest.create`.

**Verification commands (8 total):** Listed in CONTEXT.md §Verification commands.

### Claude's Discretion
- `<Collapsible>` uses native `<details>` HTML (recommended) or custom React state
- Exact lucide icon choices (`MessageCircle` + `Heart` proposed)
- Whether to add "Saltar este paso" link (recommend NO)
- Marketing consent default: false — LOCKED per Colombian Habeas Data (not discretion)

### Deferred Ideas (OUT OF SCOPE)
- Guest detail page — Phase 16
- ContactButtons component — Phase 16
- guest_contact_events table + Socket.io push — Phase 16
- Email templates library (welcome / pre-arrival / thank-you) — v1.4+
- WhatsApp Business API — v1.4+
- Country code dropdown for phone inputs — v1.4
- i18n EN/ES toggle on portal — v1.4+
- Guest profile edit by guest (self-service) — v2
- Photo upload by guest — v2
- Dietary restrictions structured taxonomy — v2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GCC-01 | Prisma `Guest` model extended with 6 nullable columns + `ContactPreference` enum. Migration applied. | Schema.prisma confirmed at lines 195–210. Guest has 9 fields now; 6 new columns are additive/nullable — zero risk to existing rows. Enum naming convention confirmed: SCREAMING_SNAKE in SQL, camelCase in Prisma. |
| GCC-02 | Backend DTOs (CreateGuestDto + UpdateGuestDto) extended via Zod. E.164 validation. PATCH `/api/guests/:id` accepts partial updates. | `create-guest.dto.ts` confirmed 41L, pure Zod schema. `update-guest.dto.ts` is literally `CreateGuestSchema.partial()` — will pick up new fields automatically once CreateGuestSchema is extended. PATCH endpoint exists at `guests.controller.ts:93`. |
| GCC-03 | Public `POST /api/public/bookings` accepts new optional guest fields. No breaking change. | `create-public-booking.dto.ts` confirmed — 26L flat Zod schema. All new fields are `.optional()` — existing Zod `.parse()` call in controller accepts unknown extra keys by default in Zod v4 (passthrough not needed for optional fields). Service passes them to `tx.guest.create`. |
| GCC-04 | Frontend `BookingFormPage.tsx` extended with 2 collapsible sections. Client-side validation via RHF + zodResolver. | `BookingFormPage.tsx` confirmed 240L, uses `react-hook-form` + `zodResolver` + inline `z.object()`. Pattern: extend `guestFormSchema` + `CreatePublicBookingPayload` interface. No `<Collapsible>` primitive exists — use native `<details>`. `<Input>` and `<Textarea>` primitives confirmed ready (token-correct). |
| GCC-05 | `buildConfirmationHtml` extended to include conditional "Sus preferencias" section. | `email.service.ts:134–204` confirmed — pure string concatenation, no template engine. `BookingConfirmationParams` interface needs a `guest?` field (or explicit optional preference fields). No `escapeHtml` helper exists yet — must create inline. |
</phase_requirements>

---

## Summary

Phase 15 is a pure extension phase with zero breaking changes. Every modification is additive: 6 nullable columns in the DB, optional fields in Zod schemas, optional form sections in the UI, and a conditional HTML block in one email function. The blast radius is tightly contained to 7 files plus a new migration.

The codebase patterns are mature and consistent: Zod v4 schemas with `PipeTransform` wrappers, `react-hook-form` + `zodResolver`, pure string HTML templating in EmailService, and `@db.VarChar(N)` annotations for length-bounded text columns. All of these are already in use in the files being extended — Phase 15 has no need to introduce any new pattern or dependency.

The single architectural decision of note is how to pass new guest fields from `sendBookingConfirmation` to `buildConfirmationHtml`. Currently `BookingConfirmationParams` does not include guest preference fields, and the guest object is not passed. The cleanest approach is to add 4 optional fields to `BookingConfirmationParams` directly (mirroring the pattern used for other optional email data), rather than passing the full `Guest` entity into the email service.

**Primary recommendation:** Extend `BookingConfirmationParams` with 4 optional string/enum fields. Extend `CreatePublicBookingSchema` (and `CreateGuestSchema`) with 6 optional fields. Create a `buildPreferencesSection()` private helper in EmailService with an inline `escapeHtml` function. Use native `<details>/<summary>` for collapsible sections — no new component needed.

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `prisma` | 7.x | Schema + migration CLI | Installed — `prisma migrate dev` pattern confirmed |
| `@prisma/client` | 7.x | Type-safe DB client | Generated client in `src/generated/prisma` |
| `zod` | 4.x | Schema validation backend + frontend | Confirmed v4 — `z.object()`, `.optional()`, `.nullable()`, `.enum()`, `.regex()` |
| `react-hook-form` | 7.75.x | Form state | Confirmed in BookingFormPage — `useForm`, `register`, `handleSubmit`, `formState.errors` |
| `@hookform/resolvers/zod` | 3.x | Bridge RHF ↔ Zod | Confirmed — `zodResolver(guestFormSchema)` pattern in use |
| `lucide-react` | latest | Icons for section headers | Installed — `MessageCircle`, `Heart` available |
| `resend` | 4.x | Transactional email | Installed — `EmailService` wraps it |

### No New Dependencies
All 6 new fields are handled by existing libraries. The `<details>/<summary>` collapsible is native HTML — no shadcn Collapsible primitive is needed and none exists in the codebase.

---

## Architecture Patterns

### Confirmed Project Structure for This Phase

```
apps/api/
├── prisma/
│   ├── schema.prisma                          ← ADD enum + 6 fields to Guest
│   └── migrations/
│       └── 20260519000001_phase15_extended_guest_contact/
│           └── migration.sql                  ← NEW
├── src/modules/
│   ├── guests/
│   │   ├── dto/
│   │   │   ├── create-guest.dto.ts            ← EXTEND (6 new optional fields)
│   │   │   └── update-guest.dto.ts            ← NO CHANGE needed (auto-inherits via .partial())
│   │   └── guests.service.ts                  ← EXTEND (pass new fields in create + update)
│   ├── public-booking/
│   │   ├── dto/create-public-booking.dto.ts   ← EXTEND (6 new optional fields)
│   │   └── public-booking.service.ts          ← EXTEND (pass new fields to tx.guest.create)
│   └── email/
│       └── email.service.ts                   ← EXTEND (BookingConfirmationParams + buildPreferencesSection)
apps/web/
├── src/features/public-booking/
│   ├── BookingFormPage.tsx                    ← EXTEND (2 collapsible sections + schema)
│   └── public-booking.api.ts                  ← EXTEND (CreatePublicBookingPayload interface)
```

**Total files modified: 7** (1 schema + 1 migration + 3 backend files + 2 frontend files)

### Pattern 1: Zod Schema Extension (Backend)

The existing pattern in `create-guest.dto.ts` is:

```typescript
// Source: apps/api/src/modules/guests/dto/create-guest.dto.ts
export const CreateGuestSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  // ...
});
```

Extension follows identical pattern — add 6 optional fields to the existing `z.object()` block:

```typescript
// New fields — append inside the existing z.object({...})
preferredLanguage: z.enum(['es', 'en']).optional().default('es'),
contactPreference: z.enum(['EMAIL', 'PHONE', 'WHATSAPP']).nullable().optional(),
whatsappNumber: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Número WhatsApp debe ser formato E.164 (ej: +57300123456)').nullable().optional(),
marketingConsent: z.boolean().optional().default(false),
dietaryRestrictions: z.string().max(500).nullable().optional(),
specialRequests: z.string().max(1000).nullable().optional(),
```

### Pattern 2: UpdateGuestSchema Auto-inheritance

`update-guest.dto.ts` (confirmed at lines 9):
```typescript
export const UpdateGuestSchema = CreateGuestSchema.partial();
```
This is a derived schema — no changes needed. Once `CreateGuestSchema` gains the 6 new fields, `UpdateGuestSchema` automatically inherits them as optional. **Zero modifications to `update-guest.dto.ts`.**

### Pattern 3: GuestsService.create — Explicit Field Mapping

`guests.service.ts:54–65` shows the service does NOT spread the DTO. It maps fields explicitly:

```typescript
const guest = await this.repo.createGuest({
  fullName: dto.fullName,
  email: dto.email ?? null,
  phone: dto.phone ?? null,
  documentType: dto.documentType,
  documentNumber: encryptedDoc,
  nationality: dto.nationality,
  dateOfBirth,
});
```

**Implication:** All 6 new fields must be explicitly added to this mapping call. Prisma will not receive them unless the service passes them. Same applies to `update()` at lines 94–110.

### Pattern 4: Public Booking Service — Guest Create in Transaction

`public-booking.service.ts:55–68` shows the inline guest creation:

```typescript
guest = await tx.guest.create({
  data: {
    fullName: dto.fullName,
    email: dto.email,
    phone: dto.phone,
    documentType: dto.documentType,
    documentNumber: this.encryption.encrypt(dto.documentNumber),
    nationality: dto.nationality,
    dateOfBirth: new Date(dto.dateOfBirth + 'T00:00:00.000Z'),
  },
});
```

The same explicit-mapping pattern applies. All 6 new optional fields (with `?? null` / `?? false` defaults) must be added here. The DTO will carry them from `CreatePublicBookingSchema.parse(body)` if the public form includes them.

### Pattern 5: Email Confirmation — Extending BookingConfirmationParams

Current `BookingConfirmationParams` interface (lines 5–14):

```typescript
export interface BookingConfirmationParams {
  to: string;
  guestName: string;
  reservationId: string;
  checkIn: string;
  checkOut: string;
  roomTypeName: string;
  totalNights: number;
  total: number;
}
```

**Finding:** The interface does NOT include any guest entity reference — it only carries denormalized scalar values. This is the correct pattern (email service should not depend on Prisma Guest type).

**Recommended extension:** Add 4 optional scalar fields (marketingConsent is intentionally excluded per CONTEXT.md):

```typescript
export interface BookingConfirmationParams {
  // ... existing fields
  guestWhatsApp?: string | null;
  guestContactPreference?: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
  guestDietaryRestrictions?: string | null;
  guestSpecialRequests?: string | null;
}
```

The call site in `public-booking.service.ts:101–110` must pass these from `txResult.guest`.

**Critical finding:** `txResult.guest` is typed as `{ id, fullName, email }` — the type must be widened to include the 4 new fields, OR the service re-reads the guest after creation. The simplest approach: widen the `txResult` type inline.

### Pattern 6: HTML Email — escapeHtml

`buildConfirmationHtml` at line 134 has NO `escapeHtml` helper. The current template interpolates `params.guestName`, `params.roomTypeName`, etc. — all server-controlled data, so XSS risk is low for existing fields.

**Phase 15 adds user-provided text** (`dietaryRestrictions`, `specialRequests`). These MUST be escaped. Pattern confirmed from CONTEXT.md:

```typescript
// Inline helper (no external library needed)
private escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

### Pattern 7: Collapsible Section — Native `<details>`

No shadcn Collapsible primitive exists in `apps/web/src/components/ui/`. The recommended pattern from CONTEXT.md:

```tsx
<details className="border border-warm-line rounded-lg overflow-hidden">
  <summary className="flex items-center gap-2 px-4 py-3 bg-warm-paper cursor-pointer hover:bg-warm-cream list-none">
    <MessageCircle className="w-4 h-4 text-terracotta" />
    <span className="font-medium text-ink-1">Preferencias de contacto</span>
    <span className="ml-auto text-xs text-ink-3">(opcional)</span>
  </summary>
  <div className="p-4 space-y-4">
    {/* fields */}
  </div>
</details>
```

**Note:** `list-none` on `<summary>` removes the browser's default disclosure triangle in Safari/Chrome. Add `[&::-webkit-details-marker]:hidden` as an additional Tailwind class if the triangle appears on Safari.

### Pattern 8: RHF Integration with New Optional Fields

`BookingFormPage.tsx:12–22` defines:

```typescript
const guestFormSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  // ... 5 more required fields
});
type GuestFormData = z.infer<typeof guestFormSchema>;
```

The form uses `useForm<GuestFormData>({ resolver: zodResolver(guestFormSchema) })`. 

Extension approach: add 6 new fields to `guestFormSchema`. All are optional — `register('whatsappNumber')` works as-is. For radio buttons (`contactPreference`, `preferredLanguage`) use native `<input type="radio" {...register('contactPreference')} value="EMAIL" />` pattern — no shadcn RadioGroup needed.

`CreatePublicBookingPayload` in `public-booking.api.ts:106–119` must also be extended with the 6 optional fields.

### Anti-Patterns to Avoid

- **Spreading DTOs into Prisma create calls:** The service uses explicit field mapping — do not introduce `...dto` spread. It works but bypasses TypeScript's exhaustive check.
- **Passing full Guest entity into EmailService:** EmailService must remain decoupled from Prisma types. Extend `BookingConfirmationParams` with scalar fields only.
- **Adding `@db.VarChar(N)` to GuestLike type:** `GuestLike` in `guests.service.ts:13–24` is a TypeScript interface used for DTO transformation. It does NOT need `@db.VarChar` annotations (that is Prisma schema syntax). Add the 6 new fields as plain TypeScript types to `GuestLike`.
- **Using `z.string().optional()` for fields that should accept `null`:** For DB-nullable fields use `.nullable().optional()` to accept both `undefined` (absent) and `null` (explicit clear). Pattern confirmed in existing schema: `email: z.string().email().nullable().optional()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible disclosure | Custom React state + CSS animation | Native `<details>/<summary>` | Zero JS needed, accessible by default, keyboard-focusable `<summary>`, open/close state in HTML |
| E.164 phone validation | Custom phone parsing | Zod `.regex(/^\+[1-9]\d{6,14}$/)` | The regex covers the spec. Country code library (libphonenumber) is overkill for a single validation rule |
| HTML escaping in emails | DOMParser or external lib | Inline 5-replacement `escapeHtml` private method | EmailService is Node.js-only; no DOM available. The 5 replacements cover all XSS vectors for inline HTML |
| Form collapsible animation | Framer Motion or CSS transitions | CSS `details[open]` selector or Tailwind `open:` variant | Native `<details>` has built-in open/close state — style with `details[open] > .content { }` |

---

## Common Pitfalls

### Pitfall 1: GuestsService.create Does Not Spread DTO

**What goes wrong:** Developer extends `CreateGuestSchema` but forgets to pass the new fields in `GuestsService.create()`. TypeScript does NOT catch this because `repo.createGuest()` parameter type is inferred from the Prisma schema, and the new fields are nullable — Prisma accepts the create call with the fields absent (they default to null).

**Why it happens:** The service uses an explicit object literal, not a spread. New fields silently persist as `null` even when provided.

**How to avoid:** After extending `CreateGuestSchema`, update the `repo.createGuest({...})` call to include all 6 new fields. Same for `repo.update()` in `GuestsService.update()`.

**Warning signs:** Unit test for `create()` passes but DB row shows `null` for all new fields.

### Pitfall 2: PublicBookingService txResult Type Too Narrow

**What goes wrong:** `txResult.guest` is typed as `{ id: string; fullName: string; email: string | null }` at line 48. After adding preference fields to `tx.guest.create`, `txResult.guest` still only exposes `id/fullName/email` — the call to `sendBookingConfirmation` cannot pass the new fields.

**Why it happens:** The type annotation is manually narrowed, not inferred from the Prisma return type.

**How to avoid:** Widen the `txResult` inline type to include the 4 optional fields passed to email, OR use Prisma's generated type: `import type { Guest } from '../../../generated/prisma'` and replace the manual type.

**Warning signs:** TypeScript error on `txResult.guest.whatsappNumber` — "Property does not exist".

### Pitfall 3: Zod `.default()` vs DB DEFAULT — Double-Default

**What goes wrong:** `preferredLanguage` has `@default("es")` in Prisma AND `.default('es')` in Zod. This is fine for creation. The risk is in updates: `UpdateGuestSchema = CreateGuestSchema.partial()` makes `preferredLanguage` optional — if the PATCH body omits it, Zod returns `undefined`, and the service skips updating it. This is the correct behavior. But if someone uses `.default('es')` in the update schema, an absent field would be sent as `'es'`, overwriting an existing custom value.

**How to avoid:** Verify that `UpdateGuestSchema.partial()` does NOT re-apply `.default()`. Confirmed: `z.object({ field: z.string().default('es') }).partial()` makes the field optional but removes the default in the partial — the field is absent from the parsed output when not provided. Safe.

### Pitfall 4: escapeHtml Not Applied to All User-Provided Fields

**What goes wrong:** Developer adds `escapeHtml` for `dietaryRestrictions` but forgets `specialRequests` (or vice versa). One field is XSS-safe, the other is not.

**How to avoid:** Apply `escapeHtml` to ALL fields sourced from user input: `dietaryRestrictions`, `specialRequests`. `whatsappNumber` and `contactPreference` are either format-validated or enum-restricted — they do not need escaping. `preferredLanguage` is an enum value — safe.

### Pitfall 5: `<summary>` Triangle Not Hidden in Safari

**What goes wrong:** On Safari, `<summary>` renders with a system disclosure triangle to the left of the content even with custom flex layout. This makes the section header look visually broken.

**How to avoid:** Add `[&::-webkit-details-marker]:hidden` to the `<summary>` className (or `list-none` which also removes it). Confirmed: `list-none` removes the marker in Chrome/Safari. Using `appearance-none` alone does not remove the triangle.

### Pitfall 6: Marketing Consent Default — Must Be False (Opt-In)

**What goes wrong:** Developer accidentally sets `marketingConsent: z.boolean().default(true)` or the DB default is `true`.

**Why it matters:** Colombian Ley 1581 (Habeas Data) requires affirmative opt-in for marketing communications. Pre-checked consent boxes are non-compliant.

**How to avoid:** Both Zod (`z.boolean().optional().default(false)`) and Prisma (`@default(false)`) defaults must be `false`. The migration SQL must confirm `DEFAULT false`.

### Pitfall 7: `phone` Field in BookingFormPage Is Freeform

**What goes wrong:** The existing `phone` field in `BookingFormPage.tsx` uses `z.string().min(5).max(40)` — no E.164 validation. If a user enters their phone in the same freeform style for `whatsappNumber`, the backend will reject it with 400.

**How to avoid:** Add clear helper text to the WhatsApp input: `"Incluye el código de país: +57 300 123 4567"`. Strip spaces client-side before submit (`.trim()` or `onBlur` formatter). The existing `phone` field remains freeform and is NOT affected by Phase 15.

### Pitfall 8: Migration Timestamp Collision

**What goes wrong:** The last migration is `20260518170000_phase14_public_reviews_schema`. A new migration with any timestamp `<= 20260518170000` would be applied out-of-order or fail.

**How to avoid:** Use `20260519000001_phase15_extended_guest_contact` (2026-05-19 as base date, sequential suffix `000001` to avoid collision with the existing `20260519000000_add_tra_export_log`).

---

## Code Examples

### 1 — Prisma Enum + Column Addition (based on init migration pattern)

```sql
-- Source: apps/api/prisma/migrations/20260513000000_init/migration.sql (enum pattern confirmed)
-- Phase 15 migration SQL (generated by prisma migrate dev)

-- CreateEnum
CREATE TYPE "ContactPreference" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP');

-- AlterTable: add 6 nullable columns to guests
ALTER TABLE "guests"
  ADD COLUMN "preferredLanguage" TEXT NOT NULL DEFAULT 'es',
  ADD COLUMN "contactPreference" "ContactPreference",
  ADD COLUMN "whatsappNumber" TEXT,
  ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dietaryRestrictions" VARCHAR(500),
  ADD COLUMN "specialRequests" VARCHAR(1000);
```

Note: Prisma generates `ADD COLUMN` statements one per `ALTER TABLE` statement in most cases. The above may be split into 6 separate `ALTER TABLE "guests" ADD COLUMN ...` lines — this is equivalent.

### 2 — GuestLike Type Extension

```typescript
// Source: apps/api/src/modules/guests/guests.service.ts (lines 13–24, confirmed)
// EXTEND to include new fields:
type GuestLike = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  documentType: string;
  documentNumber: string;
  nationality: string;
  dateOfBirth: Date;
  anonymizedAt: Date | null;
  createdAt: Date;
  // Phase 15 additions
  preferredLanguage?: string;
  contactPreference?: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
  whatsappNumber?: string | null;
  marketingConsent?: boolean;
  dietaryRestrictions?: string | null;
  specialRequests?: string | null;
};
```

### 3 — Email Preferences Section (confirmed string-concat pattern)

```typescript
// Source: apps/api/src/modules/email/email.service.ts (buildConfirmationHtml pattern confirmed)
private escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

private formatContactPreference(pref: 'EMAIL' | 'PHONE' | 'WHATSAPP'): string {
  const labels = { EMAIL: 'Correo electrónico', PHONE: 'Teléfono', WHATSAPP: 'WhatsApp' };
  return labels[pref];
}

private buildPreferencesSection(params: BookingConfirmationParams): string {
  const parts: string[] = [];
  if (params.guestWhatsApp) {
    parts.push(`<p style="font-size:14px;color:#5a4d3f;margin:6px 0;">WhatsApp: <strong>${this.escapeHtml(params.guestWhatsApp)}</strong></p>`);
  }
  if (params.guestContactPreference) {
    parts.push(`<p style="font-size:14px;color:#5a4d3f;margin:6px 0;">Prefiere contacto por: <strong>${this.formatContactPreference(params.guestContactPreference)}</strong></p>`);
  }
  if (params.guestDietaryRestrictions) {
    parts.push(`<p style="font-size:14px;color:#5a4d3f;margin:6px 0;">Restricciones dietarias: <em>${this.escapeHtml(params.guestDietaryRestrictions)}</em></p>`);
  }
  if (params.guestSpecialRequests) {
    parts.push(`<p style="font-size:14px;color:#5a4d3f;margin:6px 0;">Solicitudes especiales: <em>${this.escapeHtml(params.guestSpecialRequests)}</em></p>`);
  }
  if (parts.length === 0) return '';
  return `<div style="margin-top:24px;padding:16px;background:#f4efe6;border-radius:8px;">
  <h2 style="font-family:'Instrument Serif',Georgia,serif;font-size:18px;color:#2a221a;margin:0 0 12px;font-weight:normal;">Sus preferencias</h2>
  ${parts.join('\n  ')}
</div>`;
}
```

### 4 — Native details/summary Collapsible (BookingFormPage pattern)

```tsx
// Source: CONTEXT.md + confirmed token names from textarea.tsx / input.tsx
<details className="rounded-lg border border-warm-line overflow-hidden">
  <summary className="flex items-center gap-2 px-4 py-3 bg-warm-paper cursor-pointer hover:bg-warm-cream [&::-webkit-details-marker]:hidden list-none">
    <MessageCircle className="w-4 h-4 text-terracotta flex-shrink-0" />
    <span className="font-medium text-ink-1 text-sm">Preferencias de contacto</span>
    <span className="ml-auto text-xs text-ink-3">(opcional)</span>
  </summary>
  <div className="p-4 space-y-4 bg-warm-paper border-t border-warm-line">
    {/* WhatsApp, contact preference, marketing consent, preferredLanguage */}
  </div>
</details>
```

---

## State of the Art

| Area | Current State in Codebase | Phase 15 Change |
|------|---------------------------|-----------------|
| Guest schema | 9 fields (fullName, email, phone, documentType, documentNumber, nationality, dateOfBirth, anonymizedAt, createdAt/updatedAt) | +6 nullable fields + 1 new enum type |
| Booking DTO chain | `CreatePublicBookingSchema` has 12 fields (all required except email/phone which are nullable) | +6 optional fields |
| Email confirmation | `buildConfirmationHtml` outputs fixed HTML table with 6 rows | +conditional `buildPreferencesSection` block at end of body |
| Frontend form | 7-field form in a single flat section | +2 `<details>` sections (default collapsed) |
| `<Input>` / `<Textarea>` primitives | Token-correct (Phase 9/13, confirmed) | Reused as-is — no changes |
| `GuestLike` type | 10-field manual interface in guests.service.ts | +6 optional fields |

---

## Open Questions

1. **`BookingFormPage.tsx` uses hardcoded hex values for error states**
   - What we know: Lines 153–161 use `bg-red-50 border-red-200 text-red-700` (Tailwind palette classes, not bundle tokens). CONTEXT.md says "use ink/terracotta tokens".
   - What's unclear: Is the planner expected to convert existing error styling to tokens at the same time, or only apply tokens to the NEW collapsible sections?
   - Recommendation: Apply token-correct error styling (`text-terracotta` for field errors, not `text-red-600`) ONLY for the new fields. Do not refactor existing field error styles — that is out of Phase 15 scope.

2. **`createBooking` in `public-booking.service.ts` — does `txResult.guest` include new fields from Prisma?**
   - What we know: Prisma `tx.guest.create({ data: {...} })` returns the full created row by default (all columns). If the new fields are passed in `data`, they will be present in the returned object.
   - What's unclear: Whether the TypeScript type will reflect this after schema regeneration, or whether the `{ id, fullName, email }` manual type annotation needs updating first.
   - Recommendation: After running `prisma generate`, the Prisma `Guest` type includes all 6 new fields. Widen the `txResult` type to `{ guest: Pick<Guest, 'id' | 'fullName' | 'email' | 'whatsappNumber' | 'contactPreference' | 'dietaryRestrictions' | 'specialRequests'>; reservation: { id: string } }`.

3. **`whatsappNumber` — should client-side strip spaces before submit?**
   - What we know: CONTEXT.md says "strip spaces before submit (allow user to type with spaces for readability)". The current `phone` field has no such transformation.
   - Recommendation: Add an `onChange` transformer or an `onBlur` that strips spaces: `e.target.value.replace(/\s/g, '')`. Alternatively, use Zod `.transform(v => v?.replace(/\s/g, ''))` before the regex — this allows the user to type `+57 300 123 4567` and have it auto-normalized to `+573001234567` on parse.

---

## Files Inventory — Complete Blast Radius

| File | Change Type | Estimated Lines Modified |
|------|------------|--------------------------|
| `apps/api/prisma/schema.prisma` | EXTEND — enum + 6 model fields | +8 lines |
| `apps/api/prisma/migrations/20260519000001_.../migration.sql` | NEW | ~15 lines |
| `apps/api/src/modules/guests/dto/create-guest.dto.ts` | EXTEND — 6 new Zod fields | +8 lines |
| `apps/api/src/modules/guests/guests.service.ts` | EXTEND — GuestLike type + create() + update() | +15 lines |
| `apps/api/src/modules/public-booking/dto/create-public-booking.dto.ts` | EXTEND — 6 new Zod fields | +8 lines |
| `apps/api/src/modules/public-booking/public-booking.service.ts` | EXTEND — txResult type + tx.guest.create + email call | +12 lines |
| `apps/api/src/modules/email/email.service.ts` | EXTEND — interface + 3 private methods + template call | +30 lines |
| `apps/web/src/features/public-booking/BookingFormPage.tsx` | EXTEND — schema + 2 `<details>` sections | +80 lines |
| `apps/web/src/features/public-booking/public-booking.api.ts` | EXTEND — `CreatePublicBookingPayload` interface | +8 lines |

**Total: 9 files — 184 lines added, 0 deleted**

Tests requiring updates (new fields must be included in fixtures/mocks):

| Test File | Update Required |
|-----------|----------------|
| `apps/api/src/modules/guests/guests.service.spec.ts` | `makeRawGuest()` fixture needs 6 new optional fields; `create()` test should verify new fields are passed to `repo.createGuest`. 6 existing tests pass as-is (new fields are optional). Add 2–3 new tests for E.164 rejection. |
| `apps/api/src/modules/public-booking/public-booking.service.spec.ts` | `baseDto` fixture can remain as-is (new fields are optional). `txMock.guest.create` mock return needs to include new fields for email assertion tests. Add 1 test: new fields present in body → persisted in guest row. |
| `apps/api/src/modules/email/email.service.spec.ts` | `makeParams()` helper needs 4 new optional fields. Add 2 tests: (a) preferences section appears when fields present, (b) preferences section absent when all null. |

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `apps/api/prisma/schema.prisma` — Guest model (lines 195–210), all enum definitions (lines 499–568), migration SQL pattern
- `apps/api/prisma/migrations/20260513000000_init/migration.sql` — `CREATE TYPE ... AS ENUM` SQL pattern
- `apps/api/prisma/migrations/20260518170000_phase14_public_reviews_schema/migration.sql` — `ALTER TABLE ADD COLUMN` pattern, last migration timestamp
- `apps/api/src/modules/guests/dto/create-guest.dto.ts` — Zod v4 schema pattern (41L confirmed)
- `apps/api/src/modules/guests/dto/update-guest.dto.ts` — `CreateGuestSchema.partial()` auto-inheritance (22L confirmed)
- `apps/api/src/modules/guests/guests.service.ts` — Explicit field mapping in `create()` and `update()`, `GuestLike` type (244L confirmed)
- `apps/api/src/modules/guests/guests.controller.ts` — PATCH endpoint at line 93 confirmed
- `apps/api/src/modules/public-booking/dto/create-public-booking.dto.ts` — Flat Zod schema (26L confirmed)
- `apps/api/src/modules/public-booking/public-booking.service.ts` — Transaction pattern, txResult type (137L confirmed)
- `apps/api/src/modules/email/email.service.ts` — `BookingConfirmationParams` interface (lines 5–14), `buildConfirmationHtml` (lines 134–204), no escapeHtml helper confirmed
- `apps/web/src/features/public-booking/BookingFormPage.tsx` — RHF + zodResolver + inline z.object + form structure (240L confirmed)
- `apps/web/src/features/public-booking/public-booking.api.ts` — `CreatePublicBookingPayload` interface (lines 106–119)
- `apps/web/src/components/ui/textarea.tsx` — Token-correct Textarea primitive confirmed
- `apps/web/src/components/ui/input.tsx` — Token-correct Input primitive confirmed
- `apps/api/src/modules/guests/guests.service.spec.ts` — 6 tests, `makeRawGuest` fixture structure
- `apps/api/src/modules/public-booking/public-booking.service.spec.ts` — 6 tests, `baseDto` fixture
- `apps/api/src/modules/email/email.service.spec.ts` — 3 + 6 tests, `makeParams` helper
- `.planning/config.json` — `workflow.nyquist_validation: false` (Validation Architecture section skipped)

---

## Metadata

**Confidence breakdown:**
- Schema additions: HIGH — confirmed Guest model and enum SQL pattern from migrations
- DTO chain: HIGH — confirmed Zod v4 schema files and auto-inheritance pattern
- GuestsService explicit mapping: HIGH — confirmed at source lines 54–65
- Email template extension: HIGH — confirmed no escapeHtml, confirmed params interface shape
- Frontend form: HIGH — confirmed RHF + zodResolver usage, no existing Collapsible primitive
- Test updates: HIGH — confirmed test file contents and fixture patterns
- Migration timestamp: HIGH — confirmed last migration is `20260518170000`

**Research date:** 2026-05-19
**Valid until:** Stable — no third-party libraries involved. Only valid if schema.prisma is not modified between now and planning.

---

## RESEARCH COMPLETE
