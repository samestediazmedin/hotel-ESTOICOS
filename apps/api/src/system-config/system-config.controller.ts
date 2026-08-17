import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { SystemConfigService } from './system-config.service';
import { UpdateSystemConfigSchema } from './dto/update-system-config.dto';

@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  /**
   * GET /api/system-config/public
   * Intentionally public — no @UseGuards.
   * Returns ONLY safe fields: { hotelName }
   * Used by login screen for branding without requiring authentication.
   * NOTE: ivaRate and hotelTimezone are intentionally NOT exposed here.
   */
  @Get('public')
  async getPublicConfig() {
    const hotelName = await this.systemConfigService.getHotelName();
    return { hotelName };
  }

  /**
   * GET /api/system-config (ADMIN) — full config including admin-only fields.
   * Used by /settings/hotel to pre-fill the edit form.
   * Returns flat shape matching the DTO field names (name, not hotelName).
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getAdminConfig() {
    const config = await this.systemConfigService.getConfig();
    if (!config) return null;
    return {
      name: config.hotelName,
      address: config.address ?? '',
      tagline: config.tagline ?? '',
      description: config.description ?? '',
      phone: config.phone ?? '',
      tags: config.tags ?? [],
      displayPricesWithIva: config.displayPricesWithIva,
    };
  }

  /**
   * PATCH /api/system-config (ADMIN) — partial update of hotel identity.
   * Zod-validates the body; writes audit log entry on changed fields.
   *
   * Security: JwtAuthGuard extracts request.user; RolesGuard enforces ADMIN role.
   * Without JwtAuthGuard, request.user would be undefined → 500 on userId extraction.
   * The guard pair is mandatory — both must be present.
   */
  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(@Body() body: unknown, @Req() req: Request) {
    const dto = UpdateSystemConfigSchema.parse(body);
    const userId = (req as Request & { user: { id: string } }).user.id;
    const updated = await this.systemConfigService.update(dto, userId);
    return {
      name: updated.hotelName,
      address: updated.address ?? '',
      tagline: updated.tagline ?? '',
      description: updated.description ?? '',
      phone: updated.phone ?? '',
      tags: updated.tags ?? [],
      displayPricesWithIva: updated.displayPricesWithIva,
    };
  }
}
