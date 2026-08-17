import { describe, it, expect } from 'vitest';
import {
  transitionCleaningStatus,
  CleaningDomainException,
} from './cleaning-transitions';

describe('CLEANING_TRANSITIONS state machine', () => {
  // ── Valid transitions ────────────────────────────────────────────────────

  it('Test 1 — DIRTY → IN_PROGRESS passes (housekeeping starts cleaning)', () => {
    expect(() => transitionCleaningStatus('DIRTY', 'IN_PROGRESS')).not.toThrow();
  });

  it('Test 2 — DIRTY → INSPECTION passes (manager quick-pass override)', () => {
    expect(() => transitionCleaningStatus('DIRTY', 'INSPECTION')).not.toThrow();
  });

  it('Test 3 — INSPECTION → IN_PROGRESS passes (supervisor sends back for redo)', () => {
    expect(() => transitionCleaningStatus('INSPECTION', 'IN_PROGRESS')).not.toThrow();
  });

  it('Test 4 — CLEAN → DIRTY passes (HK-06: checkout domain event path)', () => {
    expect(() => transitionCleaningStatus('CLEAN', 'DIRTY')).not.toThrow();
  });

  // ── Invalid transitions ──────────────────────────────────────────────────

  it('Test 5 — DIRTY → CLEAN throws CleaningDomainException (must pass inspection)', () => {
    expect(() => transitionCleaningStatus('DIRTY', 'CLEAN')).toThrow(CleaningDomainException);
    expect(() => transitionCleaningStatus('DIRTY', 'CLEAN')).toThrow(
      /Invalid cleaningStatus transition: DIRTY → CLEAN/,
    );
  });

  it('Test 6 — IN_PROGRESS → CLEAN throws CleaningDomainException (must pass INSPECTION first)', () => {
    expect(() => transitionCleaningStatus('IN_PROGRESS', 'CLEAN')).toThrow(CleaningDomainException);
    expect(() => transitionCleaningStatus('IN_PROGRESS', 'CLEAN')).toThrow(
      /Invalid cleaningStatus transition: IN_PROGRESS → CLEAN/,
    );
  });

  // ── W1 Plan-check: IN_PROGRESS → DIRTY (mid-cleaning checkout scenario) ──

  it('Test W1 — IN_PROGRESS → DIRTY throws CleaningDomainException (forceTransitionToDirty bypasses this)', () => {
    // Normal state machine does NOT allow IN_PROGRESS → DIRTY directly.
    // forceTransitionToDirty skips the guard for checkout scenarios.
    expect(() => transitionCleaningStatus('IN_PROGRESS', 'DIRTY')).toThrow(CleaningDomainException);
    expect(() => transitionCleaningStatus('IN_PROGRESS', 'DIRTY')).toThrow(
      /Invalid cleaningStatus transition: IN_PROGRESS → DIRTY/,
    );
  });
});
