import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { FolioModule } from '../folio/folio.module';
import { PricingModule } from '../pricing/pricing.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { NightAuditController } from './night-audit.controller';
import { NightAuditService } from './night-audit.service';

/**
 * NightAuditModule — night audit cron + backfill endpoint.
 *
 * PrismaModule is @Global — no import needed.
 * SharedModule (JwtAuthGuard, RolesGuard) is @Global — no import needed.
 * ScheduleModule.forRoot() is registered in AppModule — @Cron decorators will fire.
 *
 * Imports:
 *  - SystemConfigModule: getIvaRate(), getHotelBusinessDate(), advanceBusinessDate()
 *  - FolioModule: FolioService (exported from FolioModule — used for dependency resolution)
 *  - PricingModule: PricingService.calculateBreakdown() for nightly rate
 *  - ReviewsModule: ReviewsService.sendPendingReviewInvites() — Phase 14 review invite batch
 *    One-way dependency: NightAuditModule → ReviewsModule (ReviewsModule does NOT import NightAuditModule).
 *
 * UsersModule is NOT imported — PrismaService (global) is used directly to
 * query users.findFirst({role: 'ADMIN'}) in resolveSystemUserId().
 */
@Module({
  imports: [SystemConfigModule, FolioModule, PricingModule, ReviewsModule],
  controllers: [NightAuditController],
  providers: [NightAuditService],
  exports: [NightAuditService],
})
export class NightAuditModule {}
