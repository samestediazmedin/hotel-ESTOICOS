import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { ReportingController } from './reporting.controller';
import { DashboardService } from './dashboard.service';
import { ReportService } from './report.service';
import { ReportPdfService } from './pdf/report-pdf.service';

/**
 * ReportingModule — Phase 06 dashboard read endpoints + export endpoints.
 *
 * PrismaModule is @Global — no import needed.
 * SharedModule (JwtAuthGuard, RolesGuard) is @Global — no import needed.
 *
 * Imports:
 *  - SystemConfigModule: getHotelBusinessDate() + getHotelName() for PDF header
 *
 * Providers:
 *  - DashboardService: dashboard KPI read endpoints (Plan 06-01)
 *  - ReportService: date-range aggregation + CSV + PDF generation (Plan 06-03)
 *  - ReportPdfService: @react-pdf/renderer renderToBuffer wrapper (Plan 06-03)
 *
 * Exports DashboardService (used by other modules if needed).
 */
@Module({
  imports: [SystemConfigModule],
  controllers: [ReportingController],
  providers: [DashboardService, ReportService, ReportPdfService],
  exports: [DashboardService],
})
export class ReportingModule {}
