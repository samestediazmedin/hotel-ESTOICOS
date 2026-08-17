/**
 * displayPrice — IVA-aware price formatting utilities for the public homepage.
 *
 * The booking flow (rate-options) already computes the full IVA breakdown
 * server-side. This helper is ONLY for the homepage "desde / por noche" labels
 * driven by the `displayPricesWithIva` system config flag.
 *
 * 2026-05-29 — Added to address the requirement that the public homepage shows
 * either IVA-inclusive prices (displayPricesWithIva=true) or bare base prices
 * (displayPricesWithIva=false) depending on the admin toggle.
 */

export interface IvaDisplayContext {
  displayPricesWithIva: boolean;
  ivaRate: number;
}

export interface DisplayPriceResult {
  /** The amount to show: base*(1+ivaRate) rounded when flag on, base when off. */
  amount: number;
  /** Whether the rendered amount already includes IVA. */
  ivaIncluded: boolean;
}

/**
 * formatRoomPrice — compute the display amount for a room's nightly price.
 *
 * @param base        Raw base price in COP (plain number, no IVA applied).
 * @param ctx         IVA display context from HotelInfo ({ displayPricesWithIva, ivaRate }).
 * @returns           { amount, ivaIncluded }
 *
 * @example
 *   formatRoomPrice(290_000, { displayPricesWithIva: true, ivaRate: 0.19 })
 *   // → { amount: 345100, ivaIncluded: true }
 *
 *   formatRoomPrice(290_000, { displayPricesWithIva: false, ivaRate: 0.19 })
 *   // → { amount: 290000, ivaIncluded: false }
 */
export function formatRoomPrice(
  base: number,
  ctx: IvaDisplayContext,
): DisplayPriceResult {
  if (ctx.displayPricesWithIva) {
    return {
      amount: Math.round(base * (1 + ctx.ivaRate)),
      ivaIncluded: true,
    };
  }
  return {
    amount: base,
    ivaIncluded: false,
  };
}

/**
 * formatCOP — locale-aware COP currency formatter.
 *
 * Consistent with the formatter previously inline in RoomTypeDetailDrawer.
 * Extracted here so all homepage price surfaces use the same locale string.
 */
export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * formatCOPShort — compact "Xk" format used in the ReservationWidget price label.
 *
 * @example formatCOPShort(345100) → "$345k"
 */
export function formatCOPShort(amount: number): string {
  return `$${(amount / 1000).toFixed(0)}k`;
}
