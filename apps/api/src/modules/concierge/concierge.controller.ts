import {
  Controller,
  Req,
  Sse,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import type { Request } from 'express';
import { ConciergeService } from './concierge.service';
import { IpThrottlerGuard } from './guards/ip-throttler.guard';
import { ChatMessageSchema } from './dto/chat-message.dto';

/**
 * ConciergeController — public SSE streaming endpoint for the hotel concierge chatbot.
 *
 * CON-01: Endpoint is PUBLIC — no JwtAuthGuard, no @Roles.
 * CON-02: GET /api/concierge/chat streams token-by-token via @Sse(). NestJS 11's @Sse()
 *         decorator only registers GET routes (cannot be combined with @Post()).
 * CON-06: IpThrottlerGuard applied at @Sse method level only (NOT class, NOT APP_GUARD).
 *
 * SSE transport: the client uses fetch+ReadableStream (NOT native EventSource) so it can
 * send the X-CSRF-Token header. EventSource cannot set custom headers.
 *
 * CSRF: ConciergeCsrfMiddleware is applied to /concierge/chat via module configure().
 * Frontend must first GET /api/public/concierge/csrf-token to obtain the token,
 * then send X-CSRF-Token header on the chat request.
 *
 * Rate limiting: IpThrottlerGuard limits 20 messages/hour per IP.
 * Requires trust proxy in main.ts (Phase 08 P1) for correct IP resolution on Railway.
 */
@Controller('concierge')
export class ConciergeController {
  constructor(private readonly svc: ConciergeService) {}

  /**
   * GET /api/concierge/chat?message=...&sessionCookie=...
   *
   * Returns SSE stream of chat events. Query string is Zod-validated.
   *
   * NOTE: We read the query directly from `req.query` instead of using `@Query()`.
   * In NestJS 11 + Express 5 the SSE pipeline can deliver `@Query()` as `undefined`
   * (param-decorator factory behavior under the SSE transport), which broke Zod
   * validation in production. `req.query` is always populated by Express and is
   * stable across transports.
   *
   * W5 pattern: @UseGuards(IpThrottlerGuard) is at THIS METHOD LEVEL ONLY.
   */
  @Sse('chat')
  @UseGuards(IpThrottlerGuard)
  chat(@Req() req: Request): Observable<MessageEvent> {
    const parsed = ChatMessageSchema.safeParse(req.query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues); // Zod v4 .issues convention
    }
    // req.ip is the real client IP after trust proxy is set in main.ts (Phase 08 P1)
    const ip = (req as any).ip ?? '0.0.0.0';
    return this.svc.streamChat(parsed.data.message, ip, parsed.data.sessionCookie ?? null);
  }
}
