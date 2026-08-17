/**
 * haversine.ts — Great-circle distance between two GPS points.
 *
 * Used by ConciergeRepository.searchVenues() to sort venues by distance from
 * the hotel and optionally filter by maxDistanceKm.
 *
 * Reads HOTEL_LAT / HOTEL_LNG from env (ConfigService) — the hotel's coordinates
 * are set by the operator, not hard-coded.
 *
 * Earth radius: 6371 km (mean radius per IUGG).
 * Precision: Decimal(9,6) → 0.11m at the equator — sufficient for haversine.
 */

/**
 * haversineKm — compute great-circle distance in kilometres.
 *
 * @param lat1 Hotel latitude (degrees)
 * @param lng1 Hotel longitude (degrees)
 * @param lat2 Venue latitude (degrees)
 * @param lng2 Venue longitude (degrees)
 * @returns Distance in kilometres (positive, rounded to 2 decimal places)
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}
