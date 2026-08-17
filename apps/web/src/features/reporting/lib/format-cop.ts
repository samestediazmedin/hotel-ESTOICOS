/**
 * formatCOP — format a COP integer with dot thousands, no decimals.
 *
 * Examples:
 *   formatCOP(185000)   → 'COP 185.000'
 *   formatCOP(0)        → 'COP 0'
 *   formatCOP(null)     → '—'
 */
export function formatCOP(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  // Use Intl for correct dot-separated thousands (es-CO locale)
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * formatPct — format 0..1 occupancy as percentage string.
 * formatPct(0.752) → '75.2%'
 * formatPct(null)  → '—'
 */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const pct = Math.round(value * 1000) / 10; // 1 decimal
  return `${pct}%`;
}
