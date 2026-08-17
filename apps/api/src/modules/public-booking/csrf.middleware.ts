import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { doubleCsrf } from 'csrf-csrf';

/**
 * csrf-csrf double-submit cookie CSRF protection for public booking endpoints.
 *
 * Pattern: GET /public/csrf-token sets the secret cookie AND returns the token.
 * POST /public/bookings must include X-CSRF-Token header matching the cookie.
 *
 * Pitfall P11: sameSite='strict' is correct for v1 same-origin deployment.
 * Cross-domain deployments would need 'lax' or origin-header validation instead.
 *
 * Env var required: CSRF_SECRET (32+ char random string)
 * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

// ── S03 fix: fail-fast if CSRF_SECRET is not set ─────────────────────────────
// Previously fell back to a hardcoded dev secret, which defeated CSRF protection
// entirely if the env var was missing in production.
const csrfSecret = process.env['CSRF_SECRET'];
if (!csrfSecret) {
  throw new Error(
    'CSRF_SECRET env var is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => csrfSecret,
  // getSessionIdentifier: required in csrf-csrf v4 — use client IP for stateless sessions.
  // Public booking has no auth sessions; IP is sufficient for CSRF binding.
  getSessionIdentifier: (req) => (req as any).ip ?? '',
  cookieName: 'hotel_csrf',
  cookieOptions: {
    sameSite: 'strict',
    secure: process.env['NODE_ENV'] === 'production',
    httpOnly: true,
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // GET /public/csrf-token + GET /public/availability bypass
});

export { generateCsrfToken };

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);

  use(req: any, res: any, next: (err?: any) => void) {
    doubleCsrfProtection(req, res, (err: any) => {
      if (err) {
        this.logger.warn(`CSRF validation failed: ${err.message ?? 'invalid token'}`);
        return res.status(403).json({ statusCode: 403, message: 'Invalid CSRF token' });
      }
      next();
    });
  }
}
