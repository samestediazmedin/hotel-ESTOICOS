import { Module } from '@nestjs/common';
import { HotelPhotosController } from './hotel-photos.controller';
import { HotelPhotosService } from './hotel-photos.service';

/**
 * HotelPhotosModule — admin CRUD for the hotel hero gallery (Phase 13 — HSP-05).
 *
 * 2026-05-28 — Storage migrated from R2 to filesystem-first. StorageService
 * is provided by the @Global StorageModule, so no extra import is needed.
 */
@Module({
  controllers: [HotelPhotosController],
  providers: [HotelPhotosService],
  exports: [HotelPhotosService],
})
export class HotelPhotosModule {}
