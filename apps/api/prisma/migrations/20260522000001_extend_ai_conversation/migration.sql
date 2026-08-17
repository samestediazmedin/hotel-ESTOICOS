-- Phase 07-01: Extend ai_conversations with title + lastMessageAt (additive migration)
-- title: auto-generated from first user message (first 60 chars), nullable initially
-- lastMessageAt: updated on each message — used for ordering the conversation list

ALTER TABLE "ai_conversations"
  ADD COLUMN IF NOT EXISTS "title"         TEXT,
  ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ai_conversations_userId_lastMessageAt_idx"
  ON "ai_conversations"("userId", "lastMessageAt" DESC);
