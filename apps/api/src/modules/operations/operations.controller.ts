import {
  Controller,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { OperationsService } from './operations.service';

/**
 * OperationsController — check-in / check-out endpoints.
 *
 * RBAC: ADMIN, MANAGER, RECEPTION only. HOUSEKEEPING has no operations access.
 *
 * Endpoints:
 *  POST /api/operations/reservations/:id/check-in
 *  POST /api/operations/reservations/:id/check-out
 */
@Controller('operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER', 'RECEPTION')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Post('reservations/:id/check-in')
  async checkIn(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.operationsService.checkIn(id, user.id);
  }

  @Post('reservations/:id/check-out')
  async checkOut(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.operationsService.checkOut(id, user.id);
  }
}
