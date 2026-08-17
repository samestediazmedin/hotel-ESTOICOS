import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { InventoryService } from './inventory.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ─── Room Types ──────────────────────────────────────────────────────────

  /** GET /api/inventory/room-types — all staff can read */
  @Get('room-types')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  findAllRoomTypes() {
    return this.inventoryService.findAllRoomTypes();
  }

  /** POST /api/inventory/room-types — ADMIN/MANAGER only */
  @Post('room-types')
  @Roles('ADMIN', 'MANAGER')
  createRoomType(@Body() dto: CreateRoomTypeDto) {
    return this.inventoryService.createRoomType(dto);
  }

  /** GET /api/inventory/room-types/:id */
  @Get('room-types/:id')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  findRoomType(@Param('id') id: string) {
    return this.inventoryService.findRoomTypeById(id);
  }

  /** PATCH /api/inventory/room-types/:id */
  @Patch('room-types/:id')
  @Roles('ADMIN', 'MANAGER')
  updateRoomType(@Param('id') id: string, @Body() dto: UpdateRoomTypeDto) {
    return this.inventoryService.updateRoomType(id, dto);
  }

  /** POST /api/inventory/room-types/:id/deactivate */
  @Post('room-types/:id/deactivate')
  @Roles('ADMIN', 'MANAGER')
  deactivateRoomType(@Param('id') id: string) {
    return this.inventoryService.deactivateRoomType(id);
  }

  /** POST /api/inventory/room-types/:id/activate */
  @Post('room-types/:id/activate')
  @Roles('ADMIN', 'MANAGER')
  activateRoomType(@Param('id') id: string) {
    return this.inventoryService.activateRoomType(id);
  }

  // ─── Rooms ───────────────────────────────────────────────────────────────

  /**
   * GET /api/inventory/rooms/available
   * Must be declared BEFORE /:id to avoid routing conflict.
   * Phase 3 (Reservations) calls this endpoint.
   */
  @Get('rooms/available')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  findAvailableRooms(@Query('roomTypeId') roomTypeId?: string) {
    return this.inventoryService.findAvailableRooms(roomTypeId);
  }

  /** GET /api/inventory/rooms — all staff */
  @Get('rooms')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING')
  findAllRooms() {
    return this.inventoryService.findAllRooms();
  }

  /** POST /api/inventory/rooms */
  @Post('rooms')
  @Roles('ADMIN', 'MANAGER')
  createRoom(@Body() dto: CreateRoomDto) {
    return this.inventoryService.createRoom(dto);
  }

  /** GET /api/inventory/rooms/:id */
  @Get('rooms/:id')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING')
  findRoom(@Param('id') id: string) {
    return this.inventoryService.findRoomById(id);
  }

  /** PATCH /api/inventory/rooms/:id */
  @Patch('rooms/:id')
  @Roles('ADMIN', 'MANAGER')
  updateRoom(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.inventoryService.updateRoom(id, dto);
  }

  /**
   * PATCH /api/inventory/rooms/:id/status
   * Updates physicalStatus and/or cleaningStatus independently.
   * RECEPTION can update status (e.g., mark room clean after inspection).
   */
  @Patch('rooms/:id/status')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  updateRoomStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRoomStatusDto,
  ) {
    return this.inventoryService.updateRoomStatus(id, dto);
  }

  /** POST /api/inventory/rooms/:id/deactivate */
  @Post('rooms/:id/deactivate')
  @Roles('ADMIN', 'MANAGER')
  deactivateRoom(@Param('id') id: string) {
    return this.inventoryService.deactivateRoom(id);
  }

  /** POST /api/inventory/rooms/:id/activate */
  @Post('rooms/:id/activate')
  @Roles('ADMIN', 'MANAGER')
  activateRoom(@Param('id') id: string) {
    return this.inventoryService.activateRoom(id);
  }
}
