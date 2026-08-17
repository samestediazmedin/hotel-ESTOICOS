import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PublicReservationsService, ReservationLookupDto } from './public-reservations.service';

/**
 * Public endpoint for guests to complete pending reservations.
 * No authentication required — guests use email + confirmation code.
 */
@Controller('public/reservations')
export class PublicReservationsController {
  constructor(private readonly service: PublicReservationsService) {}

  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  async lookup(@Body() dto: ReservationLookupDto) {
    return this.service.lookupReservation(dto);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async complete(@Body('reservationId') reservationId: string) {
    return this.service.completeReservation(reservationId);
  }
}
