/**
 * Thin domain wrapper for Season.
 * multiplier is typed as `any` because it comes from Prisma as a Decimal object.
 * Always call Number(season.multiplier) before arithmetic.
 */
export interface SeasonDomain {
  id: string;
  name: string;      // HIGH | MID | LOW (convention — free text in v1)
  startDate: Date;
  endDate: Date;
  multiplier: any;   // Prisma Decimal — always use Number(season.multiplier) in service
  minNights: number;
}
