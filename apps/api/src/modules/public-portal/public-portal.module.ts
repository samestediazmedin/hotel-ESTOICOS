import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { PublicPortalController } from './public-portal.controller';
import { PublicPortalService } from './public-portal.service';

/**
 * PublicPortalModule — exposes public GET endpoints for hotel marketing data (Phase 12)
 * and the rate-options endpoint (rate plan selection step, added Phase rate-plans).
 *
 * No CSRF middleware needed (GET-only, no state mutations).
 * ThrottlerGuard applied at controller level (LOW-3 fix: prevent scraping/abuse).
 *
 * Imports:
 * - SystemConfigModule: provides SystemConfigService (exports it)
 * - PrismaModule: provides PrismaService for RoomType + HotelPhoto queries
 * - PricingModule: provides PricingService.calculateAllPlans() for rate-options endpoint
 */
@Module({
  imports: [
    SystemConfigModule, // exports SystemConfigService
    PrismaModule,       // exports PrismaService — needed for RoomType + HotelPhoto queries
    PricingModule,      // exports PricingService — needed for GET /rate-options
  ],
  controllers: [PublicPortalController],
  providers: [PublicPortalService],
})
export class PublicPortalModule {}
