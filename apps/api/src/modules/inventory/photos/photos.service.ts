import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryRepository } from '../inventory.repository';
import { StorageService } from '../../storage/storage.service';

/**
 * PhotosService — room photo uploads (2026-05-28 — filesystem-first refactor).
 *
 * Previous architecture (R2 presigned PUT URLs) replaced by a single
 * multipart POST that streams through StorageService. The DB column
 * `RoomPhoto.key` now stores the storage filename
 * (e.g. `room_1735393856123_a1b2c3d4.jpg`), and the public URL is derived
 * at read time as `/images/${key}` (served by express.static in main.ts).
 */
@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryRepository: InventoryRepository,
    private readonly storage: StorageService,
  ) {}

  /**
   * uploadPhoto — single-shot multipart pipeline:
   *  1. Validate room exists.
   *  2. Save image via StorageService (Sharp pipeline).
   *  3. Create RoomPhoto row with the resulting filename in `key`.
   *
   * Returns the persisted row's id + URL + order so the frontend can append
   * to its local list without refetching.
   */
  async uploadPhoto(
    roomId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    uploaderId?: string,
  ): Promise<{ id: string; url: string; order: number }> {
    const room = await this.inventoryRepository.findRoomById(roomId);
    if (!room) {
      throw new NotFoundException(`Room ${roomId} not found`);
    }

    let saved;
    try {
      saved = await this.storage.saveImage({
        buffer: file.buffer,
        originalFilename: file.originalname,
        contentType: file.mimetype,
        prefix: 'room',
        uploadedBy: uploaderId ?? null,
        context: { type: 'room-photo', roomId },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      throw new BadRequestException(msg);
    }

    // Append at the end of the existing photo list
    const order = await this.prisma.roomPhoto.count({ where: { roomId } });

    const photo = await this.prisma.roomPhoto.create({
      data: {
        roomId,
        key: saved.filename,
        contentType: 'image/jpeg', // Sharp pipeline normalises everything to JPEG
        size: saved.processedBytes,
        order,
      },
    });

    return {
      id: photo.id,
      url: `/images/${photo.key}`,
      order: photo.order,
    };
  }

  /**
   * deletePhoto — remove the disk artefacts (best-effort) then the DB row.
   */
  async deletePhoto(photoId: string): Promise<void> {
    const photo = await this.prisma.roomPhoto.findUnique({ where: { id: photoId } });
    if (!photo) {
      throw new NotFoundException(`Photo ${photoId} not found`);
    }
    await this.storage.deleteImage(photo.key);
    await this.prisma.roomPhoto.delete({ where: { id: photoId } });
  }

  /**
   * getPhotosForRoom — list all photos for a room, ordered by display order.
   * URL is `/images/${key}` (served by express.static).
   */
  async getPhotosForRoom(
    roomId: string,
  ): Promise<Array<{ id: string; url: string; order: number }>> {
    const photos = await this.prisma.roomPhoto.findMany({
      where: { roomId },
      orderBy: { order: 'asc' },
    });

    return photos.map((p) => ({
      id: p.id,
      url: `/images/${p.key}`,
      order: p.order,
    }));
  }
}
