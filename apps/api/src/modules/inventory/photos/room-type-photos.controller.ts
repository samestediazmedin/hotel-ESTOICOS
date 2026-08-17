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
import { RoomTypePhotosService } from './room-type-photos.service';

/**
 * RoomTypePhotosController — marketing photos at the RoomType level.
 *
 * Route prefix: /api/inventory/room-types/:roomTypeId/photos
 *
 * RBAC:
 *  - GET:    all authenticated staff (any role)
 *  - POST:   ADMIN, MANAGER
 *  - PATCH:  ADMIN, MANAGER (reorder)
 *  - DELETE: ADMIN, MANAGER
 *
 * Photos uploaded here drive the public homepage room cards via
 * PublicPortalService.getPublishedRoomTypes (which now joins RoomTypePhoto
 * directly instead of going through the chain RoomType → Room → photos).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory/room-types/:roomTypeId/photos')
export class RoomTypePhotosController {
  constructor(private readonly photos: RoomTypePhotosService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING')
  list(@Param('roomTypeId') roomTypeId: string) {
    return this.photos.listForRoomType(roomTypeId);
  }

  /**
   * POST — multipart/form-data with `image` field.
   * Response: { id, url, order }
   */
  @Post()
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async upload(
    @Param('roomTypeId') roomTypeId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('La imagen es obligatoria');
    }
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    return this.photos.uploadPhoto(roomTypeId, file, userId);
  }

  /**
   * PATCH /reorder — set order = index per photoId.
   * Body: { photoIds: string[] }
   */
  @Patch('reorder')
  @Roles('ADMIN', 'MANAGER')
  async reorder(
    @Param('roomTypeId') roomTypeId: string,
    @Body() body: { photoIds?: unknown },
  ) {
    const ids = body.photoIds;
    if (
      !Array.isArray(ids) ||
      ids.some((v) => typeof v !== 'string') ||
      ids.length === 0
    ) {
      throw new BadRequestException('photoIds must be a non-empty string array');
    }
    await this.photos.reorder(roomTypeId, ids as string[]);
    return { ok: true };
  }

  @Delete(':photoId')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(204)
  delete(
    @Param('roomTypeId') _roomTypeId: string,
    @Param('photoId') photoId: string,
  ) {
    return this.photos.deletePhoto(photoId);
  }
}
