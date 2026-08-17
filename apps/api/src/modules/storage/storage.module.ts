import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * StorageModule — filesystem-first image storage (2026-05-28).
 *
 * Made @Global so every feature module (offers, hotel-photos, room-photos,
 * concierge-photos) can inject StorageService without re-importing.
 *
 * Static serving of `/images/*` is wired in main.ts (not here) because
 * NestJS express middleware mounting happens after app creation.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
