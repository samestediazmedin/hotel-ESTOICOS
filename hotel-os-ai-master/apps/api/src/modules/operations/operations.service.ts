import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { FolioService } from '../folio/folio.service';
import { transitionPhysicalStatus } from '../inventory/domain/room.entity';
import { PhysicalStatus } from '../inventory/domain/room-status.enum';

/**
 * OperationsService — check-in / check-out orchestration.
 *
 * Both operations wrap ALL state mutations in a single prisma.$transaction.
 * If any step fails, NONE persist (OPS-01 atomicity guarantee).
 *
 * Check-in transaction:
 *   1. Load reservation + room (guard: CONFIRMED status, non-null roomId, CLEAN/INSPECTION room)
 *   2. reservation.status → CHECKED_IN
 *   3. room.physicalStatus → OCCUPIED (via PHYSICAL_TRANSITIONS state machine)
 *   4. Stay row created (arrivedAt = now, departedAt = null)
 *   5. Folio opened via FolioService.openFolio(tx, reservationId)
 *
 * Check-out transaction:
 *   1. Load reservation (guard: CHECKED_IN status)
 *   2. reservation.status → CHECKED_OUT
 *   3. room.physicalStatus → AVAILABLE (via PHYSICAL_TRANSITIONS state machine)
 *   4. Stay.departedAt = now
 *   5. FolioService.closeFolio(tx, folioId)
 *
 * No charges are posted at check-in or check-out.
 * Room charges are posted by the night audit cron at 03:00 (Plan 04-02).
 */
@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly folioService: FolioService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Check-in ─────────────────────────────────────────────────────────────

  async checkIn(reservationId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: { room: true },
      });

      // Guard 1: must be CONFIRMED
      if (reservation.status !== 'CONFIRMED') {
        throw new BadRequestException(
          `Reservation status is ${reservation.status}, expected CONFIRMED`,
        );
      }

      // Guard 2: must have a room assigned (Pitfall P12 from research)
      if (!reservation.roomId) {
        throw new BadRequestException(
          'No room assigned to reservation — assign a room before check-in',
        );
      }

      // Guard 3: cleaningStatus must be CLEAN or INSPECTION (OPS-03)
      const cleaningStatus = reservation.room?.cleaningStatus ?? '';
      if (!['CLEAN', 'INSPECTION'].includes(cleaningStatus)) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PRECONDITION_FAILED,
            message: `Room ${reservation.room?.number} cleaningStatus is ${cleaningStatus}. Must be CLEAN or INSPECTION before check-in.`,
            error: 'Precondition Failed',
          },
          HttpStatus.PRECONDITION_FAILED,
        );
      }

      // Guard 4: room must not already be OCCUPIED (409 Conflict — someone else is checked in)
      const currentPhysical = reservation.room?.physicalStatus as PhysicalStatus;
      if (currentPhysical === PhysicalStatus.OCCUPIED) {
        throw new ConflictException(
          `La habitación ${reservation.room?.number} ya está ocupada. El huésped actual debe hacer check-out antes de un nuevo check-in.`,
        );
      }

      // Validate physicalStatus transition: AVAILABLE → OCCUPIED
      // Catch any other invalid transition (OUT_OF_SERVICE, ON_HOLD, etc.) as a controlled 409
      try {
        transitionPhysicalStatus(currentPhysical, PhysicalStatus.OCCUPIED);
      } catch (err) {
        throw new ConflictException(
          `No se puede hacer check-in: transición de estado físico inválida (${currentPhysical} → ${PhysicalStatus.OCCUPIED}) en habitación ${reservation.room?.number}.`,
        );
      }

      // Mutation 1: reservation status transition
      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'CHECKED_IN' },
      });

      // Mutation 2: room physicalStatus transition
      await tx.room.update({
        where: { id: reservation.roomId },
        data: { physicalStatus: PhysicalStatus.OCCUPIED },
      });

      // Mutation 3: create Stay record
      const stay = await tx.stay.create({
        data: {
          reservationId,
          roomId: reservation.roomId,
          arrivedAt: new Date(),
        },
      });

      // Mutation 4: open Folio using SAME tx (atomicity)
      const folio = await this.folioService.openFolio(tx as any, reservationId);

      return { reservationId, stay, folio };
    });
  }

  // ─── Check-out ────────────────────────────────────────────────────────────

  async checkOut(reservationId: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUniqueOrThrow({
        where: { id: reservationId },
        include: { room: true },
      });

      // Guard: must be CHECKED_IN
      if (reservation.status !== 'CHECKED_IN') {
        throw new BadRequestException(
          `Reservation status is ${reservation.status}, expected CHECKED_IN`,
        );
      }

      // Validate physicalStatus transition: OCCUPIED → AVAILABLE
      // Catch any invalid transition as a controlled 409 (not a raw 500)
      const currentPhysical = reservation.room?.physicalStatus as PhysicalStatus;
      try {
        transitionPhysicalStatus(currentPhysical, PhysicalStatus.AVAILABLE);
      } catch (err) {
        throw new ConflictException(
          `No se puede hacer check-out: transición de estado físico inválida (${currentPhysical} → ${PhysicalStatus.AVAILABLE}) en habitación ${reservation.room?.number}.`,
        );
      }

      // Mutation 1: reservation status transition
      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'CHECKED_OUT' },
      });

      // Mutation 2: room physicalStatus → AVAILABLE
      await tx.room.update({
        where: { id: reservation.roomId! },
        data: { physicalStatus: PhysicalStatus.AVAILABLE },
      });

      // Mutation 3: update Stay.departedAt
      const stay = await tx.stay.findFirst({
        where: { reservationId, departedAt: null },
        orderBy: { arrivedAt: 'desc' },
      });
      if (stay) {
        await tx.stay.update({
          where: { id: stay.id },
          data: { departedAt: new Date() },
        });
      }

      // Mutation 4: close Folio using SAME tx (atomicity)
      const existingFolio = await tx.folio.findUnique({ where: { reservationId } });
      let folio = null;
      if (existingFolio) {
        folio = await this.folioService.closeFolio(tx as any, existingFolio.id);
      }

      return { reservationId, roomId: reservation.roomId!, folio };
    });

    // AFTER $transaction commits — fire-and-forget domain event (closes Phase 4 W2 / OPS-02 partial).
    // DO NOT emit inside the transaction (P3 from RESEARCH §5 — socket fires before DB write commits).
    // DO NOT await — do not block the checkout response (same as void emailService.send() in Phase 03-04).
    // DO use emitAsync (not emit) — async listeners can catch their own errors internally.
    this.eventEmitter.emitAsync('reservation.checked_out', {
      reservationId: result.reservationId,
      roomId: result.roomId,
      at: new Date().toISOString(),
    }).catch((error) => {
      console.error('Failed to emit reservation.checked_out event:', error);
    });

    return result;
  }
}
