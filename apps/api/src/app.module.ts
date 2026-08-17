import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { GuestsModule } from './modules/guests/guests.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { PublicBookingModule } from './modules/public-booking/public-booking.module';
import { PublicPortalModule } from './modules/public-portal/public-portal.module';
import { FolioModule } from './modules/folio/folio.module';
import { OperationsModule } from './modules/operations/operations.module';
import { NightAuditModule } from './modules/night-audit/night-audit.module';
import { TRAExportModule } from './modules/tra-export/tra-export.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { ConciergeModule } from './modules/concierge/concierge.module';
import { HotelPhotosModule } from './modules/hotel-photos/hotel-photos.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { GuestContactModule } from './modules/guest-contact/guest-contact.module';
import { StorageModule } from './modules/storage/storage.module';
import { OffersModule } from './modules/offers/offers.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { EmailTemplatesModule } from './modules/email-templates/email-templates.module';
import { PublicReservationsModule } from './modules/public-reservations/public-reservations.module';
import { HealthModule } from './health/health.module';

/**
 * W5 fix: ThrottlerModule is imported globally so @Throttle() decorators resolve,
 * but ThrottlerGuard is NOT registered as APP_GUARD here.
 *
 * Rationale: A global APP_GUARD with a 20/min limit would throttle authenticated
 * staff endpoints (inventory search-as-you-type, calendar navigation, etc.) and
 * break staff UX. ThrottlerGuard is applied ONLY at the PublicBookingController
 * class level via @UseGuards(ThrottlerGuard) — staff controllers are unaffected.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 60_000, limit: 20 },
        { name: 'long', ttl: 3_600_000, limit: 100 },
      ],
    }),
    ScheduleModule.forRoot(),
    // EventEmitterModule MUST be registered globally BEFORE any module that uses it.
    // global: true makes EventEmitter2 injectable in all modules without per-module imports.
    EventEmitterModule.forRoot({
      wildcard: false,
      global: true,
    }),
    PrismaModule,
    SharedModule,
    AuthModule,
    UsersModule,
    SystemConfigModule,
    InventoryModule,
    PricingModule,
    GuestsModule,
    ReservationsModule,
    PublicBookingModule,
    PublicPortalModule,
    FolioModule,
    OperationsModule,
    NightAuditModule,
    TRAExportModule,
    // HousekeepingModule MUST come after EventEmitterModule (global above)
    // CheckoutListener in HousekeepingModule listens to 'reservation.checked_out'
    HousekeepingModule,
    ReportingModule,
    // AiAssistantModule MUST come after ReportingModule (needs DashboardService exported from it)
    AiAssistantModule,
    // ConciergeModule: public guest-facing chatbot + admin catalog management (Phase 08)
    ConciergeModule,
    // HotelPhotosModule: admin CRUD for hotel hero gallery (Phase 13 — HSP-05)
    HotelPhotosModule,
    // ReviewsModule: public review submission + staff moderation queue (Phase 14)
    ReviewsModule,
    // GuestContactModule: POST/GET /api/guests/:id/contact-events + Socket.io gateway (Phase 16 — GCC-06..08)
    GuestContactModule,
    // StorageModule: filesystem-first image storage (2026-05-28) — @Global, must come before any feature module that uses StorageService
    StorageModule,
    // OffersModule: admin CRUD + public read for homepage offers (2026-05-28)
    OffersModule,
    // RemindersModule: pre-arrival reminder cron (Phase 24 — REM-01..04)
    RemindersModule,
    // EmailTemplatesModule: reusable email templates with variable substitution (Phase 25 — TPL-01..04)
    EmailTemplatesModule,
    // PublicReservationsModule: online reservation completion flow (Phase 26 — ORC-01..04)
    PublicReservationsModule,
    // HealthModule: health check endpoint for CI/CD and monitoring
    HealthModule,
  ],
})
export class AppModule {}
