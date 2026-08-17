import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { ReviewsService } from './reviews.service';
import { ReviewsPublicController } from './reviews-public.controller';
import { ReviewsAdminController } from './reviews-admin.controller';

/**
 * ReviewsModule — Phase 14 public reviews system.
 *
 * Registers a dedicated throttler for the POST /public/reviews route:
 * 'reviews-submit' — 5 submissions per IP per hour.
 *
 * This is separate from the global 'short' throttler (60s / 20 req)
 * and 'long' throttler (3600s / 100 req) to avoid cross-contamination
 * with other public endpoints. Follows the ConciergeModule pattern.
 *
 * JwtModule.register({}) — no default secret.
 * ReviewsService passes the secret inline per sign/verify call,
 * exactly like TokenService in AuthModule.
 *
 * ReviewsService is exported so NightAuditModule can inject it
 * for the sendPendingReviewInvites() implementation (Plan 14-02).
 *
 * EmailModule: provides EmailService.sendReviewInvite for invite emails.
 * SystemConfigModule: provides SystemConfigService.getHotelName() for email copy.
 */
@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([
      { name: 'reviews-submit', ttl: 3_600_000, limit: 5 },
    ]),
    EmailModule,
    SystemConfigModule,
  ],
  controllers: [ReviewsPublicController, ReviewsAdminController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
