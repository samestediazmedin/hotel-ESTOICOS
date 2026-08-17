import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { PricingService } from './pricing.service';
import { CreateRatePlanDto } from './dto/create-rate-plan.dto';
import { UpdateRatePlanDto } from './dto/update-rate-plan.dto';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';
import { CreateRatePlanExtraDto } from './dto/create-rate-plan-extra.dto';
import { UpdateRatePlanExtraDto } from './dto/update-rate-plan-extra.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // ─── Rate Plans ───────────────────────────────────────────────────────────

  @Get('rate-plans')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  findAllRatePlans(@Query('roomTypeId') roomTypeId?: string) {
    return this.pricingService.findAllRatePlans(roomTypeId);
  }

  @Post('rate-plans')
  @Roles('ADMIN', 'MANAGER')
  createRatePlan(@Body() dto: CreateRatePlanDto) {
    return this.pricingService.createRatePlan(dto);
  }

  @Get('rate-plans/:id')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  findRatePlan(@Param('id') id: string) {
    return this.pricingService.findRatePlanById(id);
  }

  @Patch('rate-plans/:id')
  @Roles('ADMIN', 'MANAGER')
  updateRatePlan(@Param('id') id: string, @Body() dto: UpdateRatePlanDto) {
    return this.pricingService.updateRatePlan(id, dto);
  }

  @Post('rate-plans/:id/deactivate')
  @Roles('ADMIN', 'MANAGER')
  deactivateRatePlan(@Param('id') id: string) {
    return this.pricingService.deactivateRatePlan(id);
  }

  // ─── Rate Plan Extras ─────────────────────────────────────────────────────

  @Get('rate-plans/:id/extras')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  findExtras(@Param('id') id: string) {
    return this.pricingService.findExtrasByPlanId(id);
  }

  @Post('rate-plans/:id/extras')
  @Roles('ADMIN', 'MANAGER')
  createExtra(@Param('id') id: string, @Body() dto: CreateRatePlanExtraDto) {
    return this.pricingService.createExtra(id, dto);
  }

  @Patch('extras/:extraId')
  @Roles('ADMIN', 'MANAGER')
  updateExtra(
    @Param('extraId') extraId: string,
    @Body() dto: UpdateRatePlanExtraDto,
  ) {
    return this.pricingService.updateExtra(extraId, dto);
  }

  @Delete('extras/:extraId')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(204)
  deleteExtra(@Param('extraId') extraId: string) {
    return this.pricingService.deleteExtra(extraId);
  }

  // ─── Seasons ──────────────────────────────────────────────────────────────

  // 2026-05-29 — re-keyed from ?ratePlanId to ?roomTypeId.
  // Seasons are now a property of the room type (shared by all its plans).
  @Get('seasons')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  findSeasons(@Query('roomTypeId') roomTypeId: string) {
    return this.pricingService.findSeasonsByRoomType(roomTypeId);
  }

  @Post('seasons')
  @Roles('ADMIN', 'MANAGER')
  createSeason(@Body() dto: CreateSeasonDto) {
    return this.pricingService.createSeason(dto);
  }

  @Patch('seasons/:id')
  @Roles('ADMIN', 'MANAGER')
  updateSeason(@Param('id') id: string, @Body() dto: UpdateSeasonDto) {
    return this.pricingService.updateSeason(id, dto);
  }

  @Delete('seasons/:id')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(204)
  deleteSeason(@Param('id') id: string) {
    return this.pricingService.deleteSeason(id);
  }

  // ─── Pricing Calculation ──────────────────────────────────────────────────

  /**
   * GET /pricing/calculate?roomTypeId=X&checkIn=2026-06-01&checkOut=2026-06-03
   *
   * Parses dates as UTC midnight to prevent timezone off-by-one errors.
   * Returns a full PricingBreakdown — NEVER a single number.
   */
  @Get('calculate')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  calculatePrice(
    @Query('roomTypeId') roomTypeId: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('ratePlanType') ratePlanType?: 'BAR' | 'PROMO' | 'PACKAGE',
  ) {
    // Parse dates as UTC midnight — avoids timezone shift (Bogotá = UTC-5)
    const checkInDate = new Date(checkIn + 'T00:00:00.000Z');
    const checkOutDate = new Date(checkOut + 'T00:00:00.000Z');
    return this.pricingService.calculateBreakdown({
      roomTypeId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      ratePlanType: ratePlanType ?? 'BAR',
    });
  }
}
