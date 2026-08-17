import { PhysicalStatus } from './room-status.enum';

/**
 * DomainException — thrown when a business rule is violated.
 * Caught by NestJS exception filter and converted to 422 Unprocessable Entity.
 */
export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainException';
  }
}

/**
 * PHYSICAL_TRANSITIONS — valid physicalStatus state machine transitions.
 *
 * - AVAILABLE: room is ready to be occupied, put under maintenance, or held
 * - OCCUPIED: only check-out returns to AVAILABLE (Phase 4)
 * - OUT_OF_SERVICE: maintenance complete → AVAILABLE
 * - ON_HOLD: can go back to AVAILABLE or be sent to OUT_OF_SERVICE
 *
 * IMPORTANT: This table is the SINGLE source of truth for status transitions.
 * Do NOT replicate this logic in controllers or services.
 */
const PHYSICAL_TRANSITIONS: Record<PhysicalStatus, PhysicalStatus[]> = {
  [PhysicalStatus.AVAILABLE]: [
    PhysicalStatus.OCCUPIED,
    PhysicalStatus.OUT_OF_SERVICE,
    PhysicalStatus.ON_HOLD,
  ],
  [PhysicalStatus.OCCUPIED]: [
    PhysicalStatus.AVAILABLE, // Phase 4: check-out
  ],
  [PhysicalStatus.OUT_OF_SERVICE]: [PhysicalStatus.AVAILABLE],
  [PhysicalStatus.ON_HOLD]: [
    PhysicalStatus.AVAILABLE,
    PhysicalStatus.OUT_OF_SERVICE,
  ],
};

/**
 * transitionPhysicalStatus — validates and enforces the state machine.
 *
 * @throws DomainException if the transition is not permitted.
 */
export function transitionPhysicalStatus(
  current: PhysicalStatus,
  next: PhysicalStatus,
): void {
  const allowed = PHYSICAL_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new DomainException(
      `Invalid physicalStatus transition: ${current} → ${next}. Allowed: ${allowed.join(', ')}`,
    );
  }
}
