/**
 * audit-log.repository.ts — Concierge chat message audit log.
 *
 * GDPR / Ley 1581 compliance: raw IP addresses are NEVER stored.
 * Instead, hashIp() computes sha256(ip + CONCIERGE_IP_HASH_SALT) — a one-way
 * pseudonymisation that allows rate-limit lookups without exposing PII.
 *
 * appendLog() wraps the DB insert in try/catch and NEVER throws.
 * Rationale: if the audit log fails, the user's chat response must still be
 * returned — audit failure must not break the user flow (try/finally pattern
 * from Phase 07 ToolExecutorService).
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface AppendLogData {
  ipHash: string;
  sessionCookie?: string | null;
  userMessage: string;
  assistantOutput?: string | null;
  toolCallsJson?: unknown;
  finishReason?: string | null;
  errorMsg?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
}

@Injectable()
export class AuditLogRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * hashIp — pseudonymise an IP address for GDPR / Ley 1581 compliance.
   *
   * sha256(ip + salt) → 64-char hex string.
   * Same IP + same salt → same hash (deterministic for rate-limit lookups).
   * Different salt (rotated) → different hash (breaks linkability across rotations).
   *
   * CONCIERGE_IP_HASH_SALT must be 32+ chars and treated as a secret.
   * Fail-fast: getOrThrow() throws if the env var is missing — prevents silent
   * storage of unhashed IPs at boot time.
   */
  hashIp(ip: string): string {
    const salt = this.config.getOrThrow<string>('CONCIERGE_IP_HASH_SALT');
    return createHash('sha256').update(ip + salt).digest('hex');
  }

  /**
   * appendLog — insert one row into concierge_message_logs.
   *
   * Catches all DB errors and logs them without rethrowing.
   * Audit must not break the user-facing chat response — silence > failure.
   */
  async appendLog(data: AppendLogData): Promise<void> {
    try {
      await this.prisma.conciergeMessageLog.create({
        data: {
          ipHash: data.ipHash,
          sessionCookie: data.sessionCookie ?? null,
          userMessage: data.userMessage,
          assistantOutput: data.assistantOutput ?? null,
          toolCallsJson: (data.toolCallsJson as any) ?? null,
          finishReason: data.finishReason ?? null,
          errorMsg: data.errorMsg ?? null,
          promptTokens: data.promptTokens ?? null,
          completionTokens: data.completionTokens ?? null,
        },
      });
    } catch (err) {
      // NEVER throw — audit must not break user flow (try/finally pattern)
      console.error('[concierge audit] insert failed', err);
    }
  }
}
