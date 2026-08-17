import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ReservationsModule } from '../reservations/reservations.module';
import { GuestsModule } from '../guests/guests.module';
import { PricingModule } from '../pricing/pricing.module';
import { EmailModule } from '../email/email.module';
import { PublicBookingController } from './public-booking.controller';
import { PublicBookingService } from './public-booking.service';
import { CsrfMiddleware } from './csrf.middleware';

/**
 * PublicBookingModule — PUB-01..06 public booking engine.
 *
 * CSRF middleware is mounted ONLY on POST /public/bookings.
 * GET /public/csrf-token and GET /public/availability are exempt
 * (csrf-csrf ignoredMethods: ['GET', 'HEAD', 'OPTIONS']).
 *
 * ThrottlerModule is imported globally in AppModule — no local import needed.
 * ThrottlerGuard is applied at the controller class level (W5 fix — not globally).
 */
@Module({
  imports: [
    ReservationsModule,  // for AvailabilityService (SINGLE GUARD — RES-06)
    GuestsModule,        // for GuestEncryptionService (GST-02)
    PricingModule,       // for PricingService.calculateBreakdown()
    EmailModule,         // for EmailService (PUB-05)
  ],
  controllers: [PublicBookingController],
  providers: [PublicBookingService],
})
export class PublicBookingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .forRoutes(
        { path: 'public/bookings', method: RequestMethod.POST },
      );
    // NOTE: GET /public/csrf-token and GET /public/availability bypass CSRF via
    // ignoredMethods: ['GET', 'HEAD', 'OPTIONS'] in doubleCsrf config.
  }
}
