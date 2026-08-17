import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

/**
 * RoomTypePhotosService — marketing photos at the RoomType level (2026-05-28).
 *
 * Replaces the old per-Room photo flow. The public homepage shows room
 * TYPES (Doble Deluxe, Suite Sumapaz...), so the photos that represent the
 * product should live at that level — independent of which physical room
 * (101, 102, etc.) the guest is eventually assigned at check-in.
 *
 * Storage is the same filesystem-first pipeline used by every other image
 * module: StorageService.saveImage writes the file under storage/images/
 * and the DB column `key` holds the filename. Public URL = /images/<key>.
 */
@Injectable()
export class RoomTypePhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * uploadPhoto — multipart pipeline. Appends at the end of the existing
   * gallery for this room type.
   */
  async uploadPhoto(
    roomTypeId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    uploaderId?: string,
  ): Promise<{ id: string; url: string; order: number }> {
    const type = await this.prisma.roomType.findUnique({
      where: { id: roomTypeId },
    });
    if (!type) {
      throw new NotFoundException(`RoomType ${roomTypeId} not found`);
    }

    let saved;
    try {
      saved = await this.storage.saveImage({
        buffer: file.buffer,
        originalFilename: file.originalname,
        contentType: file.mimetype,
        prefix: 'roomtype',
        uploadedBy: uploaderId ?? null,
        context: { type: 'room-type-photo', roomTypeId },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      throw new BadRequestException(msg);
    }

    const order = await this.prisma.roomTypePhoto.count({
      where: { roomTypeId },
    });

    const photo = await this.prisma.roomTypePhoto.create({
      data: {
        roomTypeId,
        key: saved.filename,
        order,
        contentType: 'image/jpeg',
        size: saved.processedBytes,
      },
    });

    return {
      id: photo.id,
      url: `/images/${photo.key}`,
      order: photo.order,
    };
  }

  async deletePhoto(photoId: string): Promise<void> {
    const photo = await this.prisma.roomTypePhoto.findUnique({
      where: { id: photoId },
    });
    if (!photo) {
      throw new NotFoundException(`Photo ${photoId} not found`);
    }
    await this.storage.deleteImage(photo.key);
    await this.prisma.roomTypePhoto.delete({ where: { id: photoId } });
  }

  /** Ordered list of photos for a room type. URL is derived from /images/<key>. */
  async listForRoomType(
    roomTypeId: string,
  ): Promise<Array<{ id: string; url: string; order: number }>> {
    const photos = await this.prisma.roomTypePhoto.findMany({
      where: { roomTypeId },
      orderBy: { order: 'asc' },
    });
    return photos.map((p) => ({
      id: p.id,
      url: `/images/${p.key}`,
      order: p.order,
    }));
  }

  /**
   * reorder — set order = index for each photoId in the supplied array.
   * All photos must belong to the same room type (verified for safety).
   */
  async reorder(roomTypeId: string, photoIds: string[]): Promise<void> {
    const photos = await this.prisma.roomTypePhoto.findMany({
      where: { id: { in: photoIds } },
      select: { id: true, roomTypeId: true },
    });
    if (photos.length !== photoIds.length) {
      throw new BadRequestException('Some photo ids do not exist');
    }
    for (const p of photos) {
      if (p.roomTypeId !== roomTypeId) {
        throw new BadRequestException(
          `Photo ${p.id} does not belong to room type ${roomTypeId}`,
        );
      }
    }
    await this.prisma.$transaction(
      photoIds.map((id, index) =>
        this.prisma.roomTypePhoto.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
  }
}
