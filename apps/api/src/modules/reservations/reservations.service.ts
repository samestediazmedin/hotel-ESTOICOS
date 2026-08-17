import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GuestsRepository } from '../guests/guests.repository';
import { InventoryRepository } from '../inventory/inventory.repository';
import { ReservationsRepository, ReservationFilter } from './reservations.repository';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationsRepository: ReservationsRepository,
    private readonly guestsRepository: GuestsRepository,
    private readonly inventoryRepository: InventoryRepository,
  ) {}

  // ─── Create ──────────────────────────────────────────────────────────────

  /**
   * Create a reservation inside a serializable transaction.
   *
   * Process:
   * 1. Pre-validate guest + room exist (fail fast with 404 before transaction).
   * 2. Validate date range.
   * 3. Open $transaction:
   *    a. SELECT FOR UPDATE on the room row (defense-in-depth RES-05).
   *    b. INSERT reservation — exclusion constraint fires here (RES-04).
   * 4. Catch 23P01 from BOTH error paths (Pitfall P2).
   */
  async create(dto: CreateReservationDto) {
    // Step 1: Pre-validate guest exists (throws NotFoundException if missing)
    await this.guestsRepository.findById(dto.guestId);

    // Step 2: Pre-validate room exists (only if a roomId was provided; with the
    // request-to-book model the admin may create the reservation without a room
    // assigned, and assign it later at check-in).
    if (dto.roomId) {
      await this.inventoryRepository.findRoomById(dto.roomId);
    }

    // Step 3: Parse and validate dates
    const checkIn = new Date(dto.checkInDate + 'T00:00:00.000Z');
    const checkOut = new Date(dto.checkOutDate + 'T00:00:00.000Z');
    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOutDate must be after checkInDate');
    }
    const totalNights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // RES-05: Row-lock the room before insert (defense-in-depth). Skipped when
        // the reservation has no roomId yet — there is nothing to lock.
        if (dto.roomId) {
          await tx.$executeRaw`SELECT id FROM rooms WHERE id = ${dto.roomId} FOR UPDATE`;
        }

        // RES-04: INSERT — exclusion constraint fires here ONLY when roomId is set
        // (the constraint key includes roomId; NULL roomId rows are excluded from it).
        return await tx.reservation.create({
          data: {
            guestId: dto.guestId,
            roomId: dto.roomId ?? null,
            roomTypeId: dto.roomTypeId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            status: dto.status ?? 'CONFIRMED',
            source: dto.source,
            adults: dto.adults,
            children: dto.children ?? 0,
            totalNights,
            notes: dto.notes ?? null,
          },
        });
      });
    } catch (err) {
      if (this.isExclusionViolation(err)) {
        throw new ConflictException('Habitación no disponible en esas fechas (conflicto con otra reserva).');
      }
      this.logger.error(
        `create reservation failed for guestId=${dto.guestId} roomId=${dto.roomId ?? 'null'}: ${(err as Error)?.message ?? String(err)}`,
        (err as Error)?.stack,
      );
      throw err;
    }
  }

  // ─── Modify ──────────────────────────────────────────────────────────────

  /**
   * Modify a reservation's dates, room, or guest.
   * Only allowed when current status is PENDING or CONFIRMED (pre-check-in).
   * Exclusion constraint fires on UPDATE too — same 23P01 catch (Pitfall P7).
   */
  async modify(id: string, dto: UpdateReservationDto) {
    const existing = await this.reservationsRepository.findById(id);

    if (!['PENDING', 'CONFIRMED'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot modify reservation with status ${existing.status}. Only PENDING or CONFIRMED reservations can be modified.`,
      );
    }

    const updateData: Record<string, unknown> = {};

    if (dto.guestId !== undefined) updateData['guestId'] = dto.guestId;
    if (dto.roomId !== undefined) updateData['roomId'] = dto.roomId;
    if (dto.roomTypeId !== undefined) updateData['roomTypeId'] = dto.roomTypeId;
    if (dto.adults !== undefined) updateData['adults'] = dto.adults;
    if (dto.children !== undefined) updateData['children'] = dto.children;
    if (dto.notes !== undefined) updateData['notes'] = dto.notes;
    if (dto.source !== undefined) updateData['source'] = dto.source;

    // Recalculate dates and totalNights if either date changes
    const rawCheckIn = dto.checkInDate ?? existing.checkInDate;
    const rawCheckOut = dto.checkOutDate ?? existing.checkOutDate;

    if (dto.checkInDate !== undefined || dto.checkOutDate !== undefined) {
      const checkIn =
        dto.checkInDate !== undefined
          ? new Date(dto.checkInDate + 'T00:00:00.000Z')
          : (rawCheckIn as Date);
      const checkOut =
        dto.checkOutDate !== undefined
          ? new Date(dto.checkOutDate + 'T00:00:00.000Z')
          : (rawCheckOut as Date);

      if (checkOut <= checkIn) {
        throw new BadRequestException('checkOutDate must be after checkInDate');
      }

      updateData['checkInDate'] = checkIn;
      updateData['checkOutDate'] = checkOut;
      updateData['totalNights'] = Math.round(
        (checkOut.getTime() - checkIn.getTime()) / 86_400_000,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const roomId = (dto.roomId ?? existing.roomId) as string;
        if (roomId) {
          // Row-lock the room to prevent concurrent double-booking during update
          await tx.$executeRaw`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`;
        }
        return await tx.reservation.update({
          where: { id },
          data: updateData,
        });
      });
    } catch (err) {
      if (this.isExclusionViolation(err)) {
        throw new ConflictException('Habitación no disponible en esas fechas (conflicto con otra reserva).');
      }
      // Defensive: log the unexpected error so Railway captures it. Without this
      // the 500 reaches the client with no signal in the logs.
      this.logger.error(
        `modify(${id}) failed: ${(err as Error)?.message ?? String(err)}`,
        (err as Error)?.stack,
      );
      throw err;
    }
  }

  // ─── Cancel ──────────────────────────────────────────────────────────────

  /**
   * Cancel a reservation — sets status to CANCELLED.
   * Never deletes the row. Cancellation releases the date slot automatically
   * because the exclusion constraint excludes CANCELLED rows via WHERE clause.
   */
  async cancel(id: string) {
    await this.reservationsRepository.findById(id); // throws if not found
    return this.reservationsRepository.cancel(id);
  }

  /**
   * confirmRequest — admin moves a PENDING reservation to CONFIRMED.
   *
   * Only PENDING reservations can be confirmed. Other statuses return 400 so the
   * frontend never accidentally re-confirms an already-active reservation.
   * Capacity is NOT re-validated here on purpose — the admin owns availability
   * and makes the call (the constraint at DB level still fires if roomId is set
   * and overlaps an existing CONFIRMED/CHECKED_IN reservation).
   */
  async confirmRequest(id: string) {
    const existing = await this.reservationsRepository.findById(id);
    if (existing.status !== 'PENDING') {
      throw new BadRequestException(
        `Solo se pueden confirmar solicitudes con estado PENDING. Estado actual: ${existing.status}`,
      );
    }
    return this.reservationsRepository.update(id, { status: 'CONFIRMED' });
  }

  /**
   * reactivate — restore a CANCELLED reservation back to PENDING so the admin
   * can recover from an accidental cancellation or a rejected request that
   * the guest later confirmed by phone.
   *
   * Only CANCELLED reservations can be reactivated (otherwise we would be
   * stepping on the existing PENDING/CONFIRMED workflow). The reservation
   * keeps its roomId — if that physical room is now occupied by another
   * CONFIRMED reservation, the exclusion constraint at the DB level will
   * fire as soon as the admin confirms again.
   */
  async reactivate(id: string) {
    const existing = await this.reservationsRepository.findById(id);
    if (existing.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Solo se pueden reactivar reservas en estado CANCELLED. Estado actual: ${existing.status}`,
      );
    }
    // Reactivating to PENDING re-enters the exclusion constraint
    // (no_overlapping_reservations fires on every status except CANCELLED /
    // NO_SHOW — see migration 20260516000000). If the room+dates slot was
    // taken by another active reservation while this one was cancelled, the
    // DB raises 23P01. Catch it and surface a controlled 409 instead of a
    // raw 500 — same pattern as create() / modify() / confirm() (Pitfall P7).
    try {
      return await this.reservationsRepository.update(id, { status: 'PENDING' });
    } catch (err) {
      if (this.isExclusionViolation(err)) {
        throw new ConflictException(
          'No se puede reactivar: la habitación ya está reservada por otra reserva en esas fechas.',
        );
      }
      this.logger.error(
        `reactivate(${id}) failed: ${(err as Error)?.message ?? String(err)}`,
        (err as Error)?.stack,
      );
      throw err;
    }
  }

  /**
   * rejectRequest — admin moves a PENDING reservation to CANCELLED.
   *
   * Same status guard as confirm. Optional notes field captures the reason
   * (no separate rejection-reason column for v1; reuses the existing notes).
   */
  async rejectRequest(id: string, reason?: string) {
    const existing = await this.reservationsRepository.findById(id);
    if (existing.status !== 'PENDING') {
      throw new BadRequestException(
        `Solo se pueden rechazar solicitudes con estado PENDING. Estado actual: ${existing.status}`,
      );
    }
    const data: Record<string, unknown> = { status: 'CANCELLED' };
    if (reason && reason.trim().length > 0) {
      const previous = existing.notes ?? '';
      data.notes = previous ? `${previous}
[Rechazo]: ${reason}` : `[Rechazo]: ${reason}`;
    }
    return this.reservationsRepository.update(id, data);
  }

  // ─── List / Get ──────────────────────────────────────────────────────────

  findAll(filter: ReservationFilter = {}) {
    return this.reservationsRepository.findAll(filter);
  }

  findById(id: string) {
    return this.reservationsRepository.findById(id);
  }

  // ─── AI-only methods (Phase 07) ──────────────────────────────────────────

  /**
   * findByIdForAI — returns a sanitized reservation summary for the AI get_reservation tool.
   * Accepts either a UUID reservation ID or a confirmation code (NOT YET IMPLEMENTED in schema).
   * Returns null if not found (caller wraps in tool handler).
   *
   * Note: This codebase does not have a confirmationCode field in the schema.
   * Searching by confirmationCode is supported as a future extension — for now
   * only UUID lookup is performed.
   */
  async findByIdForAI(idOrCode: string): Promise<{
    id: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
    guestName: string;
    roomNumber: string | null;
    totalNights: number;
  } | null> {
    // Try UUID lookup first
    const reservation = await this.reservationsRepository.findByIdWithDetails(idOrCode);
    if (!reservation) return null;

    return {
      id: reservation.id,
      status: reservation.status,
      checkInDate: (reservation.checkInDate as Date).toISOString().slice(0, 10),
      checkOutDate: (reservation.checkOutDate as Date).toISOString().slice(0, 10),
      guestName: (reservation as any).guest?.fullName ?? 'Unknown',
      roomNumber: (reservation as any).room?.number ?? null,
      totalNights: reservation.totalNights,
    };
  }

  /**
   * findCheckinsTodayForAI — list of reservations checking in on the hotel business date.
   * Used by the AI get_checkins_today tool. Returns up to 50 results.
   */
  async findCheckinsTodayForAI(): Promise<
    Array<{
      reservationId: string;
      guestName: string;
      roomNumber: string | null;
      checkInDate: string;
      status: string;
    }>
  > {
    const businessDate = await this.prisma.systemConfig.findFirst({
      select: { hotelBusinessDate: true },
    });
    if (!businessDate) return [];

    const today = businessDate.hotelBusinessDate;
    const reservations = await this.prisma.reservation.findMany({
      where: {
        checkInDate: today,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
      take: 50,
      orderBy: { checkInDate: 'asc' },
      include: {
        guest: { select: { fullName: true } },
        room: { select: { number: true } },
      },
    });

    return reservations.map((r) => ({
      reservationId: r.id,
      guestName: (r as any).guest?.fullName ?? 'Unknown',
      roomNumber: (r as any).room?.number ?? null,
      checkInDate: (r.checkInDate as Date).toISOString().slice(0, 10),
      status: r.status,
    }));
  }

  /**
   * findCheckoutsTodayForAI — list of reservations checking out on the hotel business date.
   * Used by the AI get_checkouts_today tool. Returns up to 50 results.
   * Includes folio balance from the open folio if available.
   */
  async findCheckoutsTodayForAI(): Promise<
    Array<{
      reservationId: string;
      guestName: string;
      roomNumber: string | null;
      checkOutDate: string;
      folioBalance: number;
    }>
  > {
    const businessDate = await this.prisma.systemConfig.findFirst({
      select: { hotelBusinessDate: true },
    });
    if (!businessDate) return [];

    const today = businessDate.hotelBusinessDate;
    const reservations = await this.prisma.reservation.findMany({
      where: {
        checkOutDate: today,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      },
      take: 50,
      orderBy: { checkOutDate: 'asc' },
      include: {
        guest: { select: { fullName: true } },
        room: { select: { number: true } },
        folio: {
          include: {
            items: {
              where: { voidedByEntryId: null },
              select: { amount: true, taxAmount: true },
            },
          },
        },
      },
    });

    return reservations.map((r) => {
      const folio = (r as any).folio;
      const folioBalance = folio
        ? Math.round(
            folio.items.reduce((acc: number, item: any) => {
              const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount.toString());
              const taxAmount = typeof item.taxAmount === 'number' ? item.taxAmount : Number(item.taxAmount.toString());
              return acc + amount + taxAmount;
            }, 0),
          )
        : 0;

      return {
        reservationId: r.id,
        guestName: (r as any).guest?.fullName ?? 'Unknown',
        roomNumber: (r as any).room?.number ?? null,
        checkOutDate: (r.checkOutDate as Date).toISOString().slice(0, 10),
        folioBalance,
      };
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * isExclusionViolation — checks BOTH error paths for PostgreSQL 23P01.
   *
   * Pitfall P2: 23P01 propagates differently than P2002:
   * - Path A: PrismaClientKnownRequestError with meta.code = '23P01'
   * - Path B: Raw error object with code = '23P01'
   *
   * Both paths must be handled — Prisma does NOT standardize 23P01 as P2002.
   */
  private isExclusionViolation(err: unknown): boolean {
    // Path A: PrismaClientKnownRequestError with 23P01 in meta
    if (
      err instanceof PrismaClientKnownRequestError &&
      (err.meta as { code?: string } | undefined)?.code === '23P01'
    ) {
      return true;
    }
    // Path B: Raw pg error with code 23P01
    if ((err as { code?: string })?.code === '23P01') {
      return true;
    }
    // Path C: Prisma 7 wraps the underlying pg error inside .cause / .meta.cause
    // with the constraint name visible in the message. Pattern-match the
    // canonical "no_overlapping_reservations" constraint name our migration
    // defined in 20260516000000_add_reservation_exclusion_constraint.
    const message =
      (err as { message?: string })?.message ??
      ((err as { meta?: { cause?: string } })?.meta?.cause ?? '');
    if (typeof message === 'string' && message.toLowerCase().includes('no_overlapping_reservations')) {
      return true;
    }
    return false;
  }
}
