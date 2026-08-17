import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, CalendarRange } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RoomTypeDrawer } from './RoomTypeDrawer';
import { RoomTypePhotosManager } from './components/RoomTypePhotosManager';

interface RoomType {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  maxOccupancy: number;
  amenities: string[];
  isActive: boolean;
}

const COP_FORMATTER = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/**
 * RoomTypesPage — manages room type catalog
 *
 * Route: /room-types
 * Access: ADMIN, MANAGER (create/edit), RECEPTION (read-only view)
 *
 * 2026-05-28 — Per-type photo manager added. The "Fotos" action opens a
 * slide-over that uploads to /api/inventory/room-types/:id/photos and
 * powers the public homepage gallery.
 */
export function RoomTypesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<RoomType | null>(null);
  const [photosTarget, setPhotosTarget] = useState<RoomType | null>(null);

  const { data: roomTypes = [], isLoading } = useQuery<RoomType[]>({
    queryKey: ['room-types'],
    queryFn: () =>
      api.get<RoomType[]>('/inventory/room-types').then((r) => r.data),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/inventory/room-types/${id}/deactivate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['room-types'] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/inventory/room-types/${id}/activate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['room-types'] });
    },
  });

  function openCreate() {
    setSelectedType(null);
    setDrawerOpen(true);
  }

  function openEdit(type: RoomType) {
    setSelectedType(type);
    setDrawerOpen(true);
  }

  function handleSuccess() {
    void queryClient.invalidateQueries({ queryKey: ['room-types'] });
    setDrawerOpen(false);
    setSelectedType(null);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-ink-1 text-2xl font-semibold">
            Tipos de habitación
          </h1>
          <p className="text-ink-3 text-sm mt-1">
            Gestión del catálogo de tipos de habitación
          </p>
        </div>
        <Button onClick={openCreate}>Nuevo tipo</Button>
      </div>

      {/* Table */}
      <div className="bg-warm-white rounded-lg border border-warm-line overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-ink-3 text-sm">
            Cargando tipos de habitación...
          </div>
        ) : roomTypes.length === 0 ? (
          <div className="p-8 text-center text-ink-3 text-sm">
            No hay tipos de habitación registrados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-line bg-warm-cream">
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Precio base
                </th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Máx. ocupantes
                </th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Amenidades
                </th>
                <th className="text-left px-4 py-3 text-ink-2 font-medium">
                  Estado
                </th>
                <th className="text-right px-4 py-3 text-ink-2 font-medium">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((type) => (
                <tr
                  key={type.id}
                  className="border-b border-warm-line hover:bg-warm-cream/50 cursor-pointer transition-colors"
                  onClick={() => openEdit(type)}
                >
                  <td className="px-4 py-3 text-ink-1 font-medium">
                    {type.name}
                  </td>
                  <td className="px-4 py-3 text-ink-1">
                    {COP_FORMATTER.format(type.basePrice)}
                  </td>
                  <td className="px-4 py-3 text-ink-1">
                    {type.maxOccupancy} personas
                  </td>
                  <td className="px-4 py-3 text-ink-3">
                    {type.amenities.length} amenidades
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={type.isActive ? 'available' : 'default'}
                    >
                      {type.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setPhotosTarget(type)}
                        className="inline-flex items-center gap-1 text-xs text-terracotta hover:underline"
                        title="Gestionar fotos del tipo"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Fotos
                      </button>
                      <button
                        onClick={() =>
                          navigate(`/pricing/seasons?roomTypeId=${type.id}`)
                        }
                        className="inline-flex items-center gap-1 text-xs text-terracotta hover:underline"
                        title="Gestionar temporadas del tipo"
                        data-testid={`seasons-btn-${type.id}`}
                      >
                        <CalendarRange className="w-3.5 h-3.5" />
                        Temporadas
                      </button>
                      <button
                        onClick={() => openEdit(type)}
                        className="text-xs text-terracotta hover:underline"
                      >
                        Editar
                      </button>
                      {type.isActive ? (
                        <button
                          onClick={() => deactivateMutation.mutate(type.id)}
                          disabled={deactivateMutation.isPending}
                          className="text-xs text-terracotta hover:text-terracotta-deep hover:underline disabled:opacity-50"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => activateMutation.mutate(type.id)}
                          disabled={activateMutation.isPending}
                          className="text-xs text-ink-3 hover:underline disabled:opacity-50"
                        >
                          Activar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit/Create drawer */}
      <RoomTypeDrawer
        isOpen={drawerOpen}
        roomType={selectedType}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedType(null);
        }}
        onSuccess={handleSuccess}
      />

      {/* Photos manager — conditionally mounted */}
      {photosTarget && (
        <RoomTypePhotosManager
          roomTypeId={photosTarget.id}
          roomTypeName={photosTarget.name}
          onClose={() => setPhotosTarget(null)}
        />
      )}
    </div>
  );
}
