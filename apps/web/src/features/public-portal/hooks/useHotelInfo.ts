import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { publicPortalApi } from '../public-portal.api';
import { HOTEL_INFO_FALLBACK } from '../data/hotel';
import type { HotelInfo } from '../types';

/**
 * Phase 12 — useHotelInfo (REWRITTEN)
 *
 * Previously: synchronous env-var read returning HotelInfo directly.
 * Now: TanStack Query against GET /api/public/hotel-info.
 *
 * `placeholderData: HOTEL_INFO_FALLBACK` guarantees `data` is ALWAYS defined —
 * consumers that destructure `data` never receive undefined.
 * Callers (HotelHomePage) must update to destructure UseQueryResult (12-04 territory).
 */
export function useHotelInfo(): UseQueryResult<HotelInfo, Error> {
  return useQuery({
    queryKey: ['public', 'hotel-info'],
    queryFn: publicPortalApi.getHotelInfo,
    staleTime: 60_000,
    placeholderData: HOTEL_INFO_FALLBACK,
    retry: 2,
  });
}
