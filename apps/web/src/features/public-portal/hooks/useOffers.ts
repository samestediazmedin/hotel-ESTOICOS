import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { publicPortalApi } from '../public-portal.api';
import type { PublicOffer } from '../types';

/**
 * 2026-05-28 — useOffers
 *
 * TanStack Query against GET /api/public/offers. Returns the list of currently
 * active offers (server filters by isActive + date range). An empty array is
 * the expected "no offers" signal — the section hides itself when length===0.
 *
 * staleTime: 5 min (offers are admin-managed and slow to change). The hero
 * gallery + room types use 60s — offers can be longer since the cost of
 * stale UI is just a slightly older promo.
 */
export function useOffers(): UseQueryResult<PublicOffer[], Error> {
  return useQuery({
    queryKey: ['public', 'offers'],
    queryFn: publicPortalApi.getOffers,
    staleTime: 5 * 60_000,
    placeholderData: [],
    retry: 1,
  });
}
