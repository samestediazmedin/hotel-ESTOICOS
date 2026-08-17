import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GuestsController } from './guests.controller';
import { GuestsService } from './guests.service';
import { GuestsRepository } from './guests.repository';
import { GuestEncryptionService } from './encryption/guest-encryption.service';

/**
 * GuestsModule — guest PII management bounded context.
 *
 * PrismaModule is @Global — no import needed.
 * SharedModule (JwtAuthGuard, RolesGuard) is @Global — no import needed.
 * ConfigModule is imported so GuestEncryptionService can read GUEST_ENCRYPTION_KEY.
 *
 * Exports GuestsService and GuestsRepository for Plan 03-02 ReservationsModule
 * which needs to look up guests and link reservations to guest records.
 */
@Module({
  imports: [ConfigModule],
  controllers: [GuestsController],
  providers: [GuestsService, GuestsRepository, GuestEncryptionService],
  exports: [GuestsService, GuestsRepository, GuestEncryptionService],
})
export class GuestsModule {}
