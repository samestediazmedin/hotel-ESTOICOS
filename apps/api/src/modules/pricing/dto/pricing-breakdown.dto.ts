/**
 * Internal pricing service types — NOT HTTP DTOs.
 * No class-validator decorators. These are interfaces consumed by
 * PricingService, PublicBookingModule, ReservationsModule, and FolioModule.
 *
 * FIELD SEMANTICS — total vs grand-total
 * ───────────────────────────────────────
 * `subtotal`      — sum of nightRate for all nights (room-only, pre-tax)
 * `totalIva`      — sum of ivaAmount for all nights (room IVA only)
 * `roomTotal`     — subtotal + totalIva  (room charge inclusive of IVA)
 *
 * `extrasSubtotal` — sum of extra.subtotal (pre-tax)
 * `extrasIva`      — sum of extra.ivaAmount
 * `extrasTotal`    — extrasSubtotal + extrasIva
 *
 * `total`         — roomTotal + extrasTotal  ← GRAND TOTAL (room + extras)
 *
 * For BAR plans (no extras), extrasSubtotal/extrasIva/extrasTotal are all 0
 * and `total` equals what it always has: roomTotal.  Night-audit and
 * availability callers are therefore unaffected — they use `breakdown.items`
 * (nightly nightRate) and `total` unchanged.
 *
 * PRICING FORMULA (2026-05-29):
 *   nightRate  = Math.round(basePrice × seasonMultiplier × planModifier)
 *   ivaAmount  = Math.round(nightRate × ivaRate)
 *   lineTotal  = nightRate + ivaAmount
 *
 * Extras are FIXED — NOT multiplied by season or planModifier.
 * They carry the same cost regardless of season (breakfast costs the same in Dec).
 */

export interface PricingInput {
  roomTypeId: string;
  checkIn: Date;      // UTC midnight date
  checkOut: Date;     // UTC midnight date — exclusive (half-open interval [checkIn, checkOut))
  ratePlanType?: 'BAR' | 'PROMO' | 'PACKAGE';  // default: 'BAR'
  /** Number of adults occupying the room — used for PER_PERSON_PER_NIGHT extras. Default 1. */
  adults?: number;
}

export interface PricingLineItem {
  date: string;           // "2026-06-01" — calendar date this night charge applies to
  base: number;           // RoomType.basePrice as number (COP)
  multiplier: number;     // 1.0 if no season, season.multiplier as number if season applies
  /** Per-plan price modifier (RatePlan.priceModifier). 1.0 = no adjustment.
   *  Transparent: breakdown consumers can verify how the nightRate was computed. */
  planModifier: number;   // RatePlan.priceModifier — default 1.0 when no plan
  /** Final per-night room rate AFTER both multipliers.
   *  nightRate = Math.round(base × multiplier × planModifier) */
  nightRate: number;      // COP
  ivaRate: number;        // from system_config (e.g. 0.19)
  ivaAmount: number;      // Math.round(nightRate * ivaRate) — COP
  lineTotal: number;      // nightRate + ivaAmount — COP
  seasonName: string | null;  // e.g. "HIGH", "LOW", null if no season
}

/** A single bundled extra that comes with a rate plan (e.g. breakfast). */
export interface PricingExtraLineItem {
  name: string;         // e.g. "Desayuno incluido"
  pricingMode: string;  // "PER_STAY" | "PER_NIGHT" | "PER_PERSON_PER_NIGHT"
  unitAmount: number;   // base amount per pricing unit (COP, pre-tax)
  quantity: number;     // computed units (1 | nights | nights*adults)
  subtotal: number;     // unitAmount * quantity — pre-tax (COP)
  ivaAmount: number;    // Math.round(subtotal * ivaRate) — COP
  total: number;        // subtotal + ivaAmount — COP (this extra's contribution)
}

export interface PricingBreakdown {
  roomTypeId: string;
  ratePlanId: string | null;        // null if no active plan found
  nights: number;
  items: PricingLineItem[];          // one entry per night — Phase 4 folio uses this

  // ── Room charge totals ───────────────────────────────────────────────────
  subtotal: number;                  // sum of nightRate (room pre-tax)
  totalIva: number;                  // sum of room ivaAmount
  roomTotal: number;                 // subtotal + totalIva  (room charge incl. IVA)

  // ── Extras totals (zero when no extras) ──────────────────────────────────
  extras: PricingExtraLineItem[];    // one entry per RatePlanExtra
  extrasSubtotal: number;            // sum of extra.subtotal (pre-tax)
  extrasIva: number;                 // sum of extra.ivaAmount
  extrasTotal: number;               // extrasSubtotal + extrasIva

  // ── Grand total ───────────────────────────────────────────────────────────
  /** Grand total = roomTotal + extrasTotal.  For BAR plans (no extras) this
   *  equals roomTotal — semantically unchanged vs. previous versions. */
  total: number;

  currency: 'COP';
  appliedRatePlan: string;           // plan name, or "Base Rate" if no plan
  minNightsViolation?: {
    required: number;
    actual: number;
    seasonName: string;
  };
}

/** One available rate option returned by calculateAllPlans. */
export interface RatePlanOption {
  ratePlanId: string | null;    // null for the synthetic "Base Rate" fallback
  ratePlanName: string;         // e.g. "Tarifa BAR", "Todo Incluido", "Base Rate"
  ratePlanType: string;         // "BAR" | "PROMO" | "PACKAGE" | "BASE"
  description: string | null;  // from RatePlan.description — shown to guest
  breakdown: PricingBreakdown;
}
