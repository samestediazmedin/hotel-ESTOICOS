-- Migration: 20260516000000_add_reservation_exclusion_constraint
-- Requires: btree_gist extension (installed in 20260513000000_init/migration.sql line 3)
--
-- This constraint physically prevents overbooking: two reservations with the
-- same roomId and overlapping date ranges cannot both exist when status is
-- not CANCELLED and not NO_SHOW.
--
-- Half-open interval '[)' means check-out date is NOT inclusive — a guest
-- checking out on June 10 does NOT block a guest checking in on June 10.
--
-- PENDING status DOES participate in the constraint (Pitfall P3, locked).

ALTER TABLE "reservations"
  ADD CONSTRAINT "no_overlapping_reservations"
  EXCLUDE USING GIST (
    "roomId" WITH =,
    daterange("checkInDate", "checkOutDate", '[)') WITH &&
  )
  WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
