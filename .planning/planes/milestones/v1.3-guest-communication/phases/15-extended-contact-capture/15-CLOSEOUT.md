# Phase 15 Closeout — Extended Contact Capture

**Completed:** 2026-05-19
**Status:** ✓ Complete — all 5 GCC-IDs verified
**Plans:** 4/4 done | **Commits:** 10 | **Files:** 22 modified/created

## Requirements verified

| REQ-ID | Description | Plan(s) |
|--------|-------------|---------|
| ✓ GCC-01 | Guest schema +6 columns + ContactPreference enum + migration | 15-01 |
| ✓ GCC-02 | CreateGuestSchema Zod extended + GuestsService explicit mapping + PATCH /api/guests/:id | 15-01 |
| ✓ GCC-03 | CreatePublicBookingSchema accepts new fields + txResult widened | 15-02 |
| ✓ GCC-04 | BookingFormPage 2 collapsible sections + Ley 1581 opt-in + WhatsApp E.164 trim | 15-03 |
| ✓ GCC-05 | buildPreferencesSection conditional in confirmation email + escapeHtml anti-XSS | 15-02 |

## Deliverables

### Backend (apps/api)
- `prisma/schema.prisma` — Guest model extended (preferredLanguage, contactPreference, whatsappNumber, marketingConsent, dietaryRestrictions, specialRequests) + new ContactPreference enum
- `prisma/migrations/20260526000000_phase15_extended_guest_contact/migration.sql` — applied to Railway DB
- `src/modules/guests/dto/create-guest.dto.ts` — extended Zod schema with E.164 regex validation
- `src/modules/guests/guests.service.ts` — explicit field mapping in create + update (research trap #1)
- `src/modules/guests/guests.repository.ts` — explicit mapping at repository layer
- `src/modules/guests/guests.service.spec.ts` — extended tests for new fields
- `src/modules/public-booking/dto/create-public-booking.dto.ts` — accepts 6 new fields
- `src/modules/public-booking/public-booking.service.ts` — explicit tx.guest.create mapping + txResult type widened
- `src/modules/public-booking/public-booking.service.spec.ts` — extended tests
- `src/modules/email/email.service.ts` — BookingConfirmationParams +4 scalars + escapeHtml + formatContactPreference + buildPreferencesSection
- `src/modules/email/email.service.spec.ts` — extended tests covering XSS escape + empty preferences case

### Frontend (apps/web)
- `src/features/public-booking/BookingFormPage.tsx` — 240→381 lines, 2 native `<details>` sections
- `src/features/public-booking/booking.api.ts` (or similar) — CreatePublicBookingPayload type extended
- Zod guestFormSchema — WhatsApp space-strip transform + 6 new optional fields

## Test counts post-Phase 15

- API: 404/404 tests passing (47+ files)
- Web: 116/116 tests passing (14 files)
- TypeScript: 0 errors both workspaces

## Key technical decisions honored

1. ✓ Explicit field mapping in GuestsService.create (no silent drop)
2. ✓ UpdateGuestDto auto-derived via CreateGuestSchema.partial()
3. ✓ PublicBookingService.txResult.guest type widened
4. ✓ escapeHtml inline (applied ONLY to dietary + special — E.164 whatsapp doesn't need it)
5. ✓ Native `<details>/<summary>` (no Collapsible primitive added)
6. ✓ marketingConsent default false + Ley 1581 Colombia legal text verbatim
7. ✓ WhatsApp Zod transform strips spaces BEFORE E.164 regex validation

## Carry-forward to Phase 16

Phase 16 (Guest Detail + Deep Links + Contact Events) will consume:
- `Guest.whatsappNumber` → `wa.me/{number}?text=...` deep link
- `Guest.contactPreference` → display priority order for ContactButtons
- `Guest.preferredLanguage` → email template selection (when EN templates ship)
- `Guest.dietaryRestrictions` + `specialRequests` → displayed in guest detail page

## Manual QA pending (3 scenarios, require running stack)

Documented in `15-MANUAL-QA-CHECKLIST.md`:
- Scenario 6: PATCH /api/guests/:id with preferredLanguage='en' → persists
- Scenario 7: Default preferredLanguage='es' on form submit
- Real booking submission end-to-end with email delivery verification

These are operational checks — code contract validated by 404+116 automated tests.

## Next steps

- Phase 16: Guest Detail + Deep Links + Contact Events (GCC-06..12)
- After Phase 16 → v1.3 milestone closeout
