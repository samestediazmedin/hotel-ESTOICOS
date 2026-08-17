import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import OpenAI from 'openai';
import { ReportingModule } from '../reporting/reporting.module';
import { GuestsModule } from '../guests/guests.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { FolioModule } from '../folio/folio.module';
import { AvailabilityService } from '../reservations/availability.service';
import { DashboardService } from '../reporting/dashboard.service';
import { GuestsService } from '../guests/guests.service';
import { ReservationsService } from '../reservations/reservations.service';
import { FolioService } from '../folio/folio.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiAssistantController } from './ai-assistant.controller';
import { ConversationRepository } from './conversation.repository';
import { AiToolCallLogRepository } from './audit-log.repository';
import { AiAssistantService } from './ai-assistant.service';
import { ToolExecutorService } from './tool-executor.service';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { sanitizeInput } from './sanitize';
import type { ToolDeps } from './tool-registry';

/**
 * AiAssistantModule — NestJS module for the staff AI assistant (Phase 07 + 23).
 *
 * Architecture:
 * - Imports ReportingModule, GuestsModule, ReservationsModule, FolioModule
 *   to access their exported services via DI.
 * - OPENAI_CLIENT: module-level singleton created from ConfigService.getOrThrow('OPENAI_API_KEY').
 *   Fails fast at boot if OPENAI_API_KEY is not set.
 * - TOOL_DEPS: factory provider that assembles all service dependencies for ToolExecutorService.
 *   AI-23: Now includes PrismaService for direct room/task queries (housekeeping tools).
 *
 * W5 PATTERN (from Phase 03-04):
 * - ThrottlerModule is imported HERE (not globally).
 * - UserThrottlerGuard applied at the @Sse('stream') method level only.
 * - This prevents AI chat throttle from affecting other staff endpoints.
 * - Throttle: 30 messages per user per hour ('ai-chat' throttler name).
 *
 * Exports:
 * - ToolExecutorService: Plan 07-02 AiAssistantService uses this to execute tool calls.
 * - ConversationRepository: Plan 07-02 AiAssistantService uses this to persist messages.
 * - OPENAI_CLIENT: Plan 07-02 AiAssistantService injects this token.
 */
@Module({
  imports: [
    ReportingModule,
    GuestsModule,
    ReservationsModule,
    FolioModule,
    ThrottlerModule.forRoot([
      {
        name: 'ai-chat',
        ttl: 3_600_000, // 1 hour in ms
        limit: 30,      // 30 messages per user per hour (AI-10)
      },
    ]),
  ],
  controllers: [AiAssistantController],
  providers: [
    ConversationRepository,
    AiToolCallLogRepository,
    ToolExecutorService,
    AiAssistantService,
    UserThrottlerGuard,
    {
      provide: 'OPENAI_CLIENT',
      useFactory: (config: ConfigService): OpenAI => {
        const apiKey = config.get<string>('OPENAI_API_KEY') || 'sk-dev-placeholder';
        const baseURL = config.get<string>('OPENAI_BASE_URL');
        return new OpenAI({ apiKey, baseURL });
      },
      inject: [ConfigService],
    },
    {
      provide: 'TOOL_DEPS',
      useFactory: (
        availability: AvailabilityService,
        dashboard: DashboardService,
        guests: GuestsService,
        reservations: ReservationsService,
        folio: FolioService,
        prisma: PrismaService,
      ): ToolDeps => ({
        availability,
        dashboard,
        guests,
        reservations,
        folio,
        prisma,
        sanitize: sanitizeInput,
      }),
      inject: [AvailabilityService, DashboardService, GuestsService, ReservationsService, FolioService, PrismaService],
    },
  ],
  exports: [ToolExecutorService, ConversationRepository, 'OPENAI_CLIENT'],
})
export class AiAssistantModule {}
