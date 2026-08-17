import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ReservationsService } from './reservations.service';
import { AvailabilityService } from './availability.service';
import { CreateReservationPipe, CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationPipe, UpdateReservationDto } from './dto/update-reservation.dto';
import { SearchAvailabilityQuerySchema } from './dto/search-availability.dto';
import { BadRequestException } from '@nestjs/common';

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  // ─── Availability (single guard — RES-06) ─────────────────────────────────

  /**
   * GET /api/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&adults=N
   * Returns rooms not booked for the requested range, with pricing.
   */
  @Get('/availability')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async searchAvailability(@Query() query: Record<string, string>) {
    const result = SearchAvailabilityQuerySchema.safeParse({
      ...query,
      adults: query['adults'] !== undefined ? Number(query['adults']) : undefined,
    });
    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }
    const { checkIn, checkOut, adults } = result.data;
    const checkInDate = new Date(checkIn + 'T00:00:00.000Z');
    const checkOutDate = new Date(checkOut + 'T00:00:00.000Z');
    const rooms = await this.availabilityService.searchAvailable(checkInDate, checkOutDate, adults);
    return { rooms };
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  /**
   * GET /api/reservations?from=&to=&status=&roomId=&guestId=
   * Returns reservations matching optional filters.
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('roomId') roomId?: string,
    @Query('guestId') guestId?: string,
  ) {
    return this.reservationsService.findAll({ from, to, status, roomId, guestId });
  }

  // ─── Get one ───────────────────────────────────────────────────────────────

  /**
   * GET /api/reservations/:id
   * HOUSEKEEPING can read reservations (for room assignment context).
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING')
  findOne(@Param('id') id: string) {
    return this.reservationsService.findById(id);
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  /**
   * POST /api/reservations
   * Creates a reservation with SELECT FOR UPDATE + exclusion constraint guard.
   * Returns 409 if the room is already booked for overlapping dates.
   */
  @Post()
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  create(@Body(CreateReservationPipe) dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }

  // ─── Modify ────────────────────────────────────────────────────────────────

  /**
   * PATCH /api/reservations/:id
   * Modify dates, room, or guest. Only PENDING or CONFIRMED reservations.
   * Returns 409 if new dates conflict with existing reservation.
   */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  modify(@Param('id') id: string, @Body(UpdateReservationPipe) dto: UpdateReservationDto) {
    return this.reservationsService.modify(id, dto);
  }

  // ─── Cancel ────────────────────────────────────────────────────────────────

  /**
   * POST /api/reservations/:id/cancel
   * Sets status to CANCELLED — never deletes the row.
   * Releasing the date slot is automatic (exclusion constraint WHERE excludes CANCELLED).
   */
  @Post(':id/cancel')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  cancel(@Param('id') id: string) {
    return this.reservationsService.cancel(id);
  }

  // ─── Request-to-book lifecycle (2026-05-27) ──────────────────────────────

  /**
   * POST /api/reservations/:id/confirm
   *
   * Admin path for the public 'request-to-book' flow: moves a PENDING reservation
   * to CONFIRMED. Public bookings always land as PENDING; staff explicitly approve
   * each one after reviewing dates/type/availability and (optionally) contacting
   * the guest via the WhatsApp/Email/Call buttons on the guest detail view.
   */
  @Post(':id/confirm')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  confirmRequest(@Param('id') id: string) {
    return this.reservationsService.confirmRequest(id);
  }

  /**
   * POST /api/reservations/:id/reject
   *
   * Admin path for the public 'request-to-book' flow: moves a PENDING reservation
   * to CANCELLED. Optional body { reason } is appended to the reservation notes so
   * the rejection rationale is preserved for audit.
   */
  @Post(':id/reject')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  rejectRequest(
    @Param('id') id: string,
    @Body() body: { reason?: string } = {},
  ) {
    return this.reservationsService.rejectRequest(id, body?.reason);
  }

  /**
   * POST /api/reservations/:id/reactivate
   *
   * Restores a CANCELLED reservation back to PENDING. Used to recover from
   * accidental cancellations or to re-engage a previously rejected guest
   * who later confirmed by phone/WhatsApp.
   */
  @Post(':id/reactivate')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  reactivate(@Param('id') id: string) {
    return this.reservationsService.reactivate(id);
  }
}
