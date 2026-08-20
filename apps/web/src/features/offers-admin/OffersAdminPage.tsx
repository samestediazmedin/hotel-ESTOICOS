import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/features/auth/auth.store';
import { useAdminOffers, useDeleteOffer } from './hooks/useOffers';
import { OfferFormDrawer } from './components/OfferFormDrawer';
import type { AdminOffer } from './offers-admin.api';

/**
 * OffersAdminPage — /offers
 *
 * ADMIN-only management page for the homepage "Ofertas" section.
 * Lists every offer (active + inactive + out of date range) so the admin
 * can pause/resume them. The public homepage shows only the ones that
 * pass the date + active filters.
 *
 * Role gate is inline (Pattern 5) for defense-in-depth UX — the backend
 * enforces ADMIN at every route via JwtAuthGuard + RolesGuard.
 */
export function OffersAdminPage() {
  const role = useAuthStore((s) => s.user?.role ?? '');
  const { data: offers, isLoading, isError, refetch } = useAdminOffers();
  const { mutate: deleteOffer, isPending: isDeleting } = useDeleteOffer();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminOffer | null>(null);

  if (role !== 'ADMIN') {
    return (
      <div className="hos max-w-2xl mx-auto p-8">
        <div className="rounded-lg border border-warm-line bg-warm-paper p-6">
          <h1 className="font-display italic text-2xl text-ink-1 mb-2">
            Acceso restringido
          </h1>
          <p className="text-sm text-ink-3">
            Esta sección está disponible únicamente para administradores.
          </p>
        </div>
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (offer: AdminOffer) => {
    setEditing(offer);
    setDrawerOpen(true);
  };
  const onDelete = (offer: AdminOffer) => {
    const ok = window.confirm(
      `¿Eliminar la oferta "${offer.title}"? Esta acción no se puede deshacer.`,
    );
    if (ok) deleteOffer(offer.id);
  };

  return (
    <div className="hos max-w-6xl mx-auto p-6 lg:p-8">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display italic text-3xl text-ink-1">Ofertas</h1>
          <p className="text-sm text-ink-3 mt-1">
            Promociones publicadas en el homepage del hotel. Aparecen únicamente las que
            están activas y dentro de su rango de fechas.
          </p>
        </div>
        <button type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-terracotta text-warm-white text-sm font-medium px-4 py-2 hover:bg-terracotta-deep transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva oferta
        </button>
      </header>

      {isLoading && (
        <div className="rounded-lg border border-warm-line bg-warm-paper p-6 animate-pulse">
          <div className="h-4 bg-warm-cream rounded w-1/3 mb-3" />
          <div className="h-9 bg-warm-cream rounded mb-4" />
          <div className="h-4 bg-warm-cream rounded w-1/4 mb-3" />
          <div className="h-9 bg-warm-cream rounded" />
        </div>
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 text-terracotta px-4 py-3 text-sm flex items-center justify-between"
        >
          <span>No se pudieron cargar las ofertas.</span>
          <button type="button"
            onClick={() => refetch()}
            className="underline hover:no-underline ml-4 shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !isError && offers && offers.length === 0 && (
        <div className="rounded-lg border border-warm-line bg-warm-paper p-10 text-center">
          <h2 className="font-display text-xl text-ink-1 mb-2">Aún no hay ofertas</h2>
          <p className="text-sm text-ink-3 mb-4">
            Crea la primera promoción para que aparezca en el homepage del hotel.
          </p>
          <button type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-terracotta text-warm-white text-sm font-medium px-4 py-2 hover:bg-terracotta-deep transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva oferta
          </button>
        </div>
      )}

      {!isLoading && !isError && offers && offers.length > 0 && (
        <div className="rounded-lg border border-warm-line bg-warm-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-warm-cream/60 text-ink-3 uppercase text-xs tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Imagen</th>
                <th className="text-left px-4 py-3">Título</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Etiqueta</th>
                <th className="text-left px-4 py-3">Vigencia</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-line">
              {offers.map((offer) => (
                <tr key={offer.id} className="hover:bg-warm-cream/30">
                  <td className="px-4 py-3">
                    <img
                      src={offer.imageUrl}
                      alt={offer.title}
                      className="w-16 h-12 object-cover rounded-md border border-warm-line"
                      loading="lazy"
                    />
                  </td>
                  <td className="px-4 py-3 text-ink-1 font-medium">{offer.title}</td>
                  <td className="px-4 py-3">
                    {offer.roomType ? (
                      <span className="inline-flex items-center rounded-full bg-warm-cream border border-warm-line text-ink-2 text-xs font-medium px-2 py-0.5 whitespace-nowrap">
                        {offer.roomType.name}
                      </span>
                    ) : (
                      <span className="text-ink-4 text-xs">General</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-2">
                    {offer.badge ? (
                      <span className="inline-flex items-center rounded-full bg-terracotta/10 text-terracotta-deep text-xs font-medium px-2 py-0.5">
                        {offer.badge}
                      </span>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-3 text-xs whitespace-nowrap">
                    {formatRange(offer.validFrom, offer.validTo)}
                  </td>
                  <td className="px-4 py-3">
                    {offer.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5">
                        Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-ink-4/10 text-ink-3 text-xs font-medium px-2 py-0.5">
                        Pausada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button"
                        onClick={() => openEdit(offer)}
                        title="Editar"
                        className="p-2 rounded-md hover:bg-warm-cream text-ink-2 hover:text-ink-1 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button"
                        onClick={() => onDelete(offer)}
                        disabled={isDeleting}
                        title="Eliminar"
                        className="p-2 rounded-md hover:bg-terracotta/10 text-ink-3 hover:text-terracotta transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {drawerOpen && (
        <OfferFormDrawer
          initial={editing}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}

function formatRange(from: string | null, to: string | null): string {
  if (!from && !to) return 'Permanente';
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00.000Z').toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    });
  if (from && to) return `${fmt(from)} → ${fmt(to)}`;
  if (from) return `Desde ${fmt(from)}`;
  return `Hasta ${fmt(to as string)}`;
}
