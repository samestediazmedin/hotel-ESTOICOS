-- Backfill guests."whatsappNumber" from guests.phone for rows where WhatsApp
-- was never captured (phase 15 made the form field optional, and almost
-- nobody fills it because the phone IS the WhatsApp number in CO/LATAM).
--
-- COLUMN NAMING NOTE: Prisma keeps camelCase column names in Postgres unless
-- @map("snake_case") is specified per field. The Guest model has no @map on
-- whatsappNumber, so the actual column identifier is "whatsappNumber" (must
-- be double-quoted to preserve case). `phone` and the table name `guests`
-- (via @@map) are already lowercase, no quoting needed.
--
-- Three patterns matched, in priority order:
--   1. phone is already E.164 ('+CC<digits>')                → copy as-is
--   2. phone is a 10-digit Colombian mobile                  → prefix '+57'
--   3. phone has 11-15 digits starting with a country code   → prefix '+'
--
-- Anything else (free-form/ambiguous) is left NULL on purpose — the WhatsApp
-- button stays disabled rather than dialling a malformed number.
--
-- Idempotent: only updates rows where "whatsappNumber" IS NULL, so re-running
-- this migration after future inserts is safe.

-- Pattern 1: phone already E.164
UPDATE guests
SET "whatsappNumber" = phone
WHERE "whatsappNumber" IS NULL
  AND phone ~ '^\+[1-9][0-9]{6,14}$';

-- Pattern 2: 10-digit Colombian mobile (3XXXXXXXXX) — prefix +57
UPDATE guests
SET "whatsappNumber" = '+57' || phone
WHERE "whatsappNumber" IS NULL
  AND phone ~ '^[0-9]{10}$';

-- Pattern 3: 11-15 digit international without leading + (treat as already containing CC)
UPDATE guests
SET "whatsappNumber" = '+' || phone
WHERE "whatsappNumber" IS NULL
  AND phone ~ '^[1-9][0-9]{10,14}$';
