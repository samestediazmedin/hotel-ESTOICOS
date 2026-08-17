-- Phase 13 — Hotel Settings Admin Page (HSP-01, HSP-02, HSP-06)
-- Adds admin-editable address to system_config, R2 key to hotel_photos, and audit log table.

-- 1) SystemConfig.address (admin-editable, nullable, backfill existing row)
ALTER TABLE "system_config" ADD COLUMN "address" TEXT;
UPDATE "system_config" SET "address" = 'La Candelaria, Bogotá' WHERE "address" IS NULL;

-- 2) HotelPhoto.key (nullable — legacy rows keep url, new R2 uploads use key)
ALTER TABLE "hotel_photos" ADD COLUMN "key" TEXT;

-- 3) SystemConfigChangeLog audit table
CREATE TABLE "system_config_change_log" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "fieldsChanged" TEXT[] NOT NULL,
  "before"        JSONB NOT NULL,
  "after"         JSONB NOT NULL,
  "changedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_config_change_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_config_change_log_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "system_config_change_log_changedAt_idx"
  ON "system_config_change_log" ("changedAt");
