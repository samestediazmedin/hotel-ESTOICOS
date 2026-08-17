/**
 * concierge-photos.controller.ts — venue photo uploads (admin).
 *
 * 2026-05-28 — Filesystem-first refactor: single multipart POST replaces
 * the previous presign + confirm pair. NestJS receives the file bytes and
 * StorageService writes them to the Railway Volume.
 *
 * Routes:
 *  - POST   /api/admin/concierge/venues/:id/photos   (multipart, field `image`)
 *  - DELETE /api/admin/concierge/venues/:id/photos
 */

import {
  BadRequestException,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Request } from 'express';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { ConciergePhotosService } from './concierge-photos.service';

@Controller('admin/concierge/venues/:id/photos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ConciergePhotosController {
  constructor(private readonly photosService: ConciergePhotosService) {}

  /**
   * POST /api/admin/concierge/venues/:id/photos
   * Body: multipart/form-data with `image` (file).
   * Response: { key, url }
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async upload(
    @Param('id') venueId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('La imagen es obligatoria');
    }
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    return this.photosService.uploadPhoto(venueId, file, userId);
  }

  /** DELETE /api/admin/concierge/venues/:id/photos */
  @Delete()
  @HttpCode(204)
  delete(@Param('id') venueId: string) {
    return this.photosService.deletePhoto(venueId);
  }
}
