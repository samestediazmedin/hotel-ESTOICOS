-- Migration: Phase 3 concierge — add conciergeReviewToken to Reservation
--
-- Adds a nullable unique sentinel field to Reservation.
-- Used by the cédula+apellido verified review flow (concierge chat).
-- Completely separate from reviewTokenJtiUsed (email-token flow).
--
-- Safe:
--   - Nullable: no backfill needed, all existing rows get NULL.
--   - @unique: enforces one concierge review per reservation at DB level.
--     Prisma P2002 on double-submit → ConciergeReviewService maps to 409 Conflict.
--   - No existing data is modified.

ALTER TABLE "reservations"
  ADD COLUMN "conciergeReviewToken" TEXT;

CREATE UNIQUE INDEX "reservations_conciergeReviewToken_key"
  ON "reservations"("conciergeReviewToken");
