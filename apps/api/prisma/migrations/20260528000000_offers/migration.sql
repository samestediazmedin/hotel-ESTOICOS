-- 2026-05-28 — Offers feature
-- Admin-managed promotions shown on the public homepage.
-- Replaces the static "Restaurante" section.

-- 1) offers table
CREATE TABLE "offers" (
  "id"           TEXT NOT NULL,
  "title"        VARCHAR(200) NOT NULL,
  "description"  VARCHAR(1000),
  "imageKey"     VARCHAR(300) NOT NULL,
  "badge"        VARCHAR(40),
  "validFrom"    DATE,
  "validTo"      DATE,
  "ctaText"      VARCHAR(60),
  "ctaLink"      VARCHAR(300),
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "offers_isActive_displayOrder_idx"
  ON "offers" ("isActive", "displayOrder");

-- 2) reservations.sourceOfferId (track which offer triggered the booking)
ALTER TABLE "reservations" ADD COLUMN "sourceOfferId" TEXT;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_sourceOfferId_fkey"
  FOREIGN KEY ("sourceOfferId") REFERENCES "offers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "reservations_sourceOfferId_idx"
  ON "reservations" ("sourceOfferId");
