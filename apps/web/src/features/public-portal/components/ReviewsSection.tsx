import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReviews } from '../hooks/useReviews';
import { ReviewsSectionSkeleton } from './skeletons';
import type { ApiReview } from '../types';

/** Format ISO date string to Spanish month + year label ("Mayo 2026"). */
function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

/** Derive first letter initial from guestName. Falls back to '?' on empty. */
function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

interface ReviewCardProps {
  review: ApiReview;
}

function ReviewCard({ review }: ReviewCardProps) {
  const authorInitial = initial(review.guestName);
  const dateLabel = formatDate(review.publishedAt);

  return (
    <div className="rounded-2xl border border-warm-line bg-warm-white p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-warm-cream text-ink-1 font-display flex items-center justify-center shrink-0">
          {authorInitial}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-ink-1">{review.guestName}</span>
          <span className="text-xs text-ink-3">{dateLabel}</span>
        </div>
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          {Array.from({ length: review.rating }).map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 fill-mustard text-mustard" />
          ))}
        </div>
      </div>
      <p className="text-sm text-ink-2 leading-relaxed">{review.comment}</p>
    </div>
  );
}

/**
 * Phase 14 — ReviewsSection (REWRITTEN)
 *
 * Previously: accepted reviews/rating/reviewCount as props from hardcoded data.
 * Now: self-contained — fetches from GET /api/public/reviews via useReviews().
 *
 * Pagination strategy: "Ver más reseñas" button increments page by 1.
 * keepPreviousData on the hook keeps the previous page visible while loading.
 *
 * Empty state: terracotta-tint card when total === 0.
 * Skeleton: first-load only (isPending with no placeholderData returned yet).
 */
export function ReviewsSection() {
  const [page, setPage] = useState(1);
  const query = useReviews({ page, limit: 10 });

  // Show skeleton only on the very first load (no data available yet).
  // When keepPreviousData kicks in, query.data is defined even while fetching.
  if (query.isPending && !query.data) {
    return <ReviewsSectionSkeleton />;
  }

  const { reviews = [], total = 0, averageRating = 0, pages = 1 } = query.data ?? {};

  return (
    <section className="scroll-mt-20">
      {/* Header: aggregated rating + total count from server */}
      <div className="flex items-baseline gap-3 mb-6">
        <Star className="w-6 h-6 fill-mustard text-mustard" />
        <span className="font-display text-3xl lg:text-4xl text-ink-1">
          {averageRating.toFixed(2)}
        </span>
        <span className="text-base text-ink-2">· {total} reseñas</span>
      </div>

      {/* Empty state */}
      {total === 0 && (
        <div className="rounded-2xl bg-terracotta-tint border border-terracotta px-6 py-8 text-center">
          <p className="text-sm text-terracotta-deep font-medium">
            Aún no hay reseñas publicadas
          </p>
        </div>
      )}

      {/* Review cards: 1-col / 2-col md / 3-col lg */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* Pagination: show when more pages exist */}
      {page < pages && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={query.isFetching}
          >
            {query.isFetching ? 'Cargando…' : 'Ver más reseñas'}
          </Button>
        </div>
      )}
    </section>
  );
}
