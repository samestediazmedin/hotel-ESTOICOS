import { useQuery } from '@tanstack/react-query';
import { validateReviewToken, type ValidateTokenResponse } from '../review-submit.api';

/**
 * Validates a review submission token against the backend.
 *
 * Called on mount by ReviewSubmitPage to:
 *   1. Verify the token is valid and not expired
 *   2. Retrieve guestName + stayDate for form prefill
 *   3. Detect already-submitted state (alreadySubmitted: true)
 *
 * retry: false — auth errors are deterministic (invalid/expired/used tokens
 * won't suddenly become valid on retry).
 *
 * enabled: only fires when token is truthy — avoids a spurious request
 * when the URL has no ?token param.
 */
export function useReviewToken(token: string | null) {
  return useQuery<ValidateTokenResponse, Error>({
    queryKey: ['review-submit', 'validate-token', token],
    queryFn: () => validateReviewToken(token!),
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min — token validity doesn't change mid-session
  });
}
