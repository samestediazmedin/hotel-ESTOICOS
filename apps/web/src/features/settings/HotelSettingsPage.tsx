import { useAuthStore } from '@/features/auth/auth.store';
import { useAdminSystemConfig } from './hooks/useAdminSystemConfig';
import { HotelInfoForm } from './components/HotelInfoForm';
import { HotelGalleryManager } from './components/HotelGalleryManager';

/**
 * HotelSettingsPage — /settings/hotel (HSP-03)
 *
 * Admin-only page for editing hotel identity (name, address, tagline,
 * description, phone, tags). Gallery manager will be added by Plan 13-04
 * as a second section below this form.
 *
 * Role gate: INLINE (ProtectedRoute has no `roles` prop — confirmed in router.tsx).
 * Non-admin authenticated users see a 403 surface, NOT a redirect to /login.
 *
 * Security boundary: The backend PATCH /api/system-config enforces ADMIN role
 * via JwtAuthGuard + RolesGuard. This inline gate is defense-in-depth UX only.
 */
export function HotelSettingsPage() {
  const role = useAuthStore((s) => s.user?.role ?? '');
  const { data, isLoading, isError, error, refetch } = useAdminSystemConfig();

  // Inline role gate (Pattern 5 from RESEARCH.md)
  if (role !== 'ADMIN') {
    return (
      <div className="hos max-w-2xl mx-auto p-8">
        <div className="rounded-lg border border-warm-line bg-warm-paper p-6">
          <h1 className="font-display italic text-2xl text-ink-1 mb-2">
            Acceso restringido
          </h1>
          <p className="text-sm text-ink-3">
            Esta sección está disponible únicamente para administradores. Si
            necesitas acceso, consulta con un administrador del hotel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="hos max-w-6xl mx-auto p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="font-display italic text-3xl text-ink-1">
          Configuración del hotel
        </h1>
        <p className="text-sm text-ink-3 mt-1">
          Edita la identidad pública del hotel. Los cambios se reflejan en el
          portal en menos de un minuto.
        </p>
      </header>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="rounded-lg border border-warm-line bg-warm-paper p-6 animate-pulse">
          <div className="h-4 bg-warm-cream rounded w-1/3 mb-3" />
          <div className="h-9 bg-warm-cream rounded mb-4" />
          <div className="h-4 bg-warm-cream rounded w-1/4 mb-3" />
          <div className="h-9 bg-warm-cream rounded mb-4" />
          <div className="h-4 bg-warm-cream rounded w-1/5 mb-3" />
          <div className="h-9 bg-warm-cream rounded" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 text-terracotta px-4 py-3 text-sm flex items-center justify-between"
        >
          <span>
            No se pudo cargar la configuración.{' '}
            {error?.message ?? 'Intenta de nuevo.'}
          </span>
          <button type="button"
            onClick={() => refetch()}
            className="underline hover:no-underline ml-4 shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 2-column layout when data is available: form (left) + gallery (right) */}
      {data && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start">
          <div className="rounded-lg border border-warm-line bg-warm-white p-6">
            <HotelInfoForm initial={data} />
          </div>
          <div className="rounded-lg border border-warm-line bg-warm-white p-6">
            <HotelGalleryManager />
          </div>
        </div>
      )}
    </div>
  );
}
