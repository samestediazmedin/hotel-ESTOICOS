import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../../system-config/system-config.module';
import { GuestsModule } from '../guests/guests.module';
import { FolioController } from './folio.controller';
import { FolioService } from './folio.service';
import { FolioRepository } from './folio.repository';
import { FolioPdfService } from './folio-pdf.service';

/**
 * FolioModule — append-only folio lifecycle + PDF generation.
 *
 * PrismaModule is @Global — no import needed.
 * SharedModule (JwtAuthGuard, RolesGuard) is @Global — no import needed.
 *
 * Imports:
 *  - SystemConfigModule: getIvaRate(), getHotelBusinessDate()
 *  - GuestsModule: GuestEncryptionService.decrypt() for PDF documentNumber decryption
 *
 * Exports FolioService so OperationsModule can call openFolio() and closeFolio()
 * inside the check-in / check-out $transaction.
 */
@Module({
  imports: [SystemConfigModule, GuestsModule],
  controllers: [FolioController],
  providers: [FolioService, FolioRepository, FolioPdfService],
  exports: [FolioService],
})
export class FolioModule {}
