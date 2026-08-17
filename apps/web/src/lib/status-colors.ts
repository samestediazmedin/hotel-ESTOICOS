/**
 * status-colors.ts
 *
 * Shared status → CSS variable mappings consumed by:
 *   - RoomRackTable (INT-03)
 *   - DashboardPage donut chart (INT-02)
 *   - HousekeepingPage kanban (INT-06)
 *
 * All values reference CSS variables so dark mode overrides in
 * .hos[data-theme="dark"] are picked up automatically at runtime.
 * Zero hex literals — no Tailwind palette colors.
 */

import type { RoomStatus } from '@/components/ui/status-pill';

/** Foreground (text / stroke / SVG fill) color per room status. */
export const STATUS_COLORS: Record<RoomStatus, string> = {
  available:   'var(--status-available)',
  reserved:    'var(--status-reserved)',
  occupied:    'var(--status-occupied)',
  cleaning:    'var(--status-cleaning)',
  maintenance: 'var(--status-maintenance)',
  blocked:     'var(--status-blocked)',
};

/** Background fill color per room status. */
export const STATUS_BG_COLORS: Record<RoomStatus, string> = {
  available:   'var(--status-available-bg)',
  reserved:    'var(--status-reserved-bg)',
  occupied:    'var(--status-occupied-bg)',
  cleaning:    'var(--status-cleaning-bg)',
  maintenance: 'var(--status-maintenance-bg)',
  blocked:     'var(--status-blocked-bg)',
};

/**
 * Reservation status union — mirrors Prisma ReservationStatus enum
 * but kept as a frontend-only string union to avoid Prisma client imports
 * in the browser bundle.
 */
export type ReservationStatus =
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'NO_SHOW'
  | 'CANCELLED'
  | 'PENDING';

/**
 * Locked mapping from reservation status to CSS variable color.
 * Decisions documented in 11-CONTEXT.md decision #8.
 *
 * CONFIRMED   → reserved blue  (upcoming, confirmed)
 * CHECKED_IN  → occupied/terracotta (currently in-house)
 * CHECKED_OUT → maintenance/muted  (departed)
 * NO_SHOW     → blocked/dark       (missed arrival)
 * CANCELLED   → ink-4/faded        (voided)
 * PENDING     → cleaning/mustard   (awaiting confirmation)
 */
export const RESERVATION_STATUS_TO_CSS: Record<ReservationStatus, string> = {
  CONFIRMED:   'var(--status-reserved)',
  CHECKED_IN:  'var(--status-occupied)',
  CHECKED_OUT: 'var(--status-maintenance)',
  NO_SHOW:     'var(--status-blocked)',
  CANCELLED:   'var(--ink-4)',
  PENDING:     'var(--status-cleaning)',
};
