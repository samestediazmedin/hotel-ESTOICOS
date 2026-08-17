import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';

/** Fields returned for room type queries — never expose internal Prisma metadata */
const ROOM_TYPE_SELECT = {
  id: true,
  name: true,
  description: true,
  basePrice: true,
  maxOccupancy: true,
  amenities: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Fields returned for room queries — includes nested room type summary */
const ROOM_SELECT = {
  id: true,
  number: true,
  floor: true,
  roomTypeId: true,
  roomType: {
    select: { id: true, name: true, basePrice: true },
  },
  physicalStatus: true,
  cleaningStatus: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Room Types ──────────────────────────────────────────────────────────

  findAllRoomTypes() {
    return this.prisma.roomType.findMany({
      select: ROOM_TYPE_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  findRoomTypeById(id: string) {
    return this.prisma.roomType.findUnique({
      where: { id },
      select: ROOM_TYPE_SELECT,
    });
  }

  createRoomType(data: CreateRoomTypeDto) {
    return this.prisma.roomType.create({
      data: {
        name: data.name,
        description: data.description,
        basePrice: data.basePrice,
        maxOccupancy: data.maxOccupancy,
        amenities: data.amenities,
      },
      select: ROOM_TYPE_SELECT,
    });
  }

  updateRoomType(id: string, data: UpdateRoomTypeDto) {
    return this.prisma.roomType.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
        ...(data.maxOccupancy !== undefined && { maxOccupancy: data.maxOccupancy }),
        ...(data.amenities !== undefined && { amenities: data.amenities }),
      },
      select: ROOM_TYPE_SELECT,
    });
  }

  deactivateRoomType(id: string) {
    return this.prisma.roomType.update({
      where: { id },
      data: { isActive: false },
      select: ROOM_TYPE_SELECT,
    });
  }

  activateRoomType(id: string) {
    return this.prisma.roomType.update({
      where: { id },
      data: { isActive: true },
      select: ROOM_TYPE_SELECT,
    });
  }

  // ─── Rooms ───────────────────────────────────────────────────────────────

  findAllRooms() {
    return this.prisma.room.findMany({
      select: ROOM_SELECT,
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });
  }

  findRoomById(id: string) {
    return this.prisma.room.findUnique({
      where: { id },
      select: ROOM_SELECT,
    });
  }

  createRoom(data: CreateRoomDto) {
    return this.prisma.room.create({
      data: {
        number: data.number,
        floor: data.floor,
        roomTypeId: data.roomTypeId,
        notes: data.notes,
      },
      select: ROOM_SELECT,
    });
  }

  updateRoom(id: string, data: UpdateRoomDto) {
    return this.prisma.room.update({
      where: { id },
      data: {
        ...(data.number !== undefined && { number: data.number }),
        ...(data.floor !== undefined && { floor: data.floor }),
        ...(data.roomTypeId !== undefined && { roomTypeId: data.roomTypeId }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      select: ROOM_SELECT,
    });
  }

  updateRoomStatus(id: string, data: UpdateRoomStatusDto) {
    return this.prisma.room.update({
      where: { id },
      data: {
        // CRITICAL: Only update the field(s) present in the payload.
        // NEVER couple physicalStatus and cleaningStatus in the same operation
        // unless the caller explicitly provides both.
        ...(data.physicalStatus !== undefined && {
          physicalStatus: data.physicalStatus,
        }),
        ...(data.cleaningStatus !== undefined && {
          cleaningStatus: data.cleaningStatus,
        }),
      },
      select: ROOM_SELECT,
    });
  }

  deactivateRoom(id: string) {
    return this.prisma.room.update({
      where: { id },
      data: { isActive: false },
      select: ROOM_SELECT,
    });
  }

  activateRoom(id: string) {
    return this.prisma.room.update({
      where: { id },
      data: { isActive: true },
      select: ROOM_SELECT,
    });
  }

  /**
   * findAvailableRooms — SINGLE GUARD for availability filtering.
   *
   * Excludes OUT_OF_SERVICE and ON_HOLD rooms regardless of cleaningStatus.
   * Phase 3 (Reservations) must call InventoryService.findAvailableRooms()
   * which delegates here. Do NOT replicate this filter elsewhere.
   *
   * @param roomTypeId — optional filter by room type
   */
  findAvailableRooms(roomTypeId?: string) {
    return this.prisma.room.findMany({
      where: {
        isActive: true,
        physicalStatus: { notIn: ['OUT_OF_SERVICE', 'ON_HOLD'] },
        ...(roomTypeId ? { roomTypeId } : {}),
      },
      include: {
        roomType: true,
        photos: { orderBy: { order: 'asc' } },
      },
    });
  }
}
