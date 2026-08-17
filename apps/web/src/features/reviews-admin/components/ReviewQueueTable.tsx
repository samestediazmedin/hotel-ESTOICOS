import { Star } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminReview } from '../reviews-admin.api';
import { ModerationButtons } from './ModerationButtons';

interface ReviewQueueTableProps {
  reviews: AdminReview[];
  showActions?: boolean;
  emptyMessage: string;
}

/**
 * ReviewQueueTable — table-based layout for the moderation queue.
 *
 * showActions: true for the "Pendientes" tab only — hides action column
 * for published/rejected tabs where moderation is already done.
 *
 * Token utilities only — bg-warm-cream, text-ink-3, fill-mustard.
 */
export function ReviewQueueTable({
  reviews,
  showActions,
  emptyMessage,
}: ReviewQueueTableProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-md bg-warm-cream p-6 text-center text-ink-3 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Calif.</TableHead>
          <TableHead>Comentario</TableHead>
          <TableHead>Huésped</TableHead>
          <TableHead>Estadía</TableHead>
          <TableHead>Recibida</TableHead>
          {showActions && <TableHead>Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {reviews.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-mustard text-mustard" aria-hidden />
                <span className="font-mono text-sm">{r.rating}</span>
              </div>
            </TableCell>
            <TableCell className="max-w-sm">
              <p className="text-sm text-ink-2 line-clamp-3">{r.comment}</p>
            </TableCell>
            <TableCell className="text-sm">{r.guestName}</TableCell>
            <TableCell className="text-sm text-ink-3 whitespace-nowrap">
              {new Date(r.stayDate).toLocaleDateString('es-CO')}
            </TableCell>
            <TableCell className="text-sm text-ink-3 whitespace-nowrap">
              {new Date(r.createdAt).toLocaleDateString('es-CO')}
            </TableCell>
            {showActions && (
              <TableCell>
                <ModerationButtons reviewId={r.id} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
