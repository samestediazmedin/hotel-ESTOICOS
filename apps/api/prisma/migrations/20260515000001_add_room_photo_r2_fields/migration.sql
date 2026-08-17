-- Migration: add_room_photo_r2_fields
-- Replaces `url` (legacy) with `key` (R2 object key) + `contentType` + `size`
-- Table is empty in dev (no data migration needed).
-- Rationale: storing the full URL violates Anti-Pattern #4 from RESEARCH.md —
-- if R2_PUBLIC_URL changes, a data migration would be required.
-- The URL is constructed at read time: R2_PUBLIC_URL + '/' + key.

-- AlterTable: drop legacy url column
ALTER TABLE "room_photos" DROP COLUMN "url";

-- AlterTable: add R2 fields
ALTER TABLE "room_photos" ADD COLUMN "key" TEXT NOT NULL DEFAULT '';
ALTER TABLE "room_photos" ADD COLUMN "contentType" TEXT;
ALTER TABLE "room_photos" ADD COLUMN "size" INTEGER;

-- Remove the default now that existing rows are backfilled (none exist in dev)
ALTER TABLE "room_photos" ALTER COLUMN "key" DROP DEFAULT;

-- CreateIndex: key must be unique (one R2 object per photo row)
CREATE UNIQUE INDEX "room_photos_key_key" ON "room_photos"("key");
