import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { PricingRepository } from './pricing.repository';

/**
 * PricingModule — rate plans, seasons, and pricing breakdown.
 *
 * PrismaModule is @Global — no import needed.
 * SharedModule (JwtAuthGuard, RolesGuard) is @Global — no import needed.
 * SystemConfigModule provides SystemConfigService.getIvaRate() — required
 * so IVA is never hardcoded.
 *
 * Exports PricingService so Phase 3 (ReservationsModule) can call
 * calculateBreakdown() during reservation creation price preview.
 */
@Module({
  imports: [SystemConfigModule],
  controllers: [PricingController],
  providers: [PricingService, PricingRepository],
  exports: [PricingService],
})
export class PricingModule {}
