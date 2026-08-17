import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemConfigService } from '../../system-config/system-config.service';
import { ReportPdfService } from './pdf/report-pdf.service';
import type { ReportExportDto } from './dto/report-export.dto';
import { PdfReportSchema } from './dto/report-export.dto';
import type { OperationsReportDto } from './dto/operations-report.dto';

/**
 * ReportService — date-range report aggregation + CSV generation + PDF generation.
 *
 * Data source: daily_snapshot rows (NOT raw reservation queries).
 * All COP amounts: Math.round() integers throughout.
 * CSV format: UTF-8 BOM + semicolon delimiter + Spanish headers + DD/MM/YYYY dates.
 * PDF: REPORTE OPERACIONAL via @react-pdf/renderer renderToBuffer (04-03 pattern).
 * Audit log: reportExportLog.create AFTER successful generation (rowCount accurate).
 *
 * RBAC enforced at controller level — this service does not check roles.
 */
@Injectable()
export class ReportService {
  private readonly UTF8_BOM = '﻿';
  private readonly CSV_DELIMITER = ';';
  private readonly CSV_HEADER =
    'Fecha;OcupacionPct;ADR;RevPAR;Llegadas;Salidas;Ingresos';

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
    private readonly pdfService: ReportPdfService,
  ) {}

  // ─── Date helpers ──────────────────────────────────────────────────────────

  /**
   * fmtDate — format a Date to DD/MM/YYYY using UTC accessors.
   *
   * UTC accessors required: daily_snapshot.businessDate is stored as a DATE column
   * (UTC midnight). Local accessors would shift dates by the server's UTC offset.
   * Consistent with TRA export pattern (Phase 04-04).
   */
  private fmtDate(d: Date): string {
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // ─── Query ─────────────────────────────────────────────────────────────────

  /**
   * getSnapshotsForRange — fetches daily_snapshot rows ordered ASC.
   *
   * Used by both CSV and aggregate(). Separated so the controller can pass
   * the row array to buildCsv() and audit the rowCount accurately.
   */
  async getSnapshotsForRange(range: ReportExportDto) {
    const start = new Date(range.startDate + 'T00:00:00.000Z');
    const end = new Date(range.endDate + 'T00:00:00.000Z');
    return this.prisma.dailySnapshot.findMany({
      where: {
        businessDate: { gte: start, lte: end },
      },
      orderBy: { businessDate: 'asc' },
    });
  }

  // ─── Aggregate ─────────────────────────────────────────────────────────────

  /**
   * aggregate — build OperationsReportDto from daily_snapshot rows.
   *
   * Returns rolled-up totals + per-day breakdown.
   * Empty range → daysCount=0, all totals=0.
   */
  async aggregate(range: ReportExportDto): Promise<OperationsReportDto> {
    const rows = await this.getSnapshotsForRange(range);
    const daysCount = rows.length;

    const totalRevenue = Math.round(
      rows.reduce((s, r) => s + Number(r.totalRevenue), 0),
    );
    const totalArrivals = rows.reduce((s, r) => s + r.arrivalsCount, 0);
    const totalDepartures = rows.reduce((s, r) => s + r.departuresCount, 0);
    const avgOccupancyPct =
      daysCount > 0
        ? rows.reduce((s, r) => s + Number(r.occupancyPct), 0) / daysCount
        : 0;
    const avgAdr =
      daysCount > 0
        ? Math.round(rows.reduce((s, r) => s + Number(r.adr), 0) / daysCount)
        : 0;
    const avgRevpar =
      daysCount > 0
        ? Math.round(rows.reduce((s, r) => s + Number(r.revpar), 0) / daysCount)
        : 0;

    return {
      range: { startDate: range.startDate, endDate: range.endDate },
      totals: {
        totalRevenue,
        avgOccupancyPct,
        avgAdr,
        avgRevpar,
        totalArrivals,
        totalDepartures,
        daysCount,
      },
      daily: rows.map((r) => ({
        businessDate: r.businessDate.toISOString().slice(0, 10),
        occupancyPct: Number(r.occupancyPct),
        adr: Math.round(Number(r.adr)),
        revpar: Math.round(Number(r.revpar)),
        arrivalsCount: r.arrivalsCount,
        departuresCount: r.departuresCount,
        totalRevenue: Math.round(Number(r.totalRevenue)),
      })),
    };
  }

  // ─── CSV ───────────────────────────────────────────────────────────────────

  /**
   * buildCsv — build CSV string from snapshot rows.
   *
   * Format (locked per 06-RESEARCH.md § 9):
   *  - UTF-8 BOM prefix (U+FEFF) — Colombian Excel compatibility
   *  - Semicolon delimiter
   *  - Header: Fecha;OcupacionPct;ADR;RevPAR;Llegadas;Salidas;Ingresos
   *  - DD/MM/YYYY dates (UTC accessors)
   *  - OcupacionPct: (occupancyPct×100).toFixed(2) with comma decimal (Colombian convention)
   *  - ADR, RevPAR, Ingresos: Math.round COP integers
   */
  buildCsv(rows: Awaited<ReturnType<typeof this.getSnapshotsForRange>>): string {
    const lines = rows.map((r) =>
      [
        this.fmtDate(r.businessDate),
        (Number(r.occupancyPct) * 100).toFixed(2).replace('.', ','),
        Math.round(Number(r.adr)).toString(),
        Math.round(Number(r.revpar)).toString(),
        r.arrivalsCount.toString(),
        r.departuresCount.toString(),
        Math.round(Number(r.totalRevenue)).toString(),
      ].join(this.CSV_DELIMITER),
    );
    return this.UTF8_BOM + this.CSV_HEADER + '\n' + lines.join('\n');
  }

  /**
   * generateCsv — fetch snapshots + build CSV + write audit log.
   *
   * Audit log inserted AFTER successful generation (rowCount accurate).
   * Returns raw CSV string — controller sets headers and sends.
   */
  async generateCsv(range: ReportExportDto, userId: string): Promise<string> {
    const rows = await this.getSnapshotsForRange(range);
    const csv = this.buildCsv(rows);

    // Insert audit log AFTER successful generation
    await this.prisma.reportExportLog.create({
      data: {
        userId,
        fromDate: new Date(range.startDate + 'T00:00:00.000Z'),
        toDate: new Date(range.endDate + 'T00:00:00.000Z'),
        format: 'csv',
        rowCount: rows.length,
      },
    });

    return csv;
  }

  // ─── PDF ───────────────────────────────────────────────────────────────────

  /**
   * generatePdfBuffer — aggregate snapshots + render PDF + write audit log.
   *
   * Cap: 31 days max. Ranges > 31 days → BadRequestException with Spanish message.
   * (P6 from RESEARCH: OOM risk in Railway containers for large PDF tables).
   * Audit log inserted AFTER successful renderToBuffer.
   */
  async generatePdfBuffer(range: ReportExportDto, userId: string): Promise<Buffer> {
    // Enforce 31-day cap using the same PdfReportSchema refine
    const validation = PdfReportSchema.safeParse(range);
    if (!validation.success) {
      const capError = validation.error.issues.find((i) =>
        i.message.includes('31 días'),
      );
      if (capError) {
        throw new BadRequestException(capError.message);
      }
      throw new BadRequestException(validation.error.issues);
    }

    const report = await this.aggregate(range);
    const hotelName = await this.systemConfig.getHotelName();
    const buffer = await this.pdfService.renderToBuffer({ hotelName, report });

    // Insert audit log AFTER successful PDF generation (rowCount accurate)
    await this.prisma.reportExportLog.create({
      data: {
        userId,
        fromDate: new Date(range.startDate + 'T00:00:00.000Z'),
        toDate: new Date(range.endDate + 'T00:00:00.000Z'),
        format: 'pdf',
        rowCount: report.daily.length,
      },
    });

    return buffer;
  }

  // ─── Filename helpers ──────────────────────────────────────────────────────

  csvFilename(range: ReportExportDto): string {
    return `reporte-operacional-${range.startDate}-to-${range.endDate}.csv`;
  }

  pdfFilename(range: ReportExportDto): string {
    return `reporte-operacional-${range.startDate}-to-${range.endDate}.pdf`;
  }
}
