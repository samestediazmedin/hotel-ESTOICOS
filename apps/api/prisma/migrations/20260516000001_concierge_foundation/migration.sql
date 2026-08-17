-- Migration: concierge_foundation
-- Phase 08-01: Extend BogotaVenue stub + create 3 concierge tables
-- Drops legacy `category String` column, creates venue_type enum,
-- adds lat/lng (NOT NULL with safety guard) and other columns.

-- CreateEnum
CREATE TYPE "venue_type" AS ENUM (
  'RESTAURANT',
  'BAR',
  'CAFE',
  'MUSEUM',
  'PARK',
  'SHOPPING',
  'NIGHTLIFE',
  'TRANSPORT_HUB',
  'EVENT_VENUE',
  'OTHER'
);

-- AlterTable bogota_venues: drop legacy category column, add type enum
ALTER TABLE "bogota_venues" DROP COLUMN "category";
ALTER TABLE "bogota_venues" ADD COLUMN "type" "venue_type" NOT NULL DEFAULT 'OTHER';

-- SAFETY CHECK: lat/lng are required (NOT NULL) because venues without coordinates
-- cannot compute distance (haversine) or render the "Cómo llegar" maps deep link (CON-05).
-- If any existing rows lack coordinates, fail the migration explicitly so the operator
-- backfills them BEFORE the constraint is enforced. The Phase 1 stub had no inserted rows,
-- so this check is expected to pass in production; the guard exists for safety in dev/staging
-- where seed data may have been inserted manually.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "bogota_venues") THEN
    RAISE EXCEPTION 'concierge_foundation migration: bogota_venues already contains rows. Backfill lat/lng manually before applying NOT NULL constraint, then re-run the migration. Existing row count: %', (SELECT COUNT(*) FROM "bogota_venues");
  END IF;
END $$;

ALTER TABLE "bogota_venues" ADD COLUMN "lat" DECIMAL(9,6) NOT NULL;
ALTER TABLE "bogota_venues" ADD COLUMN "lng" DECIMAL(9,6) NOT NULL;
ALTER TABLE "bogota_venues" ADD COLUMN "reservationUrl" TEXT;

-- Create indexes on bogota_venues
CREATE INDEX "bogota_venues_type_isActive_idx" ON "bogota_venues"("type", "isActive");
CREATE INDEX "bogota_venues_isActive_idx" ON "bogota_venues"("isActive");

-- CreateTable concierge_events
CREATE TABLE "concierge_events" (
  "id"          TEXT        NOT NULL,
  "venueId"     TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3),
  "description" TEXT,
  "ticketUrl"   TEXT,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "concierge_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "concierge_events_startDate_isActive_idx"
  ON "concierge_events"("startDate", "isActive");

ALTER TABLE "concierge_events"
  ADD CONSTRAINT "concierge_events_venueId_fkey"
  FOREIGN KEY ("venueId")
  REFERENCES "bogota_venues"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- CreateTable concierge_token_usage_daily
CREATE TABLE "concierge_token_usage_daily" (
  "date"              DATE    NOT NULL,
  "totalTokensUsed"   BIGINT  NOT NULL DEFAULT 0,
  "totalRequestCount" INTEGER NOT NULL DEFAULT 0,
  "lastUpdatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "concierge_token_usage_daily_pkey" PRIMARY KEY ("date")
);

-- CreateTable concierge_message_logs
CREATE TABLE "concierge_message_logs" (
  "id"              TEXT         NOT NULL,
  "ipHash"          TEXT         NOT NULL,
  "sessionCookie"   TEXT,
  "userMessage"     TEXT         NOT NULL,
  "assistantOutput" TEXT,
  "toolCallsJson"   JSONB,
  "finishReason"    TEXT,
  "errorMsg"        TEXT,
  "promptTokens"    INTEGER,
  "completionTokens" INTEGER,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "concierge_message_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "concierge_message_logs_ipHash_createdAt_idx"
  ON "concierge_message_logs"("ipHash", "createdAt");

CREATE INDEX "concierge_message_logs_createdAt_idx"
  ON "concierge_message_logs"("createdAt");
