import { Controller, Get, Param } from '@nestjs/common';
import { OffersService } from './offers.service';

/**
 * OffersPublicController — anonymous read endpoints for the homepage.
 *
 * GET /api/public/offers        — active offers within date range
 * GET /api/public/offers/:id    — single offer by id (used by booking flow
 *                                  to read offer.roomType for the lock UI)
 */
@Controller('public/offers')
export class OffersPublicController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  list() {
    return this.offersService.listForPublic();
  }

  /** Single offer lookup — used by the booking flow to enforce room-type lock. */
  @Get(':id')
  get(@Param('id') id: string) {
    return this.offersService.getOffer(id);
  }
}
