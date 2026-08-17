/**
 * venue-response.dto.ts — Public-facing DTOs for BogotaVenue read operations.
 *
 * Key invariant: VenueResponseDto.mapsUrl is typed as `string` (NOT nullable).
 * When the admin-entered mapsUrl is null, toVenueResponseDto() computes a fallback
 * Google Maps "Directions" deep link from the venue's lat/lng coordinates.
 *
 * This guarantees the public "Cómo llegar" button always has a working URL (CON-05 / W1).
 * Because lat/lng are NOT NULL at the DB level (W4), the fallback is always safe.
 */

import { VenueType } from '../../../generated/prisma/client';
import { haversineKm } from '../haversine';

export interface ConciergeEventDto {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date | null;
  description: string | null;
  ticketUrl: string | null;
}

export interface VenueResponseDto {
  id: string;
  name: string;
  type: VenueType;
  rating: number | null;
  distanceKm: number;
  address: string | null;
  phone: string | null;
  photoUrl: string | null;
  /** Always non-null — falls back to Google Maps deep link when admin value is absent. */
  mapsUrl: string;
  reservationUrl: string | null;
  description: string | null;
}

export interface VenueDetailResponseDto extends VenueResponseDto {
  events: ConciergeEventDto[];
}

/**
 * toVenueResponseDto — map a BogotaVenue DB row to the public VenueResponseDto.
 *
 * mapsUrl fallback (W1 fix, CON-05):
 *   venue.mapsUrl           → use admin-configured deep link if present
 *   venue.mapsUrl === null  → compute Google Maps Directions URL from lat/lng
 *
 * The `??` operator ensures `mapsUrl` is always a non-null string in the output,
 * matching the `string` (not `string | null`) type on VenueResponseDto.mapsUrl.
 */
export function toVenueResponseDto(
  venue: {
    id: string;
    name: string;
    type: VenueType;
    rating: { toString(): string } | null;
    address: string | null;
    phone: string | null;
    lat: { toString(): string };
    lng: { toString(): string };
    photoUrl: string | null;
    mapsUrl: string | null;
    reservationUrl: string | null;
    description: string | null;
  },
  hotelLat: number,
  hotelLng: number,
): VenueResponseDto {
  const venueLat = Number(venue.lat);
  const venueLng = Number(venue.lng);

  return {
    id: venue.id,
    name: venue.name,
    type: venue.type,
    rating: venue.rating !== null ? Number(venue.rating) : null,
    distanceKm: haversineKm(hotelLat, hotelLng, venueLat, venueLng),
    address: venue.address,
    phone: venue.phone,
    photoUrl: venue.photoUrl,
    // CON-05 "Cómo llegar" fallback: admin URL when set, computed Google Maps deep link otherwise.
    // lat/lng are NOT NULL (W4 constraint) so the fallback is always safe — no null guard needed.
    mapsUrl:
      venue.mapsUrl ??
      `https://www.google.com/maps/dir/?api=1&destination=${venueLat},${venueLng}`,
    reservationUrl: venue.reservationUrl,
    description: venue.description,
  };
}
