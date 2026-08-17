import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InventoryRepository } from './inventory.repository';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { UpdateRoomTypeDto } from './dto/update-room-type.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { transitionPhysicalStatus, DomainException } from './domain/room.entity';

@Injectable()
export class InventoryService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  // ─── Room Types ──────────────────────────────────────────────────────────

  findAllRoomTypes() {
    return this.inventoryRepository.findAllRoomTypes();
  }

  async findRoomTypeById(id: string) {
    const roomType = await this.inventoryRepository.findRoomTypeById(id);
    if (!roomType) {
      throw new NotFoundException(`Room type ${id} not found`);
    }
    return roomType;
  }

  createRoomType(dto: CreateRoomTypeDto) {
    return this.inventoryRepository.createRoomType(dto);
  }

  async updateRoomType(id: string, dto: UpdateRoomTypeDto) {
    await this.findRoomTypeById(id); // throws 404 if not found
    return this.inventoryRepository.updateRoomType(id, dto);
  }

  async deactivateRoomType(id: string) {
    await this.findRoomTypeById(id); // throws 404 if not found
    // v1 soft guard: deactivating a room type with active rooms is allowed but
    // the room type will no longer appear in availability searches.
    return this.inventoryRepository.deactivateRoomType(id);
  }

  async activateRoomType(id: string) {
    await this.findRoomTypeById(id);
    return this.inventoryRepository.activateRoomType(id);
  }

  // ─── Rooms ───────────────────────────────────────────────────────────────

  findAllRooms() {
    return this.inventoryRepository.findAllRooms();
  }

  async findRoomById(id: string) {
    const room = await this.inventoryRepository.findRoomById(id);
    if (!room) {
      throw new NotFoundException(`Room ${id} not found`);
    }
    return room;
  }

  createRoom(dto: CreateRoomDto) {
    return this.inventoryRepository.createRoom(dto);
  }

  async updateRoom(id: string, dto: UpdateRoomDto) {
    await this.findRoomById(id); // throws 404 if not found
    return this.inventoryRepository.updateRoom(id, dto);
  }

  /**
   * updateRoomStatus — updates physicalStatus and/or cleaningStatus independently.
   *
   * If physicalStatus is provided, the domain state machine is enforced via
   * transitionPhysicalStatus(). An invalid transition throws DomainException
   * which is caught here and converted to 422 Unprocessable Entity.
   *
   * CRITICAL: Only the field(s) present in dto are updated. The other field
   * is NEVER touched — this independence is a core domain invariant.
   */
  async updateRoomStatus(roomId: string, dto: UpdateRoomStatusDto) {
    const room = await this.findRoomById(roomId); // throws 404 if not found

    if (dto.physicalStatus !== undefined) {
      try {
        transitionPhysicalStatus(room.physicalStatus, dto.physicalStatus);
      } catch (err) {
        if (err instanceof DomainException) {
          throw new UnprocessableEntityException(err.message);
        }
        throw err;
      }
    }

    return this.inventoryRepository.updateRoomStatus(roomId, dto);
  }

  async deactivateRoom(id: string) {
    await this.findRoomById(id);
    return this.inventoryRepository.deactivateRoom(id);
  }

  async activateRoom(id: string) {
    await this.findRoomById(id);
    return this.inventoryRepository.activateRoom(id);
  }

  /**
   * findAvailableRooms — delegates to repository's SINGLE GUARD method.
   * Phase 3 (Reservations) must call THIS method, never the repository directly.
   */
  findAvailableRooms(roomTypeId?: string) {
    return this.inventoryRepository.findAvailableRooms(roomTypeId);
  }
}
