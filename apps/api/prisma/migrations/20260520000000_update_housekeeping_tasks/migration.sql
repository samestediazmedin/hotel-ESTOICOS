-- Phase 05 Plan 01: Add status + createdById to housekeeping_tasks
-- ADDITIVE migration — no existing data is affected (feature was not live yet).

CREATE TYPE "HousekeepingTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

ALTER TABLE "housekeeping_tasks"
  ADD COLUMN "status"      "HousekeepingTaskStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "createdById" TEXT NOT NULL DEFAULT '';

ALTER TABLE "housekeeping_tasks"
  ADD CONSTRAINT "housekeeping_tasks_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "housekeeping_tasks_createdById_idx" ON "housekeeping_tasks"("createdById");
