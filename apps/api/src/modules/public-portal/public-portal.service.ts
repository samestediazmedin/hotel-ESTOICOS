import { Injectable } from '@nestjs/common';
import { SystemConfigService } from '../../system-config/system-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { PublicHotelInfoDto } from './dto/public-hotel-info.dto';
import type { PublicRoomTypeDto } from './dto/public-room-type.dto';
import type { PublicHotelPhotoDto } from './dto/public-hotel-photo.dto';

/**
 * v1.2 hardcoded placeholders — real data comes in Phase 14 (reviews aggregate).
 * Address: migrated in Phase 13 — now reads from system_config.address column.
 * RATING_PLACEHOLDER and REVIEW_COUNT_PLACEHOLDER remain until Phase 14 adds reviews aggregate.
 */
const RATING_PLACEHOLDER = 4.84;
const REVIEW_COUNT_PLACEHOLDER = 318;

/**
 * PublicPortalService — orchestrates the 3 public portal data queries (Phase 12 — PDA-01..03).
 *
 * No auth coupling — this service is intentionally auth-free.
 * All methods return plain typed objects (no Prisma model leakage).
 */
@Injectable()
export class PublicPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  /**
   * getHotelInfo — PDA-01
   *
   * Reads the single system_config row and maps to the public hotel-info payload.
   * `address` is read from DB (Phase 13 added the column + backfilled existing row).
   * `rating` and `reviewCount` remain hardcoded until Phase 14 adds the reviews aggregate.
   */
  async getHotelInfo(): Promise<PublicHotelInfoDto> {
    const config = await this.systemConfigService.getConfig();

    return {
      name: config?.hotelName ?? 'Hotel Sumapaz',
      address: config?.address ?? '',
      tagline: config?.tagline ?? '',
      description: config?.description ?? '',
      phone: config?.phone ?? '',
      rating: RATING_PLACEHOLDER,
      reviewCount: REVIEW_COUNT_PLACEHOLDER,
      tags: config?.tags ?? [],
      // 2026-05-29 — ivaRate MUST be Number() — Prisma Decimal serializes as string
      // over HTTP. This is the 4th Decimal-as-string incident on this project.
      // displayPricesWithIva defaults to true (match schema default).
      displayPricesWithIva: config?.displayPricesWithIva ?? true,
      ivaRate: config ? Number(config.ivaRate) : 0.19,
    };
  }

  /**
   * getPublishedRoomTypes — PDA-02
   *
   * Queries RoomType where isPublished=true AND isActive=true, sorted by basePrice ASC.
   *
   * 2026-05-28 — Marketing photos now live at the RoomType level
   * (RoomTypePhoto table), not on individual rooms. The public homepage shows
   * the type's gallery directly, decoupled from physical room assignment.
   * Public URL is /images/<key> served by express.static on the API.
   *
   * Badge: index 0 → "Más económica", index 1 → "Mejor valor", rest → null.
   */
  async getPublishedRoomTypes(): Promise<PublicRoomTypeDto[]> {
    const roomTypes = await this.prisma.roomType.findMany({
      where: { isPublished: true, isActive: true },
      orderBy: { basePrice: 'asc' },
      include: {
        photos: { orderBy: { order: 'asc' }, take: 3 },
      },
    });

    return roomTypes.map((rt, idx) => {
      const photos = rt.photos.map((p) => ({
        url: `/images/${p.key}`,
        alt: rt.name,
      }));

      const badge: PublicRoomTypeDto['badge'] =
        idx === 0 ? 'Más económica'
        : idx === 1 ? 'Mejor valor'
        : null;

      return {
        id: rt.id,
        name: rt.name,
        capacity: rt.maxOccupancy,
        description: rt.description ?? '',
        basePrice: Number(rt.basePrice),
        photos,
        badge,
      };
    });
  }

  /**
   * getHotelPhotos — PDA-03
   *
   * Reads the hotel_photos table ordered by displayOrder ASC.
   * 2026-05-28 — Dual-shape URL resolution:
   *  - New uploads: have `key` set → URL = /images/<key>
   *  - Legacy seeded rows (Phase 12): key is null → URL = stored url (Unsplash)
   */
  async getHotelPhotos(): Promise<PublicHotelPhotoDto[]> {
    const photos = await this.prisma.hotelPhoto.findMany({
      orderBy: { displayOrder: 'asc' },
    });

    return photos.map((p) => ({
      url: p.key ? `/images/${p.key}` : p.url,
      alt: p.alt,
      displayOrder: p.displayOrder,
    }));
  }
}
