import { Module } from '@nestjs/common';
import { PublicReservationsService } from './public-reservations.service';
import { PublicReservationsController } from './public-reservations.controller';

@Module({
  providers: [PublicReservationsService],
  controllers: [PublicReservationsController],
})
export class PublicReservationsModule {}
