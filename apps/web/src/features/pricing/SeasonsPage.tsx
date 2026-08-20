import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SeasonDrawer, type Season, formatMultiplier } from './SeasonDrawer';
import { formatDisplayDate } from '@/lib/date';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomTypeOption {
  id: string;
  name: string;
  isActive: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * SeasonsPage — manages seasons for a room type.
 *
 * Route: /pricing/seasons?roomTypeId=<id>
 * Access: ADMIN, MANAGER (create/edit/delete), RECEPTION (read-only)
 *
 * When no roomTypeId is provided (e.g. clicked from sidebar), shows a
 * room-type selector that navigates to ?roomTypeId=<id> on selection.
 */
export function SeasonsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomTypeId = searchParams.get('roomTypeId') ?? '';
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);

  // Always load room types — needed for selector and for header name
  const { data: roomTypes = [] } = useQuery<RoomTypeOption[]>({
    queryKey: ['room-types'],
    queryFn: () =>
      api.get<RoomTypeOption[]>('/inventory/room-types').then((r) => r.data),
  });

  const selectedRoomType = roomTypes.find((rt) => rt.id === roomTypeId) ?? null;

  const { data: seasons = [], isLoading } = useQuery<Season[]>({
    queryKey: ['seasons', roomTypeId],
    queryFn: () =>
      api
        .get<Season[]>('/pricing/seasons', { params: { roomTypeId } })
        .then((r) => r.data),
    enabled: !!roomTypeId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/pricing/seasons/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['seasons', roomTypeId] });
      void queryClient.invalidateQueries({ queryKey: ['room-types'] });
    },
  });

  function openCreate() {
    setSelectedSeason(null);
    setDrawerOpen(true);
  }

  function openEdit(season: Season) {
    setSelectedSeason(season);
    setDrawerOpen(true);
  }

  function handleSuccess() {
    void queryClient.invalidateQueries({ queryKey: ['seasons', roomTypeId] });
    void queryClient.invalidateQueries({ queryKey: ['room-types'] });
    setDrawerOpen(false);
    setSelectedSeason(null);
  }

  // ── No roomTypeId → show room-type selector ──────────────────────────────
  if (!roomTypeId) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-ink-1 text-2xl font-semibold">Temporadas</h1>
          <p className="text-ink-3 text-sm mt-1">
            Seleccione un tipo de habitación para gestionar sus temporadas.
          </p>
        </div>

        <div
          className="bg-warm-white rounded-lg border border-warm-line overflow-hidden"
          data-testid="room-type-selector"
        >
          {roomTypes.length === 0 ? (
            <div className="p-8 text-center text-ink-3 text-sm">
              No hay tipos de habitación registrados.
            </div>
          ) : (
            <ul className="divide-y divide-warm-line">
              {roomTypes.map((rt) => (
                <li key={rt.id}>
                  <button type="button"
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-warm-cream/60 transition-colors text-left"
                    onClick={() =>
                      navigate(`/pricing/seasons?roomTypeId=${rt.id}`)
                    }
                    data-testid={`select-room-type-${rt.id}`}
                  >
                    <div>
                      <span className="text-ink-1 font-medium">{rt.name}</span>
                      {!rt.isActive && (
                        <span className="ml-2 text-xs text-ink-3">(inactivo)</span>
                      )}
                    </div>
                    <span className="text-xs text-brand-primary hover:underline">
                      Ver temporadas →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // ── roomTypeId present → show seasons table ──────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-ink-1 text-2xl font-semibold">
            {selectedRoomType
              ? `Temporadas de ${selectedRoomType.name}`
              : 'Temporadas'}
          </h1>
          <p className="text-ink-3 text-sm mt-1">
            Gestión de temporadas para el tipo de habitación seleccionado
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={() => navigate('/pricing/seasons')}
            className="text-sm text-ink-3 hover:text-ink-1 underline"
          >
            Cambiar tipo
          </button>
          <Button onClick={openCreate}>Nueva temporada</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-warm-white rounded-lg border border-warm-line overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ink-3 text-sm">
            Cargando temporadas...
          </div>
        ) : seasons.length === 0 ? (
          <div className="p-8 text-center text-ink-3 text-sm">
            No hay temporadas para este tipo de habitación. Cree la primera temporada.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-line bg-warm-cream">
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Fechas
                </th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Multiplicador
                </th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Mín. noches
                </th>
                <th className="text-right px-4 py-3 text-ink-2 font-medium">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((season) => {
                const { label, colorClass } = formatMultiplier(season.multiplier);
                return (
                  <tr
                    key={season.id}
                    className="border-b border-warm-line hover:bg-warm-cream/50 cursor-pointer transition-colors"
                    onClick={() => openEdit(season)}
                  >
                    <td className="px-4 py-3 text-ink-1 font-medium">
                      {season.name}
                    </td>
                    <td className="px-4 py-3 text-ink-1">
                      {formatDisplayDate(season.startDate)} —{' '}
                      {formatDisplayDate(season.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${colorClass}`}>
                        {label}
                      </span>
                      <span className="text-ink-3 ml-1 text-xs">
                        (×{season.multiplier})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-1">
                      {season.minNights === 1
                        ? 'Sin mínimo'
                        : `${season.minNights} noches`}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button type="button"
                          onClick={() => openEdit(season)}
                          className="text-xs text-brand-primary hover:underline"
                        >
                          Editar
                        </button>
                        <button type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Eliminar la temporada "${season.name}"?`,
                              )
                            ) {
                              deleteMutation.mutate(season.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="text-xs text-status-in-progress hover:underline disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer */}
      <SeasonDrawer
        isOpen={drawerOpen}
        season={selectedSeason}
        roomTypeId={roomTypeId}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedSeason(null);
        }}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
