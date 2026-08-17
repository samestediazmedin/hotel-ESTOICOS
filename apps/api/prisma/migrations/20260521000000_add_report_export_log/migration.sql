-- Migration: add_report_export_log
-- Phase 06-01 — Reporting dashboard export audit log
--
-- Immutable record of each CSV or PDF export request.
-- One row per export. rowCount = number of DailySnapshot rows included.

CREATE TABLE "report_export_log" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "fromDate"    DATE NOT NULL,
  "toDate"      DATE NOT NULL,
  "format"      TEXT NOT NULL,
  "rowCount"    INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_export_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_export_log_userId_idx" ON "report_export_log"("userId");
