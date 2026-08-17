import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  rawRefreshToken: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  async createTokenPair(userId: string, deviceInfo?: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const hashedToken = this.hashToken(rawRefreshToken);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        deviceInfo: deviceInfo ?? null,
        expiresAt,
      },
    });

    const accessToken = this.jwtService.sign(
      { sub: userId, role: user.role },
      {
        expiresIn: '30m',
        secret: process.env.JWT_ACCESS_SECRET,
      },
    );

    return { accessToken, rawRefreshToken };
  }

  /**
   * Rotate a refresh token atomically.
   *
   * Concurrency bugfix (2026-05-22):
   * Two concurrent requests with the same cookie would race:
   *   - Request A: findFirst → delete (succeeds) → createTokenPair
   *   - Request B: findFirst (stale read) → delete throws P2025 → 500
   *
   * Fix: use `deleteMany` with token+expiresAt match. It returns a count
   * (never throws on not-found). If count === 0, another request already
   * rotated the token → respond 401, not 500.
   */
  async rotateRefreshToken(rawToken: string): Promise<TokenPair> {
    const hashed = this.hashToken(rawToken);

    const existing = await this.prisma.refreshToken.findFirst({
      where: { token: hashed },
    });

    if (!existing) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expirado');
    }

    // Atomic delete — returns count, never throws if row was already deleted
    // by a concurrent request. This converts the race into a 401 instead of a 500.
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { id: existing.id },
    });

    if (count === 0) {
      // Lost the race — another concurrent request rotated this token already.
      // Treat as "already used / invalid" so the client falls back to /login.
      throw new UnauthorizedException('Refresh token ya rotado');
    }

    // Issue new pair with same userId
    return this.createTokenPair(existing.userId);
  }

  /**
   * rotateRefreshTokenWithUserId — same rotation as rotateRefreshToken but also
   * exposes the userId so AuthService.refresh can fetch the full user record
   * for the response (2026-05-28 sidebar role hydration fix).
   */
  async rotateRefreshTokenWithUserId(rawToken: string): Promise<{ tokenPair: TokenPair; userId: string }> {
    const hashed = this.hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findFirst({ where: { token: hashed } });
    if (!existing) throw new UnauthorizedException('Refresh token inválido');
    if (existing.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expirado');
    const { count } = await this.prisma.refreshToken.deleteMany({ where: { id: existing.id } });
    if (count === 0) throw new UnauthorizedException('Refresh token ya rotado');
    const tokenPair = await this.createTokenPair(existing.userId);
    return { tokenPair, userId: existing.userId };
  }

  async revokeToken(rawToken: string): Promise<void> {
    const hashed = this.hashToken(rawToken);

    // deleteMany is idempotent — no throw if row already gone.
    await this.prisma.refreshToken.deleteMany({
      where: { token: hashed },
    });
  }

  async revokeAllSessions(userId: string): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
    return result.count;
  }
}
