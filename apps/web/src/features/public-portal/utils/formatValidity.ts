/**
 * formatValidity — human-friendly Spanish string for an offer's validity range.
 * Returns null when neither date is set (permanent / no-expiry offer).
 *
 * Dates must be YYYY-MM-DD strings (UTC). The UTC noon trick avoids
 * midnight-rollback issues across all system timezones.
 */
export function formatValidity(from: string | null, to: string | null): string | null {
  if (!from && !to) return null;
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00.000Z').toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  if (from && to) return `Válido del ${fmt(from)} al ${fmt(to)}`;
  if (from) return `Válido desde el ${fmt(from)}`;
  return `Válido hasta el ${fmt(to as string)}`;
}
