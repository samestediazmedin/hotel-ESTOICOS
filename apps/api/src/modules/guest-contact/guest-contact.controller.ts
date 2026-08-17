import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { GuestContactService } from './guest-contact.service';
import { CreateContactEventPipe, CreateContactEventDto } from './dto/create-contact-event.dto';

interface JwtPayload {
  sub: string;
  role: string;
  email: string;
}

/**
 * GuestContactController — 2 routes for guest contact events.
 *
 * Both routes require JWT auth + staff role (all 4 roles allowed).
 * Controller path: guests/:id/contact-events (prefix applied by module).
 *
 * POST /api/guests/:id/contact-events — log a contact event
 * GET  /api/guests/:id/contact-events — list recent events (limit=5 default)
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('guests/:id/contact-events')
export class GuestContactController {
  constructor(private readonly service: GuestContactService) {}

  /**
   * POST /api/guests/:id/contact-events
   *
   * Body: { method: 'CALL'|'WHATSAPP'|'EMAIL', notes?: string }
   * Returns: 201 + ContactEventResponseDto (includes staffUser.name)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING')
  create(
    @Param('id') guestId: string,
    @Body(CreateContactEventPipe) dto: CreateContactEventDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createEvent(guestId, dto, user.sub);
  }

  /**
   * GET /api/guests/:id/contact-events?limit=5
   *
   * Returns: ContactEventResponseDto[] ordered by createdAt DESC
   * limit: 1..50, default 5 (clamped by service)
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING')
  list(
    @Param('id') guestId: string,
    @Query('limit') limit?: string,
  ) {
    // Guard against NaN: parseInt('abc', 10) → NaN; NaN || 5 === 5
    const n = limit !== undefined ? (parseInt(limit, 10) || 5) : 5;
    return this.service.listEvents(guestId, n);
  }
}
