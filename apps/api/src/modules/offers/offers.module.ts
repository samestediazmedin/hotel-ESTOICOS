import { Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersAdminController } from './offers-admin.controller';
import { OffersPublicController } from './offers-public.controller';

/**
 * OffersModule — admin CRUD + public read for homepage offers.
 *
 * 2026-05-28 — Storage switched from S3/R2 presigned uploads to a
 * filesystem-first pipeline. The StorageService is provided by the @Global
 * StorageModule registered in app.module.ts, so no import is needed here.
 */
@Module({
  controllers: [OffersAdminController, OffersPublicController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
