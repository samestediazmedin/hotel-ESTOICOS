import { useQuery } from '@tanstack/react-query';
import { fetchAdminReviews, type AdminReviewsResponse } from '../reviews-admin.api';

/**
 * useAdminReviews — TanStack Query hook for GET /api/reviews (staff queue).
 *
 * Query key: ['admin', 'reviews']
 * staleTime: 30s — moderation is active; window-focus refetch is acceptable.
 *
 * Invalidated by useModerateReview.onSuccess after approve/reject.
 */
export function useAdminReviews() {
  return useQuery<AdminReviewsResponse, Error>({
    queryKey: ['admin', 'reviews'],
    queryFn: fetchAdminReviews,
    staleTime: 30_000,
  });
}
