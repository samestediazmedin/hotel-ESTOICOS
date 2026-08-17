import {
  BadRequestException,
  Controller,
  Delete,
  Get,
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
import { PhotosService } from './photos.service';

/**
 * PhotosController — room photo uploads.
 *
 * Route prefix: /api/inventory/rooms/:roomId/photos
 *
 * 2026-05-28 — Filesystem-first refactor: single multipart POST replaces
 * the previous /presign + /confirm pair. The browser sends the file
 * directly to NestJS; StorageService writes it to the Railway Volume.
 *
 * RBAC:
 *  - GET    : ADMIN, MANAGER, RECEPTION, HOUSEKEEPING
 *  - POST   : ADMIN, MANAGER, RECEPTION
 *  - DELETE : ADMIN, MANAGER
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory/rooms/:roomId/photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING')
  getPhotos(@Param('roomId') roomId: string) {
    return this.photosService.getPhotosForRoom(roomId);
  }

  /**
   * POST /api/inventory/rooms/:roomId/photos
   * Body: multipart/form-data with `image` field (file).
   * Response: { id, url, order }
   */
  @Post()
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async upload(
    @Param('roomId') roomId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('La imagen es obligatoria');
    }
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    return this.photosService.uploadPhoto(roomId, file, userId);
  }

  @Delete(':photoId')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(204)
  delete(@Param('roomId') _roomId: string, @Param('photoId') photoId: string) {
    return this.photosService.deletePhoto(photoId);
  }
}
