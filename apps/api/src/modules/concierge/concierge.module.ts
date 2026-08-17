/**
 * concierge.module.ts — NestJS module for Phase 08 Concierge IA.
 *
 * Provides:
 * - ConciergeRepository (read-only venue/event queries, used by tools)
 * - TokenBudgetService (daily token spend circuit breaker, CON-07)
 * - AuditLogRepository (GDPR-compliant chat log, CON-08)
 * - ConciergeService (SSE streaming pipeline, 08-02)
 * - ConciergeToolExecutorService (tool dispatch + Zod validation, 08-02)
 * - IpThrottlerGuard (20 msg/hr per IP, CON-06, scoped to @Sse method only)
 * - ConciergeCsrfMiddleware (defense-in-depth CSRF, CON-08)
 *
 * OnModuleInit assertion: fails boot if the tool registry does not have exactly 10 tools.
 * This is an intentional fail-fast guard — if a tool is accidentally removed or added,
 * the server will not start, surfacing the issue immediately rather than at runtime.
 *
 * Controllers registered here:
 * - ConciergeController (POST /api/concierge/chat — public SSE streaming, 08-02)
 * - ConciergePublicCsrfController (GET /api/public/concierge/csrf-token, 08-02)
 * - ConciergeAdminController (admin CRUD, 08-01)
 * - ConciergePhotosController (R2 presign, 08-01)
 *
 * ThrottlerModule: configured with { name: 'concierge-ip', ttl: 3_600_000, limit: 20 }.
 * This is NOT registered as a global APP_GUARD — only IpThrottlerGuard uses it
 * and only on the POST /api/concierge/chat method (W5 pattern from Phase 03-04 + 07-02).
 *
 * CSRF middleware: applied to GET /concierge/chat via configure(consumer).
 * csrf-csrf skips validation for GET (ignoredMethods) but maintains cookie lifecycle.
 * Not applied to admin, photos, or other endpoints.
 */

import { MiddlewareConsumer, Module, OnModuleInit, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MulterModule } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import OpenAI from 'openai';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { ConciergeRepository } from './concierge.repository';
import { TokenBudgetService } from './token-budget.service';
import { AuditLogRepository } from './audit-log.repository';
import { CONCIERGE_TOOL_REGISTRY } from './concierge-tool-registry';
import { ConciergeAdminController } from './admin/concierge-admin.controller';
import { ConciergeAdminService } from './admin/concierge-admin.service';
import { ConciergeAdminRepository } from './admin/concierge-admin.repository';
import { ConciergePhotosController } from './photos/concierge-photos.controller';
import { ConciergePhotosService } from './photos/concierge-photos.service';
import { CsvImportService } from './admin/csv-import.service';
import { ConciergeController } from './concierge.controller';
import { ConciergePublicCsrfController } from './concierge-public-csrf.controller';
import { ConciergeService } from './concierge.service';
import { ConciergeToolExecutorService } from './streaming/concierge-tool-executor.service';
import { ConciergeReviewService } from './concierge-review.service';
import { IpThrottlerGuard } from './guards/ip-throttler.guard';
import { ConciergeCsrfMiddleware } from './csrf.middleware';
import { FoursquareClient } from './clients/foursquare.client';
import { VerifyAttemptLimiterService } from './verify-attempt-limiter.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule, // isGlobal: true in AppModule, but explicit import for clarity
    // JwtModule.register({}) — no default secret; ConciergeReviewService passes the
    // secret inline per sign/verify call (same pattern as ReviewsService).
    JwtModule.register({}),
    MulterModule.register({}), // FileInterceptor for CSV import
    PricingModule, // exports PricingService — required by check_availability tool (Phase 2)
    // ThrottlerModule.forRoot for IpThrottlerGuard (20 msg/hr per IP, CON-06)
    // NOT registered as global APP_GUARD — scoped to @Sse method in ConciergeController
    ThrottlerModule.forRoot([{ name: 'concierge-ip', ttl: 3_600_000, limit: 20 }]),
  ],
  controllers: [
    ConciergeController,          // GET /api/concierge/chat (08-02, public SSE via @Sse)
    ConciergePublicCsrfController, // GET /api/public/concierge/csrf-token (08-02)
    ConciergeAdminController,     // Admin CRUD (08-01)
    ConciergePhotosController,    // R2 photo presign (08-01)
  ],
  providers: [
    ConciergeRepository,
    TokenBudgetService,
    AuditLogRepository,
    ConciergeAdminService,
    ConciergeAdminRepository,
    ConciergePhotosService,
    CsvImportService,
    // 08-02 additions
    ConciergeService,
    ConciergeToolExecutorService,
    // Phase 3 — verified review flow (cédula+apellido)
    ConciergeReviewService,
    // S03 security fix — per-tool verify attempt limiter (5 attempts/hr/IP)
    VerifyAttemptLimiterService,
    IpThrottlerGuard,
    ConciergeCsrfMiddleware,
    FoursquareClient,
    // OPENAI_CLIENT factory (same pattern as Phase 07 AiAssistantModule)
    // Supports Kimi (Moonshot AI) via OPENAI_BASE_URL env var
    {
      provide: 'OPENAI_CLIENT',
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('OPENAI_API_KEY') || 'sk-dev-placeholder';
        const baseURL = config.get<string>('OPENAI_BASE_URL');
        return new OpenAI({ apiKey, baseURL });
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    ConciergeRepository,
    TokenBudgetService,
    AuditLogRepository,
    CsvImportService,
    // Exported for potential cross-module use
    ConciergeService,
  ],
})
export class ConciergeModule implements OnModuleInit {
  /**
   * configure — apply ConciergeCsrfMiddleware to GET /api/concierge/chat.
   *
   * MEDIUM-2 fix: The concierge chat endpoint uses @Sse() which is GET, not POST.
   * The previous config applied CSRF to POST — a method that does not exist on
   * this route — so CSRF validation was never executed.
   *
   * However, csrf-csrf is configured with `ignoredMethods: ['GET', 'HEAD', 'OPTIONS']`,
   * meaning the doubleCsrfProtection middleware passes through on GET without
   * validating the token. This is by design: GET requests are not subject to CSRF
   * per OWASP guidelines (safe method, no state mutation at the HTTP layer).
   *
   * The concierge SSE endpoint does have server-side effects (AI token spend,
   * audit logging), but these are idempotent read-like operations — not state
   * mutations an attacker could exploit via CSRF. The real abuse vector is
   * denial-of-wallet (burning OpenAI tokens), which is mitigated by
   * IpThrottlerGuard (20 msg/hr per IP).
   *
   * Correction: apply middleware to GET so the CSRF **cookie** is still set
   * (the middleware runs but skips validation for GET). This keeps the cookie
   * lifecycle intact for the ConciergePublicCsrfController token endpoint.
   * If the endpoint ever changes to POST, CSRF validation will activate
   * automatically because POST is not in ignoredMethods.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ConciergeCsrfMiddleware)
      .forRoutes({ path: 'concierge/chat', method: RequestMethod.GET });
  }

  onModuleInit(): void {
    const toolCount = Object.keys(CONCIERGE_TOOL_REGISTRY).length;
    if (toolCount !== 10) {
      throw new Error(
        `[ConciergeModule] Tool registry must have exactly 10 tools, found ${toolCount}. ` +
          'Update CONCIERGE_TOOL_REGISTRY in concierge-tool-registry.ts to add/remove tools.',
      );
    }
  }
}
