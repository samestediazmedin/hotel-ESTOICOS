import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { CreateOfferDto } from './dto/create-offer.dto';
import type { UpdateOfferDto } from './dto/update-offer.dto';
import type { OfferResponseDto } from './dto/offer-response.dto';

/**
 * OffersService — admin CRUD for homepage offers.
 *
 * Storage model (2026-05-28 — filesystem-first):
 *  - Images are saved by StorageService to STORAGE_DIR/images/<filename>.jpg
 *    (Railway Volume at /app/storage in prod, ./storage in dev).
 *  - The DB column `imageKey` stores ONLY the filename. The public URL is
 *    derived at read time as `/images/${imageKey}` and served by the API
 *    container via express.static.
 *  - There is no presigned URL flow — uploads are multipart POSTs handled
 *    by the controller and forwarded to StorageService.
 */
@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Upload helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * persistUpload — save an uploaded file to the storage tree and return its
   * filename. Used by both create and update flows.
   */
  async persistUpload(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<string> {
    try {
      const result = await this.storage.saveImage({
        buffer: file.buffer,
        originalFilename: file.originalname,
        contentType: file.mimetype,
        prefix: 'offer',
        context: { type: 'offer-image' },
      });
      return result.filename;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      throw new BadRequestException(msg);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CRUD
  // ──────────────────────────────────────────────────────────────────────────

  async createOffer(dto: CreateOfferDto): Promise<OfferResponseDto> {
    const validFrom = dto.validFrom
      ? new Date(dto.validFrom + 'T00:00:00.000Z')
      : null;
    const validTo = dto.validTo
      ? new Date(dto.validTo + 'T00:00:00.000Z')
      : null;

    if (validFrom && validTo && validTo < validFrom) {
      throw new BadRequestException(
        'validTo debe ser posterior o igual a validFrom',
      );
    }

    // displayOrder = MAX + 1 (append at end)
    const maxRow = await this.prisma.offer.aggregate({
      _max: { displayOrder: true },
    });
    const nextOrder = (maxRow._max.displayOrder ?? -1) + 1;

    const offer = await this.prisma.offer.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        imageKey: dto.imageKey,
        badge: dto.badge ?? null,
        validFrom,
        validTo,
        ctaText: dto.ctaText ?? null,
        ctaLink: dto.ctaLink ?? null,
        isActive: dto.isActive ?? true,
        displayOrder: nextOrder,
        roomTypeId: dto.roomTypeId ?? null,
      },
      include: { roomType: { select: { id: true, name: true } } },
    });

    return this.toResponseDto(offer);
  }

  async updateOffer(id: string, dto: UpdateOfferDto): Promise<OfferResponseDto> {
    const existing = await this.prisma.offer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Offer ${id} not found`);
    }

    const data: Parameters<typeof this.prisma.offer.update>[0]['data'] = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.imageKey !== undefined) data.imageKey = dto.imageKey;
    if (dto.badge !== undefined) data.badge = dto.badge;
    if (dto.validFrom !== undefined) {
      data.validFrom = dto.validFrom
        ? new Date(dto.validFrom + 'T00:00:00.000Z')
        : null;
    }
    if (dto.validTo !== undefined) {
      data.validTo = dto.validTo
        ? new Date(dto.validTo + 'T00:00:00.000Z')
        : null;
    }
    if (dto.ctaText !== undefined) data.ctaText = dto.ctaText;
    if (dto.ctaLink !== undefined) data.ctaLink = dto.ctaLink;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    // null means "clear to hotel-wide"; undefined means "no change"
    if (dto.roomTypeId !== undefined) data.roomTypeId = dto.roomTypeId ?? null;

    // Cross-field validation after merge
    const mergedFrom =
      data.validFrom !== undefined ? data.validFrom : existing.validFrom;
    const mergedTo =
      data.validTo !== undefined ? data.validTo : existing.validTo;
    if (mergedFrom && mergedTo && mergedTo < mergedFrom) {
      throw new BadRequestException(
        'validTo debe ser posterior o igual a validFrom',
      );
    }

    const updated = await this.prisma.offer.update({
      where: { id },
      data,
      include: { roomType: { select: { id: true, name: true } } },
    });

    // If the imageKey actually changed, delete the previous file from disk.
    if (
      dto.imageKey !== undefined &&
      dto.imageKey !== existing.imageKey &&
      existing.imageKey
    ) {
      await this.storage.deleteImage(existing.imageKey);
    }

    return this.toResponseDto(updated);
  }

  async deleteOffer(id: string): Promise<void> {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) {
      throw new NotFoundException(`Offer ${id} not found`);
    }

    // Best-effort filesystem cleanup — never blocks DB delete.
    // Reservations.sourceOfferId is ON DELETE SET NULL.
    await this.storage.deleteImage(offer.imageKey);
    await this.prisma.offer.delete({ where: { id } });
  }

  async reorderOffers(offerIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      offerIds.map((id, index) =>
        this.prisma.offer.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────────────────────────────────

  /** ADMIN list — returns every offer, ordered by displayOrder ASC. */
  async listForAdmin(): Promise<OfferResponseDto[]> {
    const offers = await this.prisma.offer.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: { roomType: { select: { id: true, name: true } } },
    });
    return offers.map((o) => this.toResponseDto(o));
  }

  /**
   * Public list — only active offers within their date range.
   * Filter:
   *   isActive = true
   *   AND (validFrom IS NULL OR validFrom <= today)
   *   AND (validTo   IS NULL OR validTo   >= today)
   */
  async listForPublic(): Promise<OfferResponseDto[]> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const offers = await this.prisma.offer.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: today } }] },
          { OR: [{ validTo: null }, { validTo: { gte: today } }] },
        ],
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: { roomType: { select: { id: true, name: true } } },
    });
    return offers.map((o) => this.toResponseDto(o));
  }

  async getOffer(id: string): Promise<OfferResponseDto> {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { roomType: { select: { id: true, name: true } } },
    });
    if (!offer) {
      throw new NotFoundException(`Offer ${id} not found`);
    }
    return this.toResponseDto(offer);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Mapping
  // ──────────────────────────────────────────────────────────────────────────

  private toResponseDto(offer: {
    id: string;
    title: string;
    description: string | null;
    imageKey: string;
    badge: string | null;
    validFrom: Date | null;
    validTo: Date | null;
    ctaText: string | null;
    ctaLink: string | null;
    isActive: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
    roomType?: { id: string; name: string } | null;
  }): OfferResponseDto {
    return {
      id: offer.id,
      title: offer.title,
      description: offer.description,
      imageKey: offer.imageKey,
      // Public URL is the server-relative path served by express.static
      // (see main.ts). Frontend prepends API host implicitly via same-origin.
      imageUrl: `/images/${offer.imageKey}`,
      badge: offer.badge,
      validFrom: offer.validFrom
        ? offer.validFrom.toISOString().slice(0, 10)
        : null,
      validTo: offer.validTo ? offer.validTo.toISOString().slice(0, 10) : null,
      ctaText: offer.ctaText,
      ctaLink: offer.ctaLink,
      isActive: offer.isActive,
      displayOrder: offer.displayOrder,
      createdAt: offer.createdAt.toISOString(),
      updatedAt: offer.updatedAt.toISOString(),
      roomType: offer.roomType ?? null,
    };
  }
}
