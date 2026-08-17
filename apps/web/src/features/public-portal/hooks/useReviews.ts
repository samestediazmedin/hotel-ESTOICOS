import { useQuery, keepPreviousData, type UseQueryResult } from '@tanstack/react-query';
import { publicPortalApi } from '../public-portal.api';
import type { PublicReviewsResponse } from '../types';

export interface UseReviewsParams {
  page?: number;
  limit?: number;
}

/**
 * Phase 14 — useReviews
 *
 * Fetches paginated published reviews from GET /api/public/reviews.
 * `keepPreviousData` ensures smooth pagination — old page stays visible
 * while the next page loads instead of flashing an empty state.
 *
 * `staleTime: 60_000` mirrors the backend Cache-Control: public, max-age=60.
 *
 * Response shape: { reviews, total, averageRating, pages }
 * where averageRating and total are computed server-side from ALL published
 * reviews (not just the current page).
 */
export function useReviews({
  page = 1,
  limit = 10,
}: UseReviewsParams = {}): UseQueryResult<PublicReviewsResponse, Error> {
  return useQuery({
    queryKey: ['public', 'reviews', { page, limit }],
    queryFn: () => publicPortalApi.fetchPublicReviews(page, limit),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 2,
  });
}
