import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConciergeCsrfMiddleware } from './csrf.middleware';

/**
 * ConciergePublicCsrfController — serves the CSRF token for the public concierge chat.
 *
 * CON-08 defense-in-depth: the concierge chat endpoint (POST /api/concierge/chat)
 * uses double-submit cookie CSRF protection. This endpoint sets the CSRF cookie
 * and returns the token for the frontend to include in the X-CSRF-Token header.
 *
 * Flow:
 * 1. Frontend (08-03) sends GET /api/public/concierge/csrf-token on page load.
 * 2. Response sets __Host-concierge-csrf cookie + returns { csrfToken }.
 * 3. Frontend includes X-CSRF-Token: <token> header on POST /api/concierge/chat.
 * 4. ConciergeCsrfMiddleware validates the token matches the cookie.
 *
 * This controller is PUBLIC — no JWT, no throttling.
 */
@Controller('public/concierge')
export class ConciergePublicCsrfController {
  constructor(private readonly csrf: ConciergeCsrfMiddleware) {}

  /**
   * GET /api/public/concierge/csrf-token
   *
   * Sets the __Host-concierge-csrf cookie and returns the CSRF token.
   * Frontend must call this before any POST to /api/concierge/chat.
   */
  @Get('csrf-token')
  getCsrfToken(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ): void {
    const token = this.csrf.generateToken(req, res);
    res.json({ csrfToken: token });
  }
}
