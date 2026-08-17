/**
 * OfferResponseDto — uniform shape returned by both the public and admin
 * endpoints. The public endpoint returns a subset (active + in-range).
 * `imageUrl` is derived at read time from R2_PUBLIC_URL + imageKey.
 *
 * `validFrom` and `validTo` are serialized as YYYY-MM-DD strings (no time)
 * to match the request DTO format.
 *
 * `roomType` — null when the offer is hotel-wide; populated with { id, name }
 * when the offer targets a specific room type.
 */
export interface OfferResponseDto {
  id: string;
  title: string;
  description: string | null;
  imageKey: string;
  imageUrl: string;
  badge: string | null;
  validFrom: string | null;
  validTo: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Populated room type when the offer targets a specific type; null otherwise. */
  roomType: { id: string; name: string } | null;
}
