import { Module } from '@nestjs/common';
import { GuestsModule } from '../guests/guests.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingModule } from '../pricing/pricing.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { ReservationsRepository } from './reservations.repository';
import { AvailabilityService } from './availability.service';

/**
 * ReservationsModule — reservation lifecycle + availability guard (RES-01..07).
 *
 * Imports:
 * - GuestsModule: for GuestsRepository.findById() to validate guestId at creation
 * - InventoryModule: for InventoryRepository.findAvailableRooms() (SINGLE GUARD) + findRoomById()
 * - PricingModule: for PricingService.calculateBreakdown() in AvailabilityService
 *
 * Exports:
 * - ReservationsService: Plans 03-03 (staff wizard UI) and 03-04 (public booking) consume this
 * - AvailabilityService: SINGLE GUARD — the only availability query point in the codebase
 */
@Module({
  imports: [GuestsModule, InventoryModule, PricingModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsRepository, AvailabilityService],
  exports: [ReservationsService, AvailabilityService],
})
export class ReservationsModule {}
