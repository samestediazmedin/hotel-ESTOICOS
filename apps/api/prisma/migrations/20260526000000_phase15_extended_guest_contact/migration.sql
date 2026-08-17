-- Phase 15 — Extended Contact Capture (GCC-01, GCC-02)
-- Adds ContactPreference enum + 6 nullable/default columns to guests table.
-- All columns are nullable or have defaults — zero risk to existing rows, no backfill needed.
-- Marketing consent DEFAULT false per Colombian Ley 1581 (Habeas Data) opt-in requirement.

-- CreateEnum (MUST come BEFORE ALTER TABLE that references it)
CREATE TYPE "ContactPreference" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP');

-- AlterTable: add 6 columns to guests
ALTER TABLE "guests"
  ADD COLUMN "preferredLanguage" VARCHAR(8) NOT NULL DEFAULT 'es',
  ADD COLUMN "contactPreference" "ContactPreference",
  ADD COLUMN "whatsappNumber" VARCHAR(16),
  ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dietaryRestrictions" VARCHAR(500),
  ADD COLUMN "specialRequests" VARCHAR(1000);
