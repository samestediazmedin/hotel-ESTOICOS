export interface HotelInfo {
  hotelName: string;
  hotelAddress: string;
  tagline: string;
  description: string;
  phone?: string;          // Phase 12 — new field from /api/public/hotel-info
  rating: number;
  reviewCount: number;
  tags: string[];
  // 2026-05-29 — IVA display setting.
  // displayPricesWithIva: when true, homepage shows base * (1 + ivaRate) with "IVA incluido" note.
  // ivaRate: plain number (e.g. 0.19 for 19%). Backend serializes Prisma Decimal as Number().
  displayPricesWithIva: boolean;
  ivaRate: number;
}

export interface RoomTypeCard {
  id: string;
  name: string;
  capacity: number;        // Phase 12 — was string; API returns integer (maxOccupancy)
  description: string;
  basePrice: number;       // Phase 12 — was pricePerNight; matches API field name
  photos: Photo[];         // Phase 12 — was thumbnail string; API returns Photo[]
  badge: string | null;    // Phase 12 — was string literal union; API returns string | null
  amenities?: string[];    // 2026-05-28 — exposed by API; used by RoomTypeDetailDrawer
}

export interface Review {
  id: string;
  authorName: string;
  authorInitial: string;
  date: string;
  rating: number;
  comment: string;
}

/** Phase 14 — raw shape returned by GET /api/public/reviews */
export interface ApiReview {
  id: string;
  guestName: string;
  rating: number;
  comment: string;
  stayDate: string;        // ISO date string "YYYY-MM-DD"
  publishedAt: string;     // ISO datetime string
}

/** Phase 14 — paginated response envelope from GET /api/public/reviews */
export interface PublicReviewsResponse {
  reviews: ApiReview[];
  total: number;
  averageRating: number;
  pages: number;
}

export interface Photo {
  url: string;
  alt: string;
  displayOrder?: number;   // Phase 12 — server returns this for hotel photos sorting
}

/**
 * 2026-05-28 — Offer card shape returned by GET /api/public/offers.
 * Backend computes `imageUrl` from R2_PUBLIC_URL + imageKey.
 * Validity dates are serialized as `YYYY-MM-DD` strings.
 *
 * `roomType` — null when hotel-wide; { id, name } when the offer targets a
 * specific room type. The booking flow preselects + locks the type selector.
 */
export interface PublicOffer {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  badge: string | null;
  validFrom: string | null;
  validTo: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  roomType: { id: string; name: string } | null;
}
