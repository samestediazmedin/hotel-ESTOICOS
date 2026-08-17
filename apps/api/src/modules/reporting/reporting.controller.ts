import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { ReportService } from './report.service';
import { DateRangeSchema } from './dto/date-range.dto';
import { ReportExportSchema } from './dto/report-export.dto';

/**
 * ReportingController — dashboard read endpoints + export endpoints.
 *
 * Dashboard (Plan 06-01):
 *  All endpoints behind JwtAuthGuard with NO role restriction —
 *  any authenticated staff member may read KPI data.
 *
 * Export (Plan 06-03):
 *  GET /api/reports/operations             — ADMIN, MANAGER only
 *  GET /api/reports/operations/export/csv  — ADMIN, MANAGER only
 *  GET /api/reports/operations/export/pdf  — ADMIN, MANAGER only
 *
 * Endpoints:
 *  GET /api/reports/dashboard           — latest snapshot + live counts
 *  GET /api/reports/daily-snapshots     — date-range snapshot rows (ASC)
 *  GET /api/reports/room-status         — live room status counts
 *  GET /api/reports/operations          — aggregated KPI report (ADMIN/MANAGER)
 *  GET /api/reports/operations/export/csv  — CSV download (ADMIN/MANAGER)
 *  GET /api/reports/operations/export/pdf  — PDF download (ADMIN/MANAGER)
 */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly report: ReportService,
  ) {}

  // ─── GET /api/reports/dashboard ─────────────────────────────────────────

  @Get('dashboard')
  getDashboard() {
    return this.dashboard.getDashboard();
  }

  // ─── GET /api/reports/daily-snapshots ───────────────────────────────────

  /**
   * getDailySnapshots — returns snapshot rows for the given date range.
   *
   * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
   * Validation: Zod v4 schema (.issues convention, NOT .errors)
   */
  @Get('daily-snapshots')
  getDailySnapshots(@Query() raw: unknown) {
    const parsed = DateRangeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.dashboard.getDailySnapshots(parsed.data);
  }

  // ─── GET /api/reports/room-status ───────────────────────────────────────

  @Get('room-status')
  getRoomStatus() {
    return this.dashboard.getRoomStatus();
  }

  // ─── GET /api/reports/operations ─────────────────────────────────────────
  // ADMIN + MANAGER only — revenue data is privacy-sensitive

  /**
   * getOperations — returns aggregated OperationsReportDto for a date range.
   *
   * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
   * RBAC: ADMIN, MANAGER only (RECEPTION/HOUSEKEEPING → 403 via RolesGuard)
   */
  @Get('operations')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async getOperations(@Query() raw: unknown) {
    const parsed = ReportExportSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.report.aggregate(parsed.data);
  }

  // ─── GET /api/reports/operations/export/csv ──────────────────────────────

  /**
   * exportCsv — returns CSV file attachment.
   *
   * Format: UTF-8 BOM + semicolon delimiter + Spanish headers + DD/MM/YYYY.
   * No cap on date range for CSV (line-based, low memory).
   * Audit log inserted after successful generation.
   */
  @Get('operations/export/csv')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async exportCsv(
    @Query() raw: unknown,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ): Promise<void> {
    const parsed = ReportExportSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const csv = await this.report.generateCsv(parsed.data, user.id);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.report.csvFilename(parsed.data)}"`,
    );
    res.send(csv);
  }

  // ─── GET /api/reports/operations/export/pdf ──────────────────────────────

  /**
   * exportPdf — returns PDF file attachment via @react-pdf/renderer renderToBuffer.
   *
   * Cap: 31 days max. ReportService.generatePdfBuffer throws 400 if exceeded.
   * Audit log inserted after successful PDF generation.
   */
  @Get('operations/export/pdf')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async exportPdf(
    @Query() raw: unknown,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ): Promise<void> {
    const parsed = ReportExportSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const buffer = await this.report.generatePdfBuffer(parsed.data, user.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.report.pdfFilename(parsed.data)}"`,
    );
    res.send(buffer);
  }
}
