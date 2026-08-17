/**
 * formatCOP — Colombia Peso currency formatter for use in @react-pdf/renderer.
 *
 * WHY: @react-pdf/renderer runs in Node.js with limited ICU support.
 * Intl.NumberFormat('es-CO', ...) is unreliable inside react-pdf components (P13).
 * This manual formatter produces the Colombian convention: $ 100.000 (dot thousands,
 * no decimals, space after $).
 *
 * Examples:
 *   formatCOP(100000)  → '$ 100.000'
 *   formatCOP(0)       → '$ 0'
 *   formatCOP(-50000)  → '-$ 50.000'
 *   formatCOP(1234567) → '$ 1.234.567'
 *   formatCOP(null)    → '$ 0'
 */

export type CopInput = number | { toString(): string } | null | undefined;

export function formatCOP(amount: CopInput): string {
  if (amount === null || amount === undefined) return '$ 0';
  const n = typeof amount === 'number' ? amount : Number(amount.toString());
  if (Number.isNaN(n)) return '$ 0';
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded).toString();
  const withDots = abs.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$ ${withDots}`;
}
