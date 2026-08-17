import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { TRAExportService } from './tra-export.service';
import {
  TraExportQueryDto,
  TraExportQuerySchema,
} from './dto/tra-export-query.dto';

/**
 * TRAExportController — Colombia tourism authority CSV export endpoint.
 *
 * RBAC (TRA-03):
 *  - ADMIN and MANAGER: allowed (hotel management role — they submit TRA reports)
 *  - RECEPTION: forbidden (403) — front desk staff do not handle compliance exports
 *  - HOUSEKEEPING: forbidden (403)
 *
 * Endpoint: GET /api/tra-export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns: text/csv; charset=utf-8 with Content-Disposition for browser download.
 *
 * Empty date range: returns valid CSV with header row only (NOT 404).
 */
@Controller('tra-export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TRAExportController {
  constructor(private readonly service: TRAExportService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  async exportCsv(
    @Query() rawQuery: Record<string, string>,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ): Promise<void> {
    // Validate with Zod v4 — use .issues (not .errors)
    const parsed = TraExportQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(', ');
      throw new BadRequestException(msg);
    }

    const q: TraExportQueryDto = parsed.data;
    const from = new Date(q.from + 'T00:00:00.000Z');
    const to = new Date(q.to + 'T23:59:59.999Z');

    const buffer = await this.service.generateCsv(from, to, user.id);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="TRA_${q.from}_${q.to}.csv"`,
    );
    res.end(buffer);
  }
}
