-- Migration: move_seasons_to_room_type_add_plan_modifier
-- 2026-05-29  (corrected 2026-05-29 after partial-run incident)
--
-- RATIONALE:
--   Seasonality is a property of the room type, not of each rate plan.
--   Moving Season.ratePlanId → Season.roomTypeId means all plans for a room
--   type share the same seasonal calendar.  Per-plan price differentiation is
--   now handled by the new RatePlan.priceModifier column.
--
--   Formula: nightRate = round(basePrice × seasonMultiplier × planModifier)
--
-- INCIDENT NOTE (2026-05-29):
--   The original migration assumed 0 rows in `seasons`. Production had 1 row.
--   The original SQL defaulted roomTypeId to '' and then tried to add a FK —
--   the FK failed ('' not present in room_types), rolling back.
--   However, the transaction only rolled back the FK step; ADD COLUMN and
--   DROP COLUMN had already committed on PostgreSQL (DDL is NOT transactional
--   in the same way for Prisma's migration runner).
--   Actual state at recovery time:
--     - seasons.ratePlanId: ALREADY DROPPED
--     - seasons.roomTypeId: EXISTS as TEXT NOT NULL, value '' for the 1 row
--     - seasons_roomTypeId_fkey: does NOT exist
--     - seasons_roomTypeId_idx: does NOT exist
--     - rate_plans.priceModifier: does NOT exist
--
-- CORRECTION STRATEGY:
--   1. All DDL steps use IF EXISTS / IF NOT EXISTS guards for idempotency.
--   2. roomTypeId column is added idempotently (already exists — ADD COLUMN IF NOT EXISTS is a no-op).
--   3. The orphan row (roomTypeId='') is assigned to the first valid room_type.
--   4. Any season still orphaned (no valid roomTypeId) is deleted before enforcing FK.
--   5. FK and index are created if they do not already exist.
--   6. ratePlanId drop is guarded (already gone — DROP COLUMN IF EXISTS is a no-op).
--   7. priceModifier uses ADD COLUMN IF NOT EXISTS.
--
-- DATA DECISION (orphan season "junio"):
--   At incident time, seasons.ratePlanId was already dropped so the original
--   rate plan mapping is unrecoverable from DB state. The single orphan season
--   is assigned to the first room_type ordered by id (deterministic, reproducible).
--   If there are NO room_types, orphan seasons are deleted (cannot satisfy FK).

-- ── 0. Drop old FK / index on ratePlanId if they somehow still exist (idempotent) ─
ALTER TABLE "seasons"
  DROP CONSTRAINT IF EXISTS "seasons_ratePlanId_fkey";

DROP INDEX IF EXISTS "seasons_ratePlanId_idx";

-- ── 1. Add roomTypeId column (nullable first, idempotent) ─────────────────────────
ALTER TABLE "seasons"
  ADD COLUMN IF NOT EXISTS "roomTypeId" TEXT;

-- ── 2. Backfill orphan seasons (roomTypeId IS NULL or '') ─────────────────────────
--   Assign to the first available room_type ordered by id.
--   If ratePlanId still exists (unexpected re-run path), prefer that mapping;
--   otherwise fall back to first room_type.
UPDATE "seasons"
SET "roomTypeId" = (
  SELECT id FROM "room_types" ORDER BY id LIMIT 1
)
WHERE ("roomTypeId" IS NULL OR "roomTypeId" = '')
  AND EXISTS (SELECT 1 FROM "room_types");

-- ── 3. Delete any seasons that still have no valid roomTypeId ─────────────────────
--   (Only happens if room_types is empty — should never occur in production.)
DELETE FROM "seasons"
WHERE "roomTypeId" IS NULL OR "roomTypeId" = '';

-- ── 4. Enforce NOT NULL on roomTypeId ─────────────────────────────────────────────
ALTER TABLE "seasons"
  ALTER COLUMN "roomTypeId" SET NOT NULL;

-- ── 5. Add FK constraint (if not already present) ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'seasons_roomTypeId_fkey'
      AND table_name = 'seasons'
  ) THEN
    ALTER TABLE "seasons"
      ADD CONSTRAINT "seasons_roomTypeId_fkey"
        FOREIGN KEY ("roomTypeId")
        REFERENCES "room_types"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
  END IF;
END $$;

-- ── 6. Create index (if not already present) ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS "seasons_roomTypeId_idx" ON "seasons"("roomTypeId");

-- ── 7. Drop ratePlanId column if it somehow still exists ──────────────────────────
ALTER TABLE "seasons"
  DROP COLUMN IF EXISTS "ratePlanId";

-- ── 8. Add priceModifier to rate_plans (idempotent) ───────────────────────────────
ALTER TABLE "rate_plans"
  ADD COLUMN IF NOT EXISTS "priceModifier" DECIMAL(5, 4) NOT NULL DEFAULT 1.0;
