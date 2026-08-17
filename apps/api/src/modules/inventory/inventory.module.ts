import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import { PhotosController } from './photos/photos.controller';
import { PhotosService } from './photos/photos.service';
import { RoomTypePhotosController } from './photos/room-type-photos.controller';
import { RoomTypePhotosService } from './photos/room-type-photos.service';

/**
 * InventoryModule — rooms, room types, and photos bounded context.
 *
 * Two photo controllers live here:
 *  - PhotosController         (per-Room photos, legacy)
 *  - RoomTypePhotosController (per-RoomType photos — the new marketing source,
 *    2026-05-28). The public homepage reads from this one.
 */
@Module({
  controllers: [InventoryController, PhotosController, RoomTypePhotosController],
  providers: [
    InventoryService,
    InventoryRepository,
    PhotosService,
    RoomTypePhotosService,
  ],
  exports: [InventoryService, InventoryRepository],
})
export class InventoryModule {}
