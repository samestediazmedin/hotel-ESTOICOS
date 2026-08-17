import { SeasonDomain } from './season.entity';

/**
 * Thin domain wrapper — documents the shape of a rate plan in the domain layer.
 * The Prisma model is the source of truth for persistence; this interface
 * documents the shape returned from PricingRepository and used by PricingService.
 */
export interface RatePlanDomain {
  id: string;
  name: string;
  type: 'BAR' | 'PROMO' | 'PACKAGE';
  roomTypeId: string;
  isActive: boolean;
  seasons: SeasonDomain[];
}
