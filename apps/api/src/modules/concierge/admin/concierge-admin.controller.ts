/**
 * concierge-admin.controller.ts — Admin REST endpoints for Bogotá venue catalog management.
 *
 * All endpoints are ADMIN-only (@Roles('ADMIN') at class level).
 * Non-ADMIN authenticated users receive HTTP 403 Forbidden.
 *
 * Routes:
 *   GET    /api/admin/concierge/venues              — list (includeInactive=true includes disabled)
 *   POST   /api/admin/concierge/venues              — create venue
 *   PATCH  /api/admin/concierge/venues/:id          — partial update
 *   DELETE /api/admin/concierge/venues/:id          — soft-delete (isActive=false)
 *   POST   /api/admin/concierge/venues/import       — CSV bulk import (multipart/form-data)
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { ConciergeAdminService } from './concierge-admin.service';
import { CsvImportService } from './csv-import.service';

@Controller('admin/concierge/venues')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ConciergeAdminController {
  constructor(
    private readonly svc: ConciergeAdminService,
    private readonly csv: CsvImportService,
  ) {}

  /**
   * GET /api/admin/concierge/venues
   * List all venues (ADMIN only). Pass ?includeInactive=true to see disabled venues.
   */
  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.svc.listVenues({ includeInactive: includeInactive === 'true' });
  }

  /**
   * POST /api/admin/concierge/venues
   * Create a new venue. Body validated with CreateVenueSchema (Zod).
   */
  @Post()
  create(@Body() body: unknown) {
    return this.svc.createVenue(body);
  }

  /**
   * PATCH /api/admin/concierge/venues/:id
   * Partial update of a venue. Body validated with UpdateVenueSchema (Zod).
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.svc.updateVenue(id, body);
  }

  /**
   * DELETE /api/admin/concierge/venues/:id
   * Soft-delete: sets isActive=false. Does NOT remove the DB row.
   */
  @Delete(':id')
  @HttpCode(200)
  disable(@Param('id') id: string) {
    return this.svc.disableVenue(id);
  }

  /**
   * POST /api/admin/concierge/venues/import
   * Bulk CSV import. Multipart field: `file` (text/csv or application/octet-stream).
   * Returns { inserted, skipped, errors } — invalid rows are reported, not rejected.
   */
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@UploadedFile() file: Express.Multer.File) {
    return this.csv.importCsv(file.buffer.toString('utf8'));
  }
}
