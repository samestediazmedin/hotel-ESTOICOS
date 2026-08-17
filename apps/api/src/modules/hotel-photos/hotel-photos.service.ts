import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

/**
 * HotelPhotosService — admin CRUD for the hotel hero gallery (Phase 13).
 *
 * 2026-05-28 — Filesystem-first refactor:
 *  - R2 client + presigned URLs removed.
 *  - StorageService.saveImage writes the file under storage/images/.
 *  - HotelPhoto.key stores the storage filename; URL derived as /images/${key}.
 *  - Legacy seeded rows with key=null but url=<Unsplash URL> still resolve via
 *    the stored url (handled by listPhotos below).
 */
@Injectable()
export class HotelPhotosService {
  private readonly logger = new Logger(HotelPhotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * listPhotos — return all hotel photos ordered by displayOrder ASC.
   * URL is `/images/${key}` for storage-managed rows, or the legacy `url`
   * for seeded Phase-12 rows that predate the R2/storage flow.
   */
  async listPhotos(): Promise<
    Array<{ id: string; url: string; key: string | null; alt: string; displayOrder: number }>
  > {
    const photos = await this.prisma.hotelPhoto.findMany({
      orderBy: { displayOrder: 'asc' },
    });

    return photos.map((p) => ({
      id: p.id,
      url: p.key ? `/images/${p.key}` : p.url,
      key: p.key,
      alt: p.alt,
      displayOrder: p.displayOrder,
    }));
  }

  /**
   * uploadPhoto — single-shot multipart pipeline. Replaces the previous
   * presign + confirm pair.
   */
  async uploadPhoto(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    alt: string | undefined,
    uploaderId: string | undefined,
  ): Promise<{ id: string; url: string; alt: string; displayOrder: number }> {
    let saved;
    try {
      saved = await this.storage.saveImage({
        buffer: file.buffer,
        originalFilename: file.originalname,
        contentType: file.mimetype,
        prefix: 'hotel',
        uploadedBy: uploaderId ?? null,
        context: { type: 'hotel-photo' },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      throw new BadRequestException(msg);
    }

    // Append at the end of the existing gallery
    const maxRow = await this.prisma.hotelPhoto.aggregate({
      _max: { displayOrder: true },
    });
    const nextOrder = (maxRow._max.displayOrder ?? -1) + 1;

    const photo = await this.prisma.hotelPhoto.create({
      data: {
        url: '', // URL is derived at read time from key — kept '' for legacy compat
        key: saved.filename,
        alt: alt ?? '',
        displayOrder: nextOrder,
      },
    });

    return {
      id: photo.id,
      url: `/images/${photo.key}`,
      alt: photo.alt,
      displayOrder: photo.displayOrder,
    };
  }

  /**
   * reorderPhotos — set displayOrder = index for each photoId.
   * Uses a $transaction so reorder is atomic.
   */
  async reorderPhotos(photoIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      photoIds.map((id, index) =>
        this.prisma.hotelPhoto.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );
  }

  /**
   * deletePhoto — disk cleanup (only if the row was storage-managed) + DB delete.
   * Legacy rows with key=null only get their DB row removed (no orphan to clean).
   */
  async deletePhoto(id: string): Promise<void> {
    const photo = await this.prisma.hotelPhoto.findUnique({ where: { id } });
    if (!photo) {
      throw new NotFoundException(`HotelPhoto ${id} not found`);
    }
    if (photo.key) {
      await this.storage.deleteImage(photo.key);
    }
    await this.prisma.hotelPhoto.delete({ where: { id } });
  }
}
