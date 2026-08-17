import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { OffersService } from './offers.service';
import { CreateOfferSchema } from './dto/create-offer.dto';
import { UpdateOfferSchema } from './dto/update-offer.dto';
import { ReorderOffersSchema } from './dto/reorder-offers.dto';

/**
 * OffersAdminController — ADMIN-only CRUD for homepage offers.
 *
 * Route prefix: /api/admin/offers
 *
 * 2026-05-28 — Filesystem-first storage:
 *  - POST /          accepts multipart/form-data: `image` (file) + text fields
 *  - PATCH /:id      same multipart shape; `image` optional (omit to keep current)
 *  - DELETE /:id     also removes the file from disk
 *  - Reorder + Get   plain JSON
 *
 * The previous /presign endpoint was removed — uploads go through this
 * controller directly (multer.memoryStorage → Sharp pipeline in
 * StorageService → write to Railway Volume).
 *
 * MaxFileSize is enforced by StorageService (5 MB). multer's `limits` provides
 * an additional 5 MB ceiling so the request body never grows beyond that
 * before Sharp ever sees it.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/offers')
export class OffersAdminController {
  constructor(private readonly offersService: OffersService) {}

  /** GET /api/admin/offers — full list including inactive + out-of-range. */
  @Get()
  @Roles('ADMIN')
  list() {
    return this.offersService.listForAdmin();
  }

  /** GET /api/admin/offers/:id — single offer detail. */
  @Get(':id')
  @Roles('ADMIN')
  get(@Param('id') id: string) {
    return this.offersService.getOffer(id);
  }

  /**
   * POST /api/admin/offers — create with image upload.
   * Body (multipart/form-data):
   *  - image      File (required)
   *  - title      string (required)
   *  - description, badge, ctaText, ctaLink — optional strings
   *  - validFrom, validTo — optional YYYY-MM-DD strings
   *  - isActive   "true"|"false" (multipart serialises booleans as strings)
   */
  @Post()
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    if (!file) {
      throw new BadRequestException('La imagen es obligatoria');
    }
    const imageKey = await this.offersService.persistUpload(file);
    const dto = CreateOfferSchema.parse({
      ...body,
      imageKey,
    });
    return this.offersService.createOffer(dto);
  }

  /**
   * PATCH /api/admin/offers/:id — partial update.
   * `image` is optional. When present, replaces the current image on disk
   * (the previous file is best-effort deleted by the service).
   */
  @Patch(':id')
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const payload: Record<string, unknown> = { ...body };
    if (file) {
      payload.imageKey = await this.offersService.persistUpload(file);
    }
    const dto = UpdateOfferSchema.parse(payload);
    return this.offersService.updateOffer(id, dto);
  }

  /**
   * PATCH /api/admin/offers/reorder/all — set displayOrder = index per offerId.
   */
  @Patch('reorder/all')
  @Roles('ADMIN')
  async reorder(@Body() body: unknown) {
    const dto = ReorderOffersSchema.parse(body);
    await this.offersService.reorderOffers(dto.offerIds);
    return { ok: true };
  }

  /** DELETE /api/admin/offers/:id — disk cleanup + DB row removal. */
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  async delete(@Param('id') id: string) {
    await this.offersService.deleteOffer(id);
  }
}
