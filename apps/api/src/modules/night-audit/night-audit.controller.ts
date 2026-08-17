import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { NightAuditService } from './night-audit.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { BackfillSchema } from './dto/backfill.dto';

/**
 * NightAuditController — manual trigger endpoints for ADMIN/MANAGER.
 *
 * RBAC (RESEARCH section 3.9):
 *  - POST /backfill — ADMIN or MANAGER
 *  - POST /run-now  — ADMIN only
 */
@Controller('night-audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NightAuditController {
  constructor(
    private readonly nightAuditService: NightAuditService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  /**
   * POST /api/night-audit/backfill?date=YYYY-MM-DD
   *
   * Runs the night audit for a specific past (or current) business date.
   * Idempotent: calling twice for the same date returns { skipped: true }.
   * Required role: ADMIN or MANAGER.
   */
  @Post('backfill')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.OK)
  async backfill(@Query('date') date: string) {
    // Validate input with Zod v4 (uses .issues not .errors)
    const parsed = BackfillSchema.safeParse({ businessDate: date });
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      throw new BadRequestException(msg);
    }

    const businessDate = new Date(parsed.data.businessDate + 'T00:00:00.000Z');
    return this.nightAuditService.runForBusinessDate(businessDate);
  }

  /**
   * POST /api/night-audit/run-now
   *
   * Runs the night audit for the current hotel_business_date.
   * Convenience endpoint for manual trigger from NightAuditPage.
   * Required role: ADMIN only.
   */
  @Post('run-now')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async runNow() {
    const bd = await this.systemConfig.getHotelBusinessDate();
    if (!bd) {
      throw new BadRequestException(
        'No hotel_business_date configured — cannot run night audit',
      );
    }
    return this.nightAuditService.runForBusinessDate(bd);
  }
}
