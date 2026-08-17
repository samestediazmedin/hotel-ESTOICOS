import { useState } from 'react';
import { useAdminReviews } from './hooks/useAdminReviews';
import { ReviewQueueTable } from './components/ReviewQueueTable';

type Tab = 'pending' | 'published' | 'rejected';

/**
 * ReviewsModeratorPage — /reviews (REV-04, REV-06)
 *
 * Accessible to ANY authenticated staff role (no inline role gate).
 * The backend GET /api/reviews + PATCH /api/reviews/:id/moderate enforce
 * auth via JwtAuthGuard + RolesGuard (empty @Roles() = any staff).
 *
 * Three tabs:
 *   Pendientes  — reviews awaiting moderation (showActions=true)
 *   Publicadas  — approved reviews visible on the portal
 *   Rechazadas  — soft-deleted reviews
 */
export default function ReviewsModeratorPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const { data, isLoading, isError } = useAdminReviews();

  const pendingCount = data?.pending.length ?? 0;
  const publishedCount = data?.published.length ?? 0;
  const rejectedCount = data?.rejected.length ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display italic text-3xl text-ink-1">
          Moderación de reseñas
        </h1>
        <p className="text-sm text-ink-3 mt-1">
          Aprueba o rechaza las reseñas enviadas por los huéspedes. Las aprobadas
          aparecen en el portal de reservas.
        </p>
      </header>

      {/* Tab navigation */}
      <nav className="flex gap-1 border-b border-warm-line" aria-label="Categorías de reseñas">
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
          Pendientes ({pendingCount})
        </TabButton>
        <TabButton active={tab === 'published'} onClick={() => setTab('published')}>
          Publicadas ({publishedCount})
        </TabButton>
        <TabButton active={tab === 'rejected'} onClick={() => setTab('rejected')}>
          Rechazadas ({rejectedCount})
        </TabButton>
      </nav>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded bg-warm-cream animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-md border border-warm-line bg-warm-paper p-4 text-sm text-terracotta">
          No se pudieron cargar las reseñas. Intenta recargar la página.
        </div>
      )}

      {/* Tab content */}
      {data && tab === 'pending' && (
        <ReviewQueueTable
          reviews={data.pending}
          showActions
          emptyMessage="No hay reseñas pendientes de moderación."
        />
      )}
      {data && tab === 'published' && (
        <ReviewQueueTable
          reviews={data.published}
          emptyMessage="Aún no hay reseñas publicadas."
        />
      )}
      {data && tab === 'rejected' && (
        <ReviewQueueTable
          reviews={data.rejected}
          emptyMessage="No hay reseñas rechazadas."
        />
      )}
    </div>
  );
}

// ─── TabButton ────────────────────────────────────────────────────────────────

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'px-4 py-2 -mb-px border-b-2 border-terracotta text-terracotta font-medium text-sm transition-colors'
          : 'px-4 py-2 -mb-px border-b-2 border-transparent text-ink-3 hover:text-ink-2 text-sm transition-colors'
      }
    >
      {children}
    </button>
  );
}
