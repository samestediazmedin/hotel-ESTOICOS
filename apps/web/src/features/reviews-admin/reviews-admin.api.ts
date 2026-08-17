import { api } from '@/lib/api';

export interface AdminReview {
  id: string;
  guestName: string;
  rating: number;
  comment: string;
  stayDate: string;
  reservationId: string | null;
  moderated: boolean;
  publishedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
}

export interface AdminReviewsResponse {
  pending: AdminReview[];
  published: AdminReview[];
  rejected: AdminReview[];
}

/**
 * fetchAdminReviews — GET /api/reviews
 *
 * Uses the authenticated `api` axios instance (JWT auto-attached via interceptor).
 * Returns reviews grouped in 3 buckets: pending, published, rejected.
 * Consumed by useAdminReviews hook.
 */
export async function fetchAdminReviews(): Promise<AdminReviewsResponse> {
  const res = await api.get<AdminReviewsResponse>('/reviews');
  return res.data;
}

/**
 * moderateReview — PATCH /api/reviews/:id/moderate
 *
 * action: 'approve' → sets moderated=true + publishedAt=now
 * action: 'reject'  → sets rejectedAt=now (soft-delete from pending)
 */
export async function moderateReview(
  id: string,
  action: 'approve' | 'reject',
): Promise<AdminReview> {
  const res = await api.patch<AdminReview>(`/reviews/${id}/moderate`, { action });
  return res.data;
}
