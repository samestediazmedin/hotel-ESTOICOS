import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moderateReview } from '../reviews-admin.api';

/**
 * useModerateReview — useMutation wrapping PATCH /api/reviews/:id/moderate.
 *
 * Cross-cache invalidation pattern (REV-04):
 *   - ['admin', 'reviews']  → refreshes the staff moderation queue
 *   - ['public', 'reviews'] → refreshes the portal ReviewsSection
 *
 * Without the second invalidation the portal would only update after the
 * 60s Cache-Control TTL, leaving published reviews invisible to guests.
 */
export function useModerateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      moderateReview(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['public', 'reviews'] });
    },
  });
}
