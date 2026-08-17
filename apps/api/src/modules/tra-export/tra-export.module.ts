import { Module } from '@nestjs/common';
import { GuestsModule } from '../guests/guests.module';
import { TRAExportController } from './tra-export.controller';
import { TRAExportService } from './tra-export.service';
import { TRAAuditLogRepository } from './tra-audit-log.repository';

/**
 * TRAExportModule — TRA Colombia compliance export bounded context.
 *
 * PrismaModule is @Global — no import needed.
 * SharedModule (JwtAuthGuard, RolesGuard, Reflector) is @Global — no import needed.
 *
 * Imports:
 *  - GuestsModule: re-exports GuestEncryptionService (confirmed 04-03 fix)
 *    for decrypting guest.documentNumber before including in the CSV.
 *
 * RBAC: GET /api/tra-export is protected by @Roles('ADMIN', 'MANAGER').
 * RECEPTION and HOUSEKEEPING receive HTTP 403.
 */
@Module({
  imports: [GuestsModule],
  controllers: [TRAExportController],
  providers: [TRAExportService, TRAAuditLogRepository],
})
export class TRAExportModule {}
