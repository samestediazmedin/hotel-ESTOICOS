-- Migration: add_tra_export_log
-- Phase 04-04 — TRA Colombia compliance export audit log
--
-- Immutable record of each CSV export request.
-- One row per export. rowCount = number of Stay rows included in the CSV.
--
-- LOW CONFIDENCE: TRA format (semicolon, BOM, DD/MM/YYYY) is best-effort.
-- Hotel owner must confirm with COTELCO / local alcaldía before production use.

CREATE TABLE "tra_export_log" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "fromDate"    DATE NOT NULL,
  "toDate"      DATE NOT NULL,
  "rowCount"    INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tra_export_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tra_export_log_userId_idx" ON "tra_export_log"("userId");
