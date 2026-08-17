import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService, TokenPair } from './token.service';
import { LoginAttemptService } from './login-attempt.service';

export interface LoginUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginResult extends TokenPair {
  mustChangePassword?: boolean;
  user: LoginUser;
}

/**
 * RefreshResult — mirrors LoginResult so the frontend can rehydrate both
 * accessToken AND user state on page refresh (G3 follow-up: without this,
 * the sidebar reads role='' until the next /me-style call and hides every
 * role-gated nav item).
 */
export interface RefreshResult extends TokenPair {
  user: LoginUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly loginAttemptService: LoginAttemptService,
  ) {}

  async login(email: string, password: string, ip: string): Promise<LoginResult> {
    // Step 1: Check rate limit BEFORE touching credentials
    await this.loginAttemptService.validateAttempt(email, ip);

    // Step 2: Find user by email
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Step 3: Validate password (constant-time via bcrypt.compare)
    // If user not found, compare against a dummy hash to prevent timing attacks
    const dummyHash = '$2b$12$invalidhashfortimingattackprevention00000000000000000';
    const passwordHash = user?.passwordHash ?? dummyHash;
    const passwordValid = await bcrypt.compare(password, passwordHash);

    if (!user || !passwordValid) {
      // Always record failure — same path for unknown email and wrong password (D-11)
      await this.loginAttemptService.recordFailure(email, ip);
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Step 4: Check if user is active
    if (!user.isActive) {
      await this.loginAttemptService.recordFailure(email, ip);
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Step 5: Success — clear attempts and create token pair
    await this.loginAttemptService.clearAttempts(email, ip);
    const tokenPair = await this.tokenService.createTokenPair(user.id);

    const result: LoginResult = {
      ...tokenPair,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };

    if (user.mustChangePassword) {
      result.mustChangePassword = true;
    }

    return result;
  }

  async refresh(rawToken: string): Promise<RefreshResult> {
    // 2026-05-28 — refresh now also returns the user record so the frontend
    // can rehydrate role-aware UI (Sidebar, ProtectedRoute) without a
    // separate /auth/me round-trip after every page reload.
    const { tokenPair, userId } = await this.tokenService.rotateRefreshTokenWithUserId(rawToken);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      // User row was deleted or deactivated between sessions — treat as a
      // hard 401 so the frontend falls back to /login.
      throw new UnauthorizedException('Usuario no disponible');
    }

    return {
      ...tokenPair,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async logout(rawToken: string): Promise<void> {
    return this.tokenService.revokeToken(rawToken);
  }
}
