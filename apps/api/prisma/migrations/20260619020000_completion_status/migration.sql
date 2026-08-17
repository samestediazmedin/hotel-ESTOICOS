-- Add completionStatus to reservations table for online reservation completion tracking (Phase 26)

-- Create CompletionStatus enum
CREATE TYPE "CompletionStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

-- Add completionStatus column with default COMPLETED
ALTER TABLE "reservations" ADD COLUMN "completionStatus" "CompletionStatus" NOT NULL DEFAULT 'COMPLETED';

-- Index for efficient querying of pending reservations
CREATE INDEX "reservations_completionStatus_idx" ON "reservations"("completionStatus");
