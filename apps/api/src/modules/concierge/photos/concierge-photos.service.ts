/**
 * concierge-photos.service.ts — Bogotá venue photo uploads.
 *
 * 2026-05-28 — Filesystem-first refactor:
 *  - R2 client + presigned URLs removed.
 *  - StorageService.saveImage writes the file under storage/images/.
 *  - bogota_venues.photoUrl stores the storage filename
 *    (e.g. `venue_1735393856123_a1b2c3d4.jpg`).
 *  - Legacy rows with photoUrl=<http URL from Foursquare/seed> still resolve
 *    via the read-time mapper (listed in admin controllers).
 *
 * One photo per venue — uploading a new one replaces the previous file on disk.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class ConciergePhotosService {
  private readonly logger = new Logger(ConciergePhotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * uploadPhoto — single-shot multipart pipeline.
   * Replaces any prior photo on the venue (deletes the old file from disk
   * when the previous photoUrl looked like a storage filename).
   */
  async uploadPhoto(
    venueId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    uploaderId?: string,
  ): Promise<{ key: string; url: string }> {
    const venue = await this.prisma.bogotaVenue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException(`Venue ${venueId} not found`);

    let saved;
    try {
      saved = await this.storage.saveImage({
        buffer: file.buffer,
        originalFilename: file.originalname,
        contentType: file.mimetype,
        prefix: 'venue',
        uploadedBy: uploaderId ?? null,
        context: { type: 'venue-photo', venueId },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      throw new BadRequestException(msg);
    }

    // Replace previous file on disk if it was storage-managed
    // (filename pattern: <prefix>_<ts>_<hex>.jpg).
    if (venue.photoUrl && /^[a-zA-Z0-9_.-]+\.jpg$/.test(venue.photoUrl)) {
      await this.storage.deleteImage(venue.photoUrl);
    }

    await this.prisma.bogotaVenue.update({
      where: { id: venueId },
      data: { photoUrl: saved.filename },
    });

    return { key: saved.filename, url: `/images/${saved.filename}` };
  }

  /**
   * deletePhoto — clears the venue's photoUrl + best-effort removes the file.
   */
  async deletePhoto(venueId: string): Promise<void> {
    const venue = await this.prisma.bogotaVenue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException(`Venue ${venueId} not found`);
    if (!venue.photoUrl) return;

    // Only clean from disk if it's a storage-managed filename — legacy
    // external URLs (Foursquare etc.) need only the DB null-out.
    if (/^[a-zA-Z0-9_.-]+\.jpg$/.test(venue.photoUrl)) {
      await this.storage.deleteImage(venue.photoUrl);
    }

    await this.prisma.bogotaVenue.update({
      where: { id: venueId },
      data: { photoUrl: null },
    });
  }
}
