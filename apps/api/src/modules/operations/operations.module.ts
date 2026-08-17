import { Module } from '@nestjs/common';
import { FolioModule } from '../folio/folio.module';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

/**
 * OperationsModule — check-in / check-out bounded context.
 *
 * PrismaModule is @Global — no import needed.
 * SharedModule (JwtAuthGuard, RolesGuard) is @Global — no import needed.
 *
 * Imports FolioModule so OperationsService can call openFolio() and closeFolio()
 * inside the $transaction. FolioModule must be registered BEFORE OperationsModule
 * in AppModule since OperationsModule depends on FolioService (via FolioModule).
 *
 * Imports SystemConfigModule for completeness (in case operations needs config later).
 *
 * Exports OperationsService for potential use by other modules (e.g. housekeeping).
 */
@Module({
  imports: [FolioModule, SystemConfigModule],
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
