import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { GuestsService } from './guests.service';
import { CreateGuestPipe } from './dto/create-guest.dto';
import { UpdateGuestPipe } from './dto/update-guest.dto';

interface JwtPayload {
  sub: string;
  role: string;
  email: string;
}

/**
 * GuestsController — 6 routes, all behind JwtAuthGuard + RolesGuard.
 *
 * RBAC field exclusion (GST-05):
 *   HOUSEKEEPING role → toPublicDto (no documentNumber)
 *   ADMIN/MANAGER/RECEPTION → toResponseDto (decrypted documentNumber)
 *
 * This branch is the LITMUS TEST for GST-05. Any refactor of this logic
 * must verify that a HOUSEKEEPING JWT cannot read documentNumber.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  /**
   * GET /api/guests — list guests with optional search and pagination.
   * All staff roles allowed; HOUSEKEEPING receives GuestPublicDto[].
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING')
  async findAll(
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const skipN = skip ? Number.parseInt(skip, 10) : 0;
    const takeN = take ? Number.parseInt(take, 10) : 50;
    const guests = await this.guestsService.findAll(skipN, takeN, search);

    if (user?.role === 'HOUSEKEEPING') {
      return guests.map((g) => this.guestsService.toPublicDto(g as any));
    }
    return guests.map((g) => this.guestsService.toResponseDto(g as any));
  }

  /**
   * GET /api/guests/:id — single guest.
   * HOUSEKEEPING receives GuestPublicDto (no documentNumber).
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const guest = await this.guestsService.findById(id);
    if (user.role === 'HOUSEKEEPING') {
      return this.guestsService.toPublicDto(guest);
    }
    return this.guestsService.toResponseDto(guest);
  }

  /**
   * POST /api/guests — create a guest.
   * HOUSEKEEPING cannot create guests.
   */
  @Post()
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async create(@Body(CreateGuestPipe) dto: any) {
    return this.guestsService.create(dto);
  }

  /**
   * PATCH /api/guests/:id — update a guest.
   * HOUSEKEEPING cannot edit guests.
   */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  update(@Param('id') id: string, @Body(UpdateGuestPipe) dto: any) {
    return this.guestsService.update(id, dto);
  }

  /**
   * GET /api/guests/:id/history — guest stay history.
   * Returns past reservations with totalNights and totalSpent.
   * HOUSEKEEPING not allowed — history includes financial data.
   */
  @Get(':id/history')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  getHistory(@Param('id') id: string) {
    return this.guestsService.getHistory(id);
  }

  /**
   * POST /api/guests/:id/anonymize — anonymize a guest (ADMIN only, irreversible).
   * Sets anonymizedAt + replaces PII with sentinel values (Pitfall P13).
   */
  @Post(':id/anonymize')
  @Roles('ADMIN')
  async anonymize(@Param('id') id: string) {
    await this.guestsService.anonymize(id);
    const guest = await this.guestsService.findById(id);
    return { anonymizedAt: guest.anonymizedAt?.toISOString() ?? null };
  }

  /**
   * DELETE /api/guests/:id — hard-delete a guest (ADMIN only).
   *
   * Returns 204 No Content on success.
   * Returns 404 if the guest does not exist.
   * Returns 409 if the guest has ≥1 reservation (use anonymize instead).
   */
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.guestsService.remove(id);
  }
}
