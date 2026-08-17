import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { PublicPortalService } from './public-portal.service';
import { PricingService } from '../pricing/pricing.service';
import type { PublicHotelInfoDto } from './dto/public-hotel-info.dto';
import type { PublicRoomTypeDto } from './dto/public-room-type.dto';
import type { PublicHotelPhotoDto } from './dto/public-hotel-photo.dto';
import { RateOptionsQuerySchema } from './dto/rate-options-query.dto';
import type { RatePlanOption } from '../pricing/dto/pricing-breakdown.dto';

/**
 * PublicPortalController — public-facing hotel marketing data (Phase 12 — PDA-01..03).
 *
 * NO @UseGuards(JwtAuthGuard) — JwtAuthGuard is NOT global in this app (confirmed:
 * no APP_GUARD in app.module.ts). Public means: no auth guard. Pattern mirrors
 * PublicBookingController which also uses @Controller('public') with no auth guards.
 *
 * LOW-3 fix: @UseGuards(ThrottlerGuard) added to prevent scraping / abuse.
 * Uses the global ThrottlerModule config (short: 20/min, long: 100/hr).
 * Same pattern as PublicBookingController.
 *
 * NO CSRF — read-only GETs (no state mutations).
 *
 * Shares the `/api/public` prefix with PublicBookingController. NestJS routes by
 * full HTTP method + path — no collision with existing routes:
 *   GET /api/public/csrf-token         (PublicBookingController)
 *   GET /api/public/availability       (PublicBookingController)
 *   POST /api/public/bookings          (PublicBookingController)
 *   GET /api/public/hotel-info         ← THIS controller
 *   GET /api/public/room-types         ← THIS controller
 *   GET /api/public/hotel-photos       ← THIS controller
 *   GET /api/public/rate-options       ← THIS controller (Phase rate-plans)
 *
 * Cache-Control: public, max-age=60, s-maxage=60
 *   - `public`: CDN-cacheable (no Authorization header needed for these routes)
 *   - `max-age=60`: browser cache 60 seconds
 *   - `s-maxage=60`: CDN cache 60 seconds
 *   Admin changes propagate to the portal within ~60 seconds.
 */
@Controller('public')
@UseGuards(ThrottlerGuard)
export class PublicPortalController {
  constructor(
    private readonly service: PublicPortalService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * GET /api/public/hotel-info
   *
   * Returns hotel identity data: name, address, tagline, description, phone,
   * rating (v1.2 placeholder 4.84), reviewCount (v1.2 placeholder 318), tags.
   * No Authorization header required.
   */
  @Get('hotel-info')
  @Throttle({ default: { limit: 100, ttl: 60_000 } }) // 100/min for read-only public data
  @Header('Cache-Control', 'public, max-age=60, s-maxage=60')
  async getHotelInfo(): Promise<PublicHotelInfoDto> {
    return this.service.getHotelInfo();
  }

  /**
   * GET /api/public/room-types
   *
   * Returns published room types filtered to isPublished=true, sorted by basePrice ASC.
   * First result has badge "Más económica", second has "Mejor valor", rest null.
   * No Authorization header required.
   */
  @Get('room-types')
  @Throttle({ default: { limit: 100, ttl: 60_000 } }) // 100/min for read-only public data
  @Header('Cache-Control', 'public, max-age=60, s-maxage=60')
  async getRoomTypes(): Promise<PublicRoomTypeDto[]> {
    return this.service.getPublishedRoomTypes();
  }

  /**
   * GET /api/public/hotel-photos
   *
   * Returns hotel gallery photos sorted by displayOrder ASC.
   * No Authorization header required.
   */
  @Get('hotel-photos')
  @Throttle({ default: { limit: 100, ttl: 60_000 } }) // 100/min for read-only public data
  @Header('Cache-Control', 'public, max-age=60, s-maxage=60')
  async getHotelPhotos(): Promise<PublicHotelPhotoDto[]> {
    return this.service.getHotelPhotos();
  }

  /**
   * GET /api/public/rate-options?roomTypeId=<cuid>&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&adults=<n>
   *
   * Returns all active rate plans available for the given room type and date range,
   * each with a fully itemized PricingBreakdown including extras.
   *
   * Unauthenticated — the public booking engine calls this to render the
   * "choose your rate" step (Booking.com-style rate selector).
   *
   * If the room type has no active plans, returns a single synthetic "Base Rate" option.
   *
   * Date parsing: UTC midnight (new Date(s+'T00:00:00.000Z')) — consistent with
   * the existing convention in pricing.controller.ts.
   *
   * All Decimal values are serialized to plain numbers by PricingService —
   * no Prisma Decimal objects leak through the HTTP boundary.
   *
   * No Cache-Control header: pricing is date-dependent; CDN caching is inappropriate.
   */
  @Get('rate-options')
  @Throttle({ default: { limit: 50, ttl: 60_000 } }) // 50/min for rate calculations
  async getRateOptions(
    @Query() rawQuery: Record<string, string>,
  ): Promise<RatePlanOption[]> {
    const parsed = RateOptionsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      const messages = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw new BadRequestException(`Parámetros inválidos: ${messages}`);
    }
    const { roomTypeId, checkIn, checkOut, adults } = parsed.data;

    const checkInDate = new Date(checkIn + 'T00:00:00.000Z');
    const checkOutDate = new Date(checkOut + 'T00:00:00.000Z');

    if (checkOutDate <= checkInDate) {
      throw new BadRequestException(
        'checkOut debe ser posterior a checkIn',
      );
    }

    return this.pricingService.calculateAllPlans({
      roomTypeId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      adults,
    });
  }
}
