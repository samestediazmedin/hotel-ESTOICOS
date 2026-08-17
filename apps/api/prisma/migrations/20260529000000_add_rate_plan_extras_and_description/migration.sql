-- Migration: add_rate_plan_extras_and_description
-- 2026-05-29
--
-- Changes:
--   1. RatePlan.description  — optional marketing description shown on the rate selector
--   2. RatePlanExtra          — new table: per-plan money line items (breakfast, late checkout, etc.)
--   3. Reservation.ratePlanId — optional FK back to the plan the guest chose

-- 1. Add description to rate_plans
ALTER TABLE "rate_plans" ADD COLUMN "description" VARCHAR(500);

-- 2. Create rate_plan_extras table
CREATE TABLE "rate_plan_extras" (
    "id"          TEXT          NOT NULL,
    "ratePlanId"  TEXT          NOT NULL,
    "name"        VARCHAR(120)  NOT NULL,
    "amount"      DECIMAL(10,2) NOT NULL,
    "pricingMode" TEXT          NOT NULL,
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_plan_extras_pkey" PRIMARY KEY ("id")
);

-- 3. Index on ratePlanId for extras lookups
CREATE INDEX "rate_plan_extras_ratePlanId_idx" ON "rate_plan_extras"("ratePlanId");

-- 4. FK: rate_plan_extras.ratePlanId → rate_plans.id (CASCADE delete)
ALTER TABLE "rate_plan_extras"
    ADD CONSTRAINT "rate_plan_extras_ratePlanId_fkey"
    FOREIGN KEY ("ratePlanId")
    REFERENCES "rate_plans"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 5. Add ratePlanId to reservations (nullable — backward compatible)
ALTER TABLE "reservations" ADD COLUMN "ratePlanId" TEXT;

-- 6. Index for reservation → rate_plan lookups
CREATE INDEX "reservations_ratePlanId_idx" ON "reservations"("ratePlanId");

-- 7. FK: reservations.ratePlanId → rate_plans.id (SET NULL on delete)
ALTER TABLE "reservations"
    ADD CONSTRAINT "reservations_ratePlanId_fkey"
    FOREIGN KEY ("ratePlanId")
    REFERENCES "rate_plans"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
