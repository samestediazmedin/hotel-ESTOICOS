---
phase: 15-extended-contact-capture
plan: 02
subsystem: backend-integration
tags: [public-booking, email, zod, xss, phase15]
dependency_graph:
  requires:
    - 15-01 (ContactPreference enum + Guest schema + CreateGuestSchema extended)
  provides:
    - POST /api/public/bookings accepts 6 new optional fields
    - txResult.guest type widened with 4 preference fields
    - EmailService.BookingConfirmationParams extended with 4 optional nullable fields
    - buildPreferencesSection() conditional warm-paper HTML block
    - escapeHtml() + formatContactPreference() private helpers
  affects:
    - 15-03 (web) — email params shape finalized; public booking payload contract confirmed
tech_stack:
  added: []
  patterns:
    - GuestEmailFields type alias (inline narrowing) for txResult widening
    - buildPreferencesSection returns empty string when all 4 prefs falsy — backwards compat
    - escapeHtml applied only to free-text (dietaryRestrictions, specialRequests) — NOT to E.164 phone or enum
    - fire-and-forget email call preserved — no throws added inside helpers
key_files:
  created: []
  modified:
    - apps/api/src/modules/public-booking/dto/create-public-booking.dto.ts
    - apps/api/src/modules/public-booking/public-booking.service.ts
    - apps/api/src/modules/public-booking/public-booking.service.spec.ts
    - apps/api/src/modules/email/email.service.ts
    - apps/api/src/modules/email/email.service.spec.ts
decisions:
  - "txResult widened via local GuestEmailFields type alias (not Pick<Guest, ...>) — avoids Prisma import in service layer"
  - "escapeHtml inline (5 replacements) — no external lib; Node.js server-side, no DOM available"
  - "buildPreferencesSection: truthy check (not null-check) — empty string '' for guestWhatsApp does NOT render"
  - "marketingConsent excluded from BookingConfirmationParams — hotel-internal flag, confirmed not in email"
metrics:
  duration: "~20 min"
  completed_date: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 5
  tests_new: 13
  tests_total: 28
  tests_public_booking: 12
  tests_email: 16
requirements: [GCC-03, GCC-05]
---

# Phase 15 Plan 02: Public Booking Integration + Email Preferences Section + escapeHtml Summary

**One-liner:** POST /api/public/bookings now accepts 6 optional guest preference fields, persists them via explicit mapping, and the email confirmation renders a conditional warm-paper "Sus preferencias" block with XSS-escaped user text.

## DTO Fields Added (mirror of Wave 1)

`CreatePublicBookingSchema` extended with 6 optional fields — identical shapes to `CreateGuestSchema` (verified):

| Field | Zod Type | Default |
|-------|----------|---------|
| `preferredLanguage` | `z.enum(['es', 'en']).optional().default('es')` | `'es'` |
| `contactPreference` | `z.enum(['EMAIL', 'PHONE', 'WHATSAPP']).nullable().optional()` | `undefined` |
| `whatsappNumber` | `z.string().regex(/^\+[1-9]\d{6,14}$/).nullable().optional()` | `undefined` |
| `marketingConsent` | `z.boolean().optional().default(false)` | `false` |
| `dietaryRestrictions` | `z.string().max(500).nullable().optional()` | `undefined` |
| `specialRequests` | `z.string().max(1000).nullable().optional()` | `undefined` |

Shapes verified identical to `create-guest.dto.ts` output of 15-01.

## txResult Widening Approach (Research Trap #3)

Chosen: **local type alias `GuestEmailFields`** declared at the top of the `createBooking` method scope.

```typescript
type GuestEmailFields = {
  id: string; fullName: string; email: string | null;
  whatsappNumber: string | null;
  contactPreference: 'EMAIL' | 'PHONE' | 'WHATSAPP' | null;
  dietaryRestrictions: string | null;
  specialRequests: string | null;
};
let txResult: { guest: GuestEmailFields; reservation: { id: string } };
```

Alternative considered: `Pick<Guest, 'id' | 'fullName' | ...>` — rejected because it would import the Prisma `Guest` type into the service file, coupling the service layer to Prisma generated types. The local alias is explicit and self-documenting.

## escapeHtml Inline Implementation

No external library. 5 replacements cover all XSS vectors for inline HTML:

```typescript
private escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

Applied to: `guestDietaryRestrictions`, `guestSpecialRequests`.
NOT applied to: `guestWhatsApp` (E.164 validated — only `+` and digits), `guestContactPreference` (enum, server-controlled).

## buildPreferencesSection Insertion Point

Inserted in `buildConfirmationHtml` template string after `</table>` and before the "Si no recibes" spam-folder `<p>` paragraph:

```html
</table>
${this.buildPreferencesSection(params)}
<p style="font-size: 14px; color: #666;">
  Si no recibes este correo en 5 minutos...
</p>
```

When all 4 preference params are null/undefined/falsy, `buildPreferencesSection` returns `''` — no empty div rendered, no impact on existing email layout.

## Dedup Branch — Locked Decision

When `tx.guest.findFirst` returns an existing guest (email dedup), the new DTO preference fields are NOT written. The existing guest's values are returned unchanged and passed to the email. This preserves prior staff edits. Verified by test P15-5.

## Test Results

| Module | Pre-existing | New Phase 15 | Total |
|--------|-------------|--------------|-------|
| `public-booking.service.spec.ts` | 6 | 6 | 12 |
| `email.service.spec.ts` | 9 | 7 | 16 |
| **Total** | **15** | **13** | **28** |

### New Tests (public-booking)
- P15-1: Schema accepts valid E.164 whatsappNumber + contactPreference
- P15-2: Schema rejects invalid E.164 with error on whatsappNumber path
- P15-3: tx.guest.create receives all 6 new fields from DTO
- P15-4: Zod defaults applied when new fields absent (preferredLanguage:'es', marketingConsent:false, nulls)
- P15-5: Dedup path — existing guest returned, new DTO fields NOT written, email receives OLD values
- P15-6: sendBookingConfirmation called with 4 preference scalars; marketingConsent NOT in payload

### New Tests (email)
- P15-E1: No preferences → "Sus preferencias" absent from HTML
- P15-E2: guestWhatsApp set → section present, line "WhatsApp: <strong>+573001234567</strong>"
- P15-E3: All four fields → ≥4 `<p>` tags inside the section
- P15-E4: XSS in dietaryRestrictions → `&lt;script&gt;` escaped, raw `<script>` absent
- P15-E5: XSS in specialRequests → same escaping applied
- P15-E6: Enum label mapping — EMAIL→"Correo electrónico", PHONE→"Teléfono", WHATSAPP→"WhatsApp"
- P15-E7: Empty string guestWhatsApp (falsy) → section NOT rendered

## Deviations from Plan

None — plan executed exactly as written.

`bookingConfirmationParams.marketingConsent` verified absent (grep returns 0 matches in email.service.ts) — locked decision honored.

## Commits

| Hash | Message |
|------|---------|
| `ddad272` | feat(15-02): extend public-booking DTO + service + widen txResult type |
| `18f1996` | feat(15-02): buildPreferencesSection + escapeHtml + formatContactPreference in EmailService |

## Self-Check: PASSED

- `apps/api/src/modules/public-booking/dto/create-public-booking.dto.ts`: FOUND — contains `whatsappNumber`
- `apps/api/src/modules/public-booking/public-booking.service.ts`: FOUND — contains `GuestEmailFields`, `guestWhatsApp`, `preferredLanguage: dto.preferredLanguage ?? 'es'`
- `apps/api/src/modules/email/email.service.ts`: FOUND — contains `private escapeHtml`, `private formatContactPreference`, `private buildPreferencesSection`, `buildPreferencesSection(params)` (1 call)
- `marketingConsent` in `email.service.ts`: 0 matches (correct — excluded)
- commit ddad272: FOUND
- commit 18f1996: FOUND
- `pnpm --filter api tsc --noEmit`: exit 0
- `vitest run src/modules/public-booking/ src/modules/email/`: 28/28 PASSED
