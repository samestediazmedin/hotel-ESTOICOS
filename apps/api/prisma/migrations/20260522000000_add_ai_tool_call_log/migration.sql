-- Phase 07-01: Add ai_tool_call_logs table for audit trail
-- Logs every tool invocation (success, error, validation_error) via try/finally (AI-09)
-- outputJson intentionally omitted — tool results may contain guest PII (names, folio totals)

CREATE TABLE "ai_tool_call_logs" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "conversationId" TEXT,
  "toolName"       TEXT NOT NULL,
  "inputJson"      JSONB NOT NULL,
  "outputStatus"   TEXT NOT NULL,
  "errorMsg"       TEXT,
  "durationMs"     INTEGER,
  "executedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_tool_call_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_tool_call_logs_userId_executedAt_idx"
  ON "ai_tool_call_logs"("userId", "executedAt" DESC);

ALTER TABLE "ai_tool_call_logs"
  ADD CONSTRAINT "ai_tool_call_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT;
