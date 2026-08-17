import { useMutation } from '@tanstack/react-query';
import { submitReview, type SubmitReviewBody, type SubmitReviewResponse } from '../review-submit.api';

/**
 * Mutation for POST /api/public/reviews.
 *
 * No cache invalidation on success — the public reviews list (/api/public/reviews)
 * is cached on the CDN for 60s anyway. The page transitions to a "submitted" success
 * state, so there's no visible stale data to fix.
 *
 * Error handling is left to the caller (ReviewSubmitPage) which maps
 * HTTP status codes to user-facing messages.
 */
export function useSubmitReview() {
  return useMutation<SubmitReviewResponse, Error, SubmitReviewBody>({
    mutationFn: (body: SubmitReviewBody) => submitReview(body),
  });
}
