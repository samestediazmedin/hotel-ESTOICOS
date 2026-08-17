import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GuestContactRepository } from './guest-contact.repository';
import { GuestContactGateway } from './guest-contact.gateway';
import { CreateContactEventDto } from './dto/create-contact-event.dto';
import { ContactEventResponseDto } from './dto/contact-event-response.dto';

/**
 * GuestContactService — business logic for creating and listing contact events.
 *
 * DI chain: Service injects Gateway (one-way). Gateway NEVER injects Service.
 * This mirrors the HousekeepingService → HousekeepingGateway pattern (P5).
 */
@Injectable()
export class GuestContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: GuestContactRepository,
    private readonly gateway: GuestContactGateway,
  ) {}

  /**
   * createEvent — persist a new contact event and broadcast via Socket.io.
   *
   * 1. Verify guest exists (throws 404 if not found)
   * 2. Insert event row with staffUser join
   * 3. Emit 'contact-event.created' to room `guest:{guestId}` (fire-and-forget)
   * 4. Return the persisted event as ContactEventResponseDto
   */
  async createEvent(
    guestId: string,
    dto: CreateContactEventDto,
    staffUserId: string,
  ): Promise<ContactEventResponseDto> {
    // Verify guest exists
    const guest = await this.prisma.guest.findUnique({ where: { id: guestId } });
    if (!guest) {
      throw new NotFoundException(`Guest ${guestId} not found`);
    }

    const event = await this.repository.create({
      guestId,
      staffUserId,
      method: dto.method as any,
      notes: dto.notes ?? null,
    });

    // Emit to all subscribers of this guest's room (fire-and-forget)
    this.gateway.emitContactEvent(guestId, {
      eventId: event.id,
      guestId,
      method: event.method as 'CALL' | 'WHATSAPP' | 'EMAIL',
      staffUserId: event.staffUserId,
      staffUserName: event.staffUser.name,
      createdAt: event.createdAt.toISOString(),
    });

    return this.toResponseDto(event);
  }

  /**
   * listEvents — retrieve recent contact events for a guest.
   *
   * - limit is clamped to 1..50 (anti-abuse)
   * - Results ordered by createdAt DESC (most recent first)
   */
  async listEvents(guestId: string, limit = 5): Promise<ContactEventResponseDto[]> {
    const clampedLimit = Math.min(Math.max(1, limit), 50);
    const events = await this.repository.findManyByGuestId(guestId, clampedLimit);
    return events.map((e) => this.toResponseDto(e));
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private toResponseDto(event: {
    id: string;
    guestId: string;
    staffUserId: string;
    method: string;
    notes: string | null;
    createdAt: Date;
    staffUser: { id: string; name: string | null; email: string };
  }): ContactEventResponseDto {
    return {
      id: event.id,
      guestId: event.guestId,
      staffUserId: event.staffUserId,
      method: event.method as 'CALL' | 'WHATSAPP' | 'EMAIL',
      notes: event.notes,
      createdAt: event.createdAt.toISOString(),
      staffUser: {
        id: event.staffUser.id,
        name: event.staffUser.name,
        email: event.staffUser.email,
      },
    };
  }
}
