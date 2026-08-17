-- Migration: add_display_prices_with_iva
-- Additive boolean column with NOT NULL DEFAULT true.
-- The single existing system_config row receives true automatically.
-- Safe to run on live data with zero downtime.

ALTER TABLE "system_config" ADD COLUMN "displayPricesWithIva" BOOLEAN NOT NULL DEFAULT true;
