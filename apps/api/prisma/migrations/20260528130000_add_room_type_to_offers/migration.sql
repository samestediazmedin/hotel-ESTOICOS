-- Migration: add_room_type_to_offers
-- Adds an optional FK from Offer to RoomType.
-- OnDelete: SetNull — offer goes back to hotel-wide if the room type is deleted.

ALTER TABLE "offers" ADD COLUMN "roomTypeId" VARCHAR;

ALTER TABLE "offers"
  ADD CONSTRAINT "offers_roomTypeId_fkey"
  FOREIGN KEY ("roomTypeId")
  REFERENCES "room_types"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "offers_roomTypeId_idx" ON "offers"("roomTypeId");
