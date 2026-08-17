-- 2026-05-28 — Move marketing photos from per-Room to per-RoomType
--
-- Public homepage shows room TYPES (Doble Deluxe, Suite Sumapaz, ...), not
-- individual rooms (101, 102, 103). Photos at the type level represent the
-- layout, decor, and feel; the physical room number is irrelevant to the
-- guest at browse time.
--
-- This migration:
--   1. Creates the new room_type_photos table.
--   2. Backfills it with every existing room_photos row, attributing each
--      to that room's roomTypeId. Duplicate rooms-of-same-type contribute
--      multiple photos to the type, which is fine — preserves all uploads.
--   3. Keeps room_photos in place (no DROP). The table is no longer wired
--      into the public read path, but the rows + R2/storage files survive
--      in case the admin wants to recover anything manually.

-- 1) Create the new table
CREATE TABLE "room_type_photos" (
  "id"          TEXT NOT NULL,
  "roomTypeId"  TEXT NOT NULL,
  "key"         TEXT NOT NULL,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "contentType" TEXT,
  "size"        INTEGER,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_type_photos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_type_photos_key_unique" ON "room_type_photos" ("key");
CREATE INDEX "room_type_photos_roomTypeId_order_idx" ON "room_type_photos" ("roomTypeId", "order");

ALTER TABLE "room_type_photos"
  ADD CONSTRAINT "room_type_photos_roomTypeId_fkey"
  FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Backfill from room_photos
--    cuid() doesn't exist in postgres; we use gen_random_uuid()::text instead.
--    pgcrypto extension is required — Railway PG has it enabled by default.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO "room_type_photos" ("id", "roomTypeId", "key", "order", "contentType", "size", "createdAt")
SELECT
  ('c' || REPLACE(gen_random_uuid()::text, '-', ''))::text AS id,
  r."roomTypeId",
  rp."key",
  ROW_NUMBER() OVER (PARTITION BY r."roomTypeId" ORDER BY rp."order", rp."createdAt") - 1 AS "order",
  rp."contentType",
  rp."size",
  rp."createdAt"
FROM "room_photos" rp
JOIN "rooms" r ON r."id" = rp."roomId"
ON CONFLICT ("key") DO NOTHING;
