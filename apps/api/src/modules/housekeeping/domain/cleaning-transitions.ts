import type { CleaningStatus } from '../../../generated/prisma/client';

/**
 * CLEANING_TRANSITIONS — single source of truth for cleaningStatus state machine.
 *
 * DIRTY:       room just vacated; housekeeping starts cleaning (→ IN_PROGRESS)
 *              or manager overrides directly to INSPECTION (quick-pass)
 * IN_PROGRESS: cleaning in progress; supervisor check required → INSPECTION
 * INSPECTION:  supervisor verifying; approved → CLEAN; problem → IN_PROGRESS (redo)
 * CLEAN:       ready for next check-in; checkout domain event → DIRTY (HK-06)
 *
 * CLEAN → DIRTY is the checkout domain event path (HK-06).
 * DIRTY → INSPECTION is allowed for manager quick-pass.
 * INSPECTION → IN_PROGRESS allowed for supervisor redo.
 * DIRTY → CLEAN is BLOCKED (no shortcut past inspection).
 * IN_PROGRESS → CLEAN is BLOCKED (must pass inspection).
 *
 * NEVER replicate this table in controllers or services.
 */
export const CLEANING_TRANSITIONS: Record<CleaningStatus, CleaningStatus[]> = {
  DIRTY: ['IN_PROGRESS', 'INSPECTION'],
  IN_PROGRESS: ['INSPECTION'],
  INSPECTION: ['CLEAN', 'IN_PROGRESS'],
  CLEAN: ['DIRTY'],
};

/**
 * CleaningDomainException — thrown when a cleaningStatus transition is invalid.
 * Caught by exception filter and converted to HTTP 400 BadRequest.
 * Distinct from DomainException (inventory) and HTTP 412 PreconditionFailed (OPS-03).
 */
export class CleaningDomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CleaningDomainException';
  }
}

/**
 * transitionCleaningStatus — validates a cleaningStatus transition.
 *
 * @throws CleaningDomainException if the transition is not in CLEANING_TRANSITIONS.
 */
export function transitionCleaningStatus(
  current: CleaningStatus,
  next: CleaningStatus,
): void {
  const allowed = CLEANING_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new CleaningDomainException(
      `Invalid cleaningStatus transition: ${current} → ${next}. Allowed: ${allowed.join(', ')}`,
    );
  }
}
