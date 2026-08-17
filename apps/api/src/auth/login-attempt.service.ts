import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const BLOCK_THRESHOLD = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Per-email rate limit (LOW-2 fix): blocks by email regardless of IP.
 * An attacker rotating IPs can still be blocked after EMAIL_BLOCK_THRESHOLD
 * total failed attempts across all IPs for the same email.
 * Threshold is higher (15) to avoid blocking legitimate users on shared networks.
 */
const EMAIL_BLOCK_THRESHOLD = 15;
const EMAIL_BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Sentinel IP used for the per-email aggregate record.
 * The Prisma model has @@unique([email, ip]), so we use a well-known
 * non-routable sentinel to store the email-global counter alongside
 * the per-IP records without schema changes.
 */
const EMAIL_GLOBAL_IP = '0.0.0.0/email-global';

@Injectable()
export class LoginAttemptService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Throws 429 if email+ip combination OR the email-global counter is blocked.
   * Must be called BEFORE checking credentials.
   */
  async validateAttempt(email: string, ip: string): Promise<void> {
    // Check both per-IP and per-email blocks in parallel
    const [perIp, perEmail] = await Promise.all([
      this.prisma.loginAttempt.findUnique({
        where: { email_ip: { email, ip } },
      }),
      this.prisma.loginAttempt.findUnique({
        where: { email_ip: { email, ip: EMAIL_GLOBAL_IP } },
      }),
    ]);

    const now = new Date();

    if (perIp?.expiresAt && perIp.expiresAt > now) {
      throw new HttpException(
        'Credenciales incorrectas, intente más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (perEmail?.expiresAt && perEmail.expiresAt > now) {
      throw new HttpException(
        'Credenciales incorrectas, intente más tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Records a failed login attempt. Increments both the per-IP counter
   * and the per-email global counter. Each has its own threshold:
   * - Per-IP: 5 failures → 15-min block
   * - Per-email: 15 failures (any IP) → 30-min block
   */
  async recordFailure(email: string, ip: string): Promise<void> {
    // Increment both counters in parallel
    await Promise.all([
      this.upsertAndBlock(email, ip, BLOCK_THRESHOLD, BLOCK_DURATION_MS),
      this.upsertAndBlock(email, EMAIL_GLOBAL_IP, EMAIL_BLOCK_THRESHOLD, EMAIL_BLOCK_DURATION_MS),
    ]);
  }

  /**
   * Clears login attempts on successful login.
   * Clears both the per-IP record and the per-email global record.
   * Does NOT throw if records do not exist.
   */
  async clearAttempts(email: string, ip: string): Promise<void> {
    await Promise.all([
      this.safeDelete(email, ip),
      this.safeDelete(email, EMAIL_GLOBAL_IP),
    ]);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async upsertAndBlock(
    email: string,
    ip: string,
    threshold: number,
    blockDurationMs: number,
  ): Promise<void> {
    await this.prisma.loginAttempt.upsert({
      where: { email_ip: { email, ip } },
      create: {
        email,
        ip,
        count: 1,
        blockedAt: null,
        expiresAt: null,
      },
      update: {
        count: { increment: 1 },
      },
    });

    // After upsert, fetch current count and apply block if threshold reached
    const record = await this.prisma.loginAttempt.findUnique({
      where: { email_ip: { email, ip } },
    });

    if (record && record.count >= threshold && !record.blockedAt) {
      const now = new Date();
      await this.prisma.loginAttempt.update({
        where: { email_ip: { email, ip } },
        data: {
          blockedAt: now,
          expiresAt: new Date(now.getTime() + blockDurationMs),
        },
      });
    }
  }

  private async safeDelete(email: string, ip: string): Promise<void> {
    try {
      await this.prisma.loginAttempt.delete({
        where: { email_ip: { email, ip } },
      });
    } catch {
      // P2025 — record not found, nothing to clear
    }
  }
}
