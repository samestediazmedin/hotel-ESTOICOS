---
phase: 15-extended-contact-capture
plan: 03
subsystem: frontend-public-booking
tags: [react, zod, react-hook-form, collapsible, ley-1581, e164, phase15]
dependency_graph:
  requires: [15-01, 15-02]
  provides:
    - BookingFormPage.tsx with 2 native <details>/<summary> collapsible sections
    - guestFormSchema extended with 6 optional fields + WhatsApp E.164 transform
    - CreatePublicBookingPayload interface extended with 6 optional fields
    - Ley 1581 opt-in marketing consent (default false, exact legal label)
  affects:
    - POST /api/public/bookings payload (new optional fields passed through)
    - 15-04 (QA/visual verification plan)
tech_stack:
  added: []
  patterns:
    - Native <details>/<summary> for collapsible form sections (zero deps)
    - Zod .transform().pipe() chain for E.164 space-stripping before regex
    - Token discipline for new field errors (text-terracotta, NOT red palette)
    - defaultValues in useForm for opt-in compliance
key_files:
  created: []
  modified:
    - apps/web/src/features/public-booking/BookingFormPage.tsx
    - apps/web/src/features/public-booking/public-booking.api.ts
decisions:
  - "Used native <details>/<summary> — no Collapsible primitive exists in codebase; zero JS overhead"
  - "Zod .transform().pipe() pattern (not .refine()) for WhatsApp to allow space-trimming BEFORE validation"
  - "Pre-existing red error styling (bg-red-50, text-red-700) on server errors left as-is per scope decision; Phase 17 refactor"
  - "marketingConsent default false hardcoded in both Zod (.default(false)) and defaultValues — dual guard for Ley 1581"
metrics:
  duration: "~10 min"
  completed_date: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
  tests_new: 0
  tests_total: 0
requirements: [GCC-04]
---

# Phase 15 Plan 03: BookingFormPage 2 Collapsibles + Ley 1581 + WhatsApp E.164 Summary

**One-liner:** BookingFormPage extended with two native `<details>` collapsible sections, Zod schema extended with 6 optional fields including WhatsApp E.164 space-strip transform and Ley 1581-compliant marketing consent.

## Files Modified

### `apps/web/src/features/public-booking/BookingFormPage.tsx`

- **Original line count:** 240
- **Final line count:** 381 (~141 lines added; plan estimated ~80 — actual higher due to full label/helper text markup per spec)
- **Schema extension:** `guestFormSchema` now includes 6 new optional fields:
  - `preferredLanguage: z.enum(['es','en']).optional().default('es')`
  - `contactPreference: z.enum(['EMAIL','PHONE','WHATSAPP']).nullable().optional()`
  - `whatsappNumber: z.string().transform(...).pipe(...).optional()` — with space-strip transform
  - `marketingConsent: z.boolean().optional().default(false)`
  - `dietaryRestrictions: z.string().max(500, ...).optional()`
  - `specialRequests: z.string().max(1000, ...).optional()`
- **WhatsApp transform:** `.transform((v) => (v ?? '').replace(/\s/g, ''))` BEFORE `.pipe(z.string().refine(...))` — allows user to type `+57 300 123 4567` and backend receives `+573001234567`
- **Two `<details>` sections** inserted between "Información personal" fields and submit button
- **`useForm` defaultValues** updated with `preferredLanguage: 'es'` and `marketingConsent: false`
- **`onSubmit` handler** normalises empty optional strings to `undefined` before payload dispatch

### `apps/web/src/features/public-booking/public-booking.api.ts`

- `CreatePublicBookingPayload` interface extended with 6 optional Phase 15 fields (matching backend DTO shape exactly)

## Collapsible Sections

**Pattern:** Native HTML `<details>/<summary>` — confirmed absent in codebase research (no shadcn Collapsible primitive). Zero JavaScript state, accessible by default, keyboard-focusable summary.

**Safari triangle fix:** `list-none [&::-webkit-details-marker]:hidden` on `<summary>` — both guards applied per Pitfall #5.

### Section 1 — "Preferencias de contacto" (MessageCircle icon, terracotta)

| Field | Type | Notes |
|-------|------|-------|
| WhatsApp | `<input type="tel">` | Placeholder `+57 300 123 4567`; helper text below |
| Contacto preferido | 3 radio buttons | EMAIL / PHONE / WHATSAPP; `accent-terracotta` |
| Idioma preferido | 2 radio buttons | es / en; default Español |
| Marketing consent | `<input type="checkbox">` | DEFAULT UNCHECKED — Ley 1581 opt-in |

### Section 2 — "Preferencias adicionales" (Heart icon, terracotta)

| Field | Type | Notes |
|-------|------|-------|
| Restricciones dietarias | `<textarea rows={3}>` | `maxLength={500}` |
| Solicitudes especiales | `<textarea rows={4}>` | `maxLength={1000}` |

## Ley 1581 Compliance

- `marketingConsent` checkbox: **unchecked by default** (double-guarded: `z.boolean().default(false)` + `defaultValues.marketingConsent: false`)
- Label text (verbatim): "Quiero recibir ofertas y novedades del hotel. Puedo darme de baja en cualquier momento."
- No pre-checked state or implied opt-in anywhere in new code

## Token Discipline (New Sections Only)

All NEW field error elements use `text-terracotta` (5 occurrences: 2 icons + 3 error `<p>` elements).
Pre-existing server error styling (`bg-red-50 border-red-200 text-red-700`) is unchanged per scope decision — deferred to Phase 17.

## Verification

- `tsc --noEmit`: **EXIT 0**
- No `<Collapsible>` import introduced
- `rg "<details"` → 2 matches
- `rg "MessageCircle|Heart"` → 3 matches (import + 2 icons)
- `rg "text-terracotta"` → 5 matches
- Legal text `rg "Quiero recibir ofertas y novedades del hotel"` → 1 match (verbatim)
- WhatsApp transform: `.replace(/\s/g, '')` present in Zod `.transform()`

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

**Line count variance:** Final file is 381 lines vs estimated ~320-340 in plan output spec. Discrepancy is due to full label + helper text markup for each field (placeholder text, helper paragraphs). No functional deviation.

**Pre-existing red error styling:** Lines 178-186 and 203/210/214/229/235/244/250 retain `text-red-600 / bg-red-50 / border-red-200`. These are pre-Phase-11 leftovers. Per plan `<interfaces>` scope decision: not touched in this plan. Tracked for Phase 17.

## Commits

| Hash | Message |
|------|---------|
| `26baf0b` | feat(15-03): extend CreatePublicBookingPayload with 6 optional Phase 15 fields |
| `65bd171` | feat(15-03): add 2 collapsible sections + extended Zod schema + WhatsApp trim |

## Self-Check: PASSED

- `apps/web/src/features/public-booking/BookingFormPage.tsx`: FOUND (381 lines)
- `apps/web/src/features/public-booking/public-booking.api.ts`: FOUND (contains `whatsappNumber`)
- Commit `26baf0b`: FOUND
- Commit `65bd171`: FOUND
- `tsc --noEmit`: EXIT 0
- `<Collapsible>` import: ABSENT
- `<details` tags: 2 matches
- Legal text verbatim: 1 match
- `text-terracotta` count: 5 matches
