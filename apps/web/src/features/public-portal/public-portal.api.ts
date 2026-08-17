import { api } from '@/lib/api';
import type {
  HotelInfo,
  RoomTypeCard,
  Photo,
  PublicReviewsResponse,
  PublicOffer,
} from './types';

/**
 * Phase 12 — Public Portal API client.
 *
 * Calls the unauthenticated /api/public/* endpoints. Reuses the same axios
 * instance as the rest of the app (lib/api.ts). The Phase 10 refresh-loop bug
 * is already fixed via EARLY EXIT guard in the response interceptor — the new
 * public endpoints return 200, so no 401 interceptor logic ever fires.
 *
 * Pattern: mirrors apps/web/src/features/reporting/reporting.api.ts
 */

/** Raw shape returned by GET /api/public/hotel-info */
interface ApiHotelInfo {
  name: string;          // maps to HotelInfo.hotelName
  address: string;       // maps to HotelInfo.hotelAddress
  tagline: string;
  description: string;
  phone?: string;
  rating: number;
  reviewCount: number;
  tags: string[];
  // 2026-05-29 — IVA display fields passed through from system_config
  displayPricesWithIva: boolean;
  ivaRate: number;
}

/** Raw shape returned by GET /api/public/offers — server-derived imageUrl. */
interface ApiOffer {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  badge: string | null;
  validFrom: string | null;
  validTo: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  /** Populated when the offer targets a specific room type; null otherwise. */
  roomType: { id: string; name: string } | null;
}

export const publicPortalApi = {
  /**
   * GET /api/public/hotel-info
   * Maps backend field names → frontend HotelInfo convention (Pitfall #8):
   *   backend.name    → HotelInfo.hotelName
   *   backend.address → HotelInfo.hotelAddress
   */
  getHotelInfo: async (): Promise<HotelInfo> => {
    const { data } = await api.get<ApiHotelInfo>('/public/hotel-info');
    return {
      hotelName: data.name,
      hotelAddress: data.address,
      tagline: data.tagline,
      description: data.description,
      phone: data.phone || undefined,
      rating: data.rating,
      reviewCount: data.reviewCount,
      tags: data.tags ?? [],
      displayPricesWithIva: data.displayPricesWithIva,
      ivaRate: data.ivaRate,
    };
  },

  /**
   * GET /api/public/room-types
   * Returns RoomTypeCard[] sorted by basePrice ASC (server-side).
   * badge is computed server-side: first → "Más económica", second → "Mejor valor".
   */
  getRoomTypes: (): Promise<RoomTypeCard[]> =>
    api.get<RoomTypeCard[]>('/public/room-types').then((r) => r.data),

  /**
   * GET /api/public/hotel-photos
   * Returns Photo[] sorted by displayOrder ASC (server-side).
   */
  getHotelPhotos: (): Promise<Photo[]> =>
    api.get<Photo[]>('/public/hotel-photos').then((r) => r.data),

  /**
   * GET /api/public/reviews?page&limit
   * Returns paginated published reviews with server-side averageRating.
   * Cache-Control: public, max-age=60 (set by backend — CDN-safe).
   */
  fetchPublicReviews: (page = 1, limit = 10): Promise<PublicReviewsResponse> =>
    api
      .get<PublicReviewsResponse>('/public/reviews', { params: { page, limit } })
      .then((r) => r.data),

  /**
   * 2026-05-28 — GET /api/public/offers
   * Returns only active offers within their date range, ordered by displayOrder.
   * The homepage section hides itself when this returns an empty array.
   */
  getOffers: (): Promise<PublicOffer[]> =>
    api.get<ApiOffer[]>('/public/offers').then((r) => r.data),
};
