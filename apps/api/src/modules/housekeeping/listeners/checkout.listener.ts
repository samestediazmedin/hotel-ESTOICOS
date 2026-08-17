import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HousekeepingService } from '../housekeeping.service';

/**
 * ReservationCheckedOutEvent — payload for 'reservation.checked_out' domain event.
 *
 * Emitted by OperationsService.checkOut() AFTER prisma.$transaction commits.
 * Consumed by CheckoutListener to transition room.cleaningStatus → DIRTY.
 */
export interface ReservationCheckedOutEvent {
  reservationId: string;
  roomId: string;
  at: string; // ISO timestamp
}

/**
 * CheckoutListener — listens for 'reservation.checked_out' and transitions room → DIRTY.
 *
 * Decouples OperationsModule from HousekeepingModule (no direct import).
 * The checkout transaction already committed before this listener fires.
 *
 * CRITICAL (P1 from RESEARCH §5):
 *   NEVER rethrow from event listeners. The checkout is already committed.
 *   If the DIRTY transition fails (e.g., network error), log and continue.
 *   Housekeeping staff can manually set the room to DIRTY if needed.
 */
@Injectable()
export class CheckoutListener {
  private readonly logger = new Logger(CheckoutListener.name);

  constructor(private readonly hkService: HousekeepingService) {}

  @OnEvent('reservation.checked_out', { async: true })
  async handleCheckout(event: ReservationCheckedOutEvent): Promise<void> {
    try {
      await this.hkService.forceTransitionToDirty(event.roomId, event.at);
      this.logger.log(
        `Room ${event.roomId} transitioned to DIRTY after checkout of reservation ${event.reservationId}`,
      );
    } catch (err) {
      // P1: never rethrow — checkout already committed, don't break the event loop
      this.logger.error(
        `Failed to transition room ${event.roomId} to DIRTY after checkout ${event.reservationId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
