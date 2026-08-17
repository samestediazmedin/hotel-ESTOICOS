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
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { HotelPhotosService } from './hotel-photos.service';
import { ReorderHotelPhotosSchema } from './dto/reorder-hotel-photos.dto';

/**
 * HotelPhotosController — Admin-only CRUD for the hotel hero gallery.
 *
 * Route prefix: /api/admin/hotel-photos
 *
 * 2026-05-28 — Filesystem-first refactor: single multipart POST replaces
 * the previous /presign + POST/confirm pair. The browser sends the file
 * directly to NestJS; StorageService writes it to the Railway Volume.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/hotel-photos')
export class HotelPhotosController {
  constructor(private readonly hotelPhotosService: HotelPhotosService) {}

  /** GET /api/admin/hotel-photos — full ordered list (including legacy seeds). */
  @Get()
  @Roles('ADMIN')
  list() {
    return this.hotelPhotosService.listPhotos();
  }

  /**
   * POST /api/admin/hotel-photos — upload one image.
   * Body: multipart/form-data with `image` (file) and optional `alt`.
   * Response: { id, url, alt, displayOrder }
   */
  @Post()
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { alt?: string },
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('La imagen es obligatoria');
    }
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    return this.hotelPhotosService.uploadPhoto(file, body.alt, userId);
  }

  /**
   * PATCH /api/admin/hotel-photos/reorder
   * Body: { photoIds: string[] }
   */
  @Patch('reorder')
  @Roles('ADMIN')
  async reorder(@Body() body: unknown) {
    const dto = ReorderHotelPhotosSchema.parse(body);
    await this.hotelPhotosService.reorderPhotos(dto.photoIds);
    return { ok: true };
  }

  /** DELETE /api/admin/hotel-photos/:id */
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  async delete(@Param('id') id: string) {
    await this.hotelPhotosService.deletePhoto(id);
  }
}
