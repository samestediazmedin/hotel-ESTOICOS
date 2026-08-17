-- Migration: add night_audit_runs table
-- Phase 04-02: Night Audit idempotency log
--
-- businessDate is UNIQUE — prevents re-running a COMPLETED audit for the same date.
-- Combined with per-folio per-businessDate ROOM_CHARGE existence check (two-layer
-- idempotency as per RESEARCH section 3.4 / Pitfall P3).
--
-- Status lifecycle: IN_PROGRESS → COMPLETED | FAILED

CREATE TABLE "night_audit_runs" (
  "id"                   TEXT NOT NULL,
  "businessDate"         DATE NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "openFoliosProcessed"  INTEGER NOT NULL DEFAULT 0,
  "chargesPosted"        INTEGER NOT NULL DEFAULT 0,
  "noShowsMarked"        INTEGER NOT NULL DEFAULT 0,
  "ranAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"          TIMESTAMP(3),
  "errorMessage"         TEXT,
  CONSTRAINT "night_audit_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "night_audit_runs_businessDate_key" ON "night_audit_runs"("businessDate");
