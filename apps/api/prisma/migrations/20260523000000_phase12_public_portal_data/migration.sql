-- Phase 12 — Public Portal Data (PDA-01, PDA-02, PDA-03)
-- Extends system_config with hotel identity fields, adds isPublished to room_types,
-- creates hotel_photos table for the public hero gallery.

-- ===== system_config: hotel identity fields =====
ALTER TABLE "system_config" ADD COLUMN "tagline"     TEXT;
ALTER TABLE "system_config" ADD COLUMN "description" TEXT;
ALTER TABLE "system_config" ADD COLUMN "phone"       TEXT;
ALTER TABLE "system_config" ADD COLUMN "tags"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ===== room_types: isPublished flag (default true for backwards-compat) =====
ALTER TABLE "room_types" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true;

-- ===== hotel_photos: new table for public hero gallery =====
CREATE TABLE "hotel_photos" (
  "id"           TEXT NOT NULL,
  "url"          TEXT NOT NULL,
  "alt"          TEXT NOT NULL DEFAULT '',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "hotel_photos_displayOrder_idx" ON "hotel_photos"("displayOrder");
