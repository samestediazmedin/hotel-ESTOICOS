-- Add reminderSentAt to reservations table for pre-arrival reminder tracking
-- Phase 24 — Pre-arrival Reminder System (REM-01, REM-02)

ALTER TABLE "reservations" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- Index for efficient querying by cron job
CREATE INDEX "reservations_reminderSentAt_idx" ON "reservations"("reminderSentAt");
