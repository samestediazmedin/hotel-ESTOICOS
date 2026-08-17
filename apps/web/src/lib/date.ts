/**
 * Date utility helpers for HotelOS.
 *
 * CRITICAL — timezone pitfall (D-15):
 * Hotel business dates are LOCAL calendar dates, not UTC.
 * A guest selecting "June 15" in Bogotá (UTC-5) at 8pm has a
 * local date of June 15, but the UTC time is June 15 at 1am next day.
 * Calling toISOString().slice(0,10) on that Date returns "2026-06-16" — wrong.
 *
 * Use toLocalISODate() for any date the user selected from a date picker.
 * Use new Date(iso + 'T00:00:00.000Z') when parsing API responses (already UTC).
 */

/**
 * Serialize a Date to "YYYY-MM-DD" using the LOCAL calendar date, not UTC.
 * Prevents the off-by-one error for users in UTC-5 (Bogotá) and similar zones.
 */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format a "YYYY-MM-DD" ISO date string for display.
 * Returns e.g. "15 jun 2026" in es-CO locale.
 */
export function formatDisplayDate(isoDate: string): string {
  // Parse as UTC noon to avoid date shifting in any timezone
  const d = new Date(isoDate + 'T12:00:00.000Z');
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Parse a "YYYY-MM-DD" string into a Date at LOCAL midnight.
 * Use this when converting URL params back to Date objects for a date picker.
 */
export function fromLocalISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Human-readable short date in Spanish (es-CO): "14 jun"
 * Used in the reservation widget to display selected dates compactly.
 */
export function formatShortDateEs(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(date);
}
