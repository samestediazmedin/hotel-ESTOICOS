import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { doubleCsrf, type CsrfTokenGenerator } from 'csrf-csrf';
import type { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * ConciergeCsrfMiddleware — csrf-csrf v4 double-submit cookie CSRF protection
 * for the public Concierge SSE endpoint (GET /api/concierge/chat via @Sse).
 *
 * Defense-in-depth: the primary abuse-control is IpThrottlerGuard (20 msg/hr per IP).
 * The middleware is mounted on the GET route to maintain the CSRF cookie lifecycle,
 * but csrf-csrf skips token validation for GET (ignoredMethods includes GET).
 * If the endpoint ever changes to POST, validation activates automatically.
 *
 * Pattern:
 * - GET /api/public/concierge/csrf-token: sets __Host-concierge-csrf cookie + returns token.
 * - GET /api/concierge/chat: middleware runs (cookie lifecycle), validation skipped for GET.
 *
 * Cookie name: '__Host-concierge-csrf' in production (HTTPS), 'concierge-csrf' in dev (plain HTTP).
 * Using __Host- prefix enforces: path='/', secure=true in production, no domain attribute.
 *
 * CRITICAL: requires trust proxy (Phase 08 P1) so that getSessionIdentifier receives
 * the real visitor IP from req.ip, not the Railway proxy's loopback address.
 *
 * Env var required: CSRF_SECRET (32+ char random string, shared with PublicBookingModule).
 */
@Injectable()
export class ConciergeCsrfMiddleware implements NestMiddleware {
  private readonly protect: (req: any, res: any, next: any) => void;
  readonly generateToken: CsrfTokenGenerator;
  private readonly logger = new Logger(ConciergeCsrfMiddleware.name);

  constructor(private readonly config: ConfigService) {
    // ── S03 fix: fail-fast if CSRF_SECRET is not set ─────────────────────────
    // Previously fell back to a hardcoded dev secret, which defeated CSRF
    // protection entirely if the env var was missing in production.
    const secret = this.config.get<string>('CSRF_SECRET');
    if (!secret) {
      throw new Error(
        'CSRF_SECRET env var is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }

    const isProd = this.config.get('NODE_ENV') === 'production';

    const csrf = doubleCsrf({
      getSecret: () => secret,
      // getSessionIdentifier: required in csrf-csrf v4 — use client IP for stateless public sessions.
      // Requires trust proxy to be set in main.ts (Phase 08 P1) for correct IP binding on Railway.
      getSessionIdentifier: (req) => (req as any).ip ?? '',
      // Cookie name adapts to environment:
      // - prod (HTTPS): '__Host-concierge-csrf' — the __Host- prefix enforces path='/' + secure + no domain
      // - dev (HTTP): 'concierge-csrf' — __Host- requires secure=true which we cannot set on plain localhost http
      // The double-submit token pattern works identically; the prefix is hardening, not a functional requirement.
      cookieName: isProd ? '__Host-concierge-csrf' : 'concierge-csrf',
      cookieOptions: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        path: '/',
      },
      size: 64,
      // Frontend sends the token in X-CSRF-Token header (standard double-submit pattern)
      getCsrfTokenFromRequest: (req) => (req.headers['x-csrf-token'] as string) ?? '',
      ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    });

    this.protect = csrf.doubleCsrfProtection;
    this.generateToken = csrf.generateCsrfToken;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.protect(req, res, (err: any) => {
      if (err) {
        this.logger.warn(`Concierge CSRF validation failed: ${err.message ?? 'invalid token'}`);
        res.status(403).json({ statusCode: 403, message: 'Invalid CSRF token' });
        return;
      }
      next();
    });
  }
}
