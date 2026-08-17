import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { PublicBookingService } from './public-booking.service';
import { AvailabilityService } from '../reservations/availability.service';
import { generateCsrfToken } from './csrf.middleware';
import { PublicAvailabilityQuerySchema } from './dto/public-availability-query.dto';
import { CreatePublicBookingSchema } from './dto/create-public-booking.dto';

/**
 * PublicBookingController — public-facing booking engine endpoints.
 *
 * W5 fix: @UseGuards(ThrottlerGuard) is applied ONLY at this controller class level.
 * Authenticated staff controllers (InventoryController, ReservationsController, etc.)
 * do NOT have ThrottlerGuard — they are protected by JwtAuthGuard only.
 *
 * This prevents IP-based rate limiting from throttling staff search-as-you-type
 * and calendar navigation flows.
 *
 * NO JwtAuthGuard anywhere here — this is the public surface.
 * CSRF protection is handled by CsrfMiddleware mounted in PublicBookingModule.configure().
 */
@Controller('public')
@UseGuards(ThrottlerGuard)
export class PublicBookingController {
  constructor(
    private readonly service: PublicBookingService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  /**
   * GET /api/public/csrf-token
   *
   * Sets the CSRF secret cookie and returns the double-submit token.
   * Frontend must call this on page mount BEFORE any POST.
   * Not throttled at the Throttle decorator level (default 20/min from ThrottlerModule applies).
   */
  @Get('csrf-token')
  getCsrfToken(@Req() req: any, @Res({ passthrough: true }) res: any): { csrfToken: string } {
    const token = generateCsrfToken(req, res);
    return { csrfToken: token };
  }

  /**
   * GET /api/public/room-types
   *
   * 2026-05-27 — Entry point of the 'request-to-book by type' public flow.
   * Returns the catalogue of published room types (name, description, price,
   * amenities, sample photo) WITHOUT exposing availability counts or 'sold out'
   * states — the admin owns availability and contacts the guest as needed.
   */
  @Get('room-types')
  async getRoomTypes(): Promise<Awaited<ReturnType<PublicBookingService['listPublishedRoomTypes']>>> {
    // Returns a direct array (NOT wrapped) — the public-portal homepage (Phase 12)
    // and the new public booking flow (2026-05-27) both consume the same shape.
    return this.service.listPublishedRoomTypes();
  }

  /**
   * GET /api/public/availability?checkIn=&checkOut=&adults=
   *
   * Legacy endpoint kept for compatibility. The new 'request-to-book' flow uses
   * /api/public/room-types and skips per-room availability entirely.
   */
  @Get('availability')
  async getAvailability(@Query() query: unknown): Promise<{ rooms: any[] }> {
    const result = PublicAvailabilityQuerySchema.safeParse(query);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid request body',
        issues: result.error.issues,
      });
    }
    const parsed = result.data;
    const checkIn = new Date(parsed.checkIn + 'T00:00:00.000Z');
    const checkOut = new Date(parsed.checkOut + 'T00:00:00.000Z');
    const rooms = await this.availabilityService.searchAvailable(checkIn, checkOut, parsed.adults);
    // Strip any staff-internal fields before responding to public consumers
    return {
      rooms: rooms.map((room) => ({
        id: room.id,
        number: room.number,
        floor: room.floor,
        roomTypeId: room.roomTypeId,
        photos: (room as any).photos ?? [],
        pricing: room.pricing,
      })),
    };
  }

  /**
   * POST /api/public/bookings
   *
   * Creates a Guest + CONFIRMED Reservation in a single $transaction.
   * Throttled to 5/min per IP (more restrictive than the class default).
   * CSRF-protected via CsrfMiddleware (see module configure()).
   */
  @Post('bookings')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  async createBooking(
    @Body() body: unknown,
  ): Promise<{ reservationId: string; guestName: string; total: number }> {
    const result = CreatePublicBookingSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid request body',
        issues: result.error.issues,
      });
    }
    return this.service.createBooking(result.data);
  }
}
