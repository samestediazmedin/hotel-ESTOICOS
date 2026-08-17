import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useModerateReview } from '../hooks/useModerateReview';

interface ModerationButtonsProps {
  reviewId: string;
}

/**
 * ModerationButtons — approve + reject actions for a single review row.
 *
 * Approve: terracotta filled button (primary brand action)
 * Reject:  outline button (secondary, reversible)
 *
 * Both are disabled while the mutation is in-flight to prevent double-submit.
 * onSuccess cross-invalidation happens in useModerateReview.
 */
export function ModerationButtons({ reviewId }: ModerationButtonsProps) {
  const mutation = useModerateReview();

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="terracotta"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ id: reviewId, action: 'approve' })}
      >
        <Check className="h-4 w-4" aria-hidden />
        Aprobar
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ id: reviewId, action: 'reject' })}
      >
        <X className="h-4 w-4" aria-hidden />
        Rechazar
      </Button>
    </div>
  );
}
