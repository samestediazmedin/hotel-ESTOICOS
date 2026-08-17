// ─── Pricing Breakdown types (Phase 02-03) ───────────────────────────────────
// Shared between PricingPage, ReservationWizard, and ReservationDrawer.

export interface PricingLineItem {
  date: string;          // "YYYY-MM-DD"
  base: number;          // base price for that night
  multiplier: number;    // season multiplier applied
  nightRate: number;     // base * multiplier (before IVA)
  ivaRate: number;       // 0.19 for Colombia
  ivaAmount: number;     // nightRate * ivaRate
  lineTotal: number;     // nightRate + ivaAmount
  seasonName: string | null;
}

export interface PricingBreakdown {
  roomTypeId: string;
  checkIn: string;       // "YYYY-MM-DD"
  checkOut: string;      // "YYYY-MM-DD"
  totalNights: number;
  items: PricingLineItem[];
  total: number;         // sum of all lineTotals
  minNightsViolation: boolean;
  minNightsRequired: number | null;
}
