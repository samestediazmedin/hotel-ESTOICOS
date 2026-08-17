import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { FolioService } from './folio.service';
import { FolioPdfService } from './folio-pdf.service';
import { PostChargeSchema } from './dto/post-charge.dto';

/**
 * FolioController — folio read + charge management.
 *
 * RBAC: ADMIN, MANAGER, RECEPTION only. HOUSEKEEPING has no folio access (3.9 table).
 *
 * Endpoints:
 *  GET  /api/folios/:id              — itemized folio + running balance (FOL-04)
 *  POST /api/folios/:id/charges      — post a manual charge (CHG-01/CHG-02)
 *  POST /api/folios/:id/items/:itemId/void — void an existing charge (FOL-02)
 */
@Controller('folios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER', 'RECEPTION')
export class FolioController {
  constructor(
    private readonly folioService: FolioService,
    private readonly folioPdfService: FolioPdfService,
  ) {}

  // ─── GET /api/folios/:id ──────────────────────────────────────────────────

  @Get(':id')
  async getFolio(@Param('id') id: string) {
    return this.folioService.getFolioWithBalance(id);
  }

  // ─── GET /api/folios/:id/pdf ──────────────────────────────────────────────

  /**
   * downloadFolioPdf — streams an on-demand "Estado de Cuenta" PDF for a SETTLED folio.
   *
   * Returns application/pdf with Content-Disposition: attachment.
   * Throws 400 BadRequestException if the folio is not SETTLED (snapshotHash null).
   *
   * RBAC: ADMIN, MANAGER, RECEPTION (inherited from controller-level @Roles)
   * No R2 storage — generated fresh per request (04-RESEARCH 3.6 decision).
   */
  @Get(':id/pdf')
  async downloadFolioPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.folioPdfService.generateFolioPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="estado-de-cuenta-${id.slice(0, 8)}.pdf"`,
    );
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
  }

  // ─── POST /api/folios/:id/charges ─────────────────────────────────────────

  @Post(':id/charges')
  async postCharge(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: { id: string },
  ) {
    const result = PostChargeSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.issues);
    }
    return this.folioService.postCharge(id, result.data, user.id);
  }

  // ─── POST /api/folios/:id/items/:itemId/void ──────────────────────────────

  @Post(':id/items/:itemId/void')
  async voidCharge(
    @Param('id') folioId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.folioService.voidCharge(folioId, itemId, user.id);
  }
}
