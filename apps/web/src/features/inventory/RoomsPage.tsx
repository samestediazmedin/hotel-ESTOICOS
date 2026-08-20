import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BedDouble } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import type { RoomStatus } from '@/components/ui/status-pill';
import { RoomDrawer } from './RoomDrawer';

export type PhysicalStatus = 'AVAILABLE' | 'OCCUPIED' | 'OUT_OF_SERVICE' | 'ON_HOLD';
export type CleaningStatus = 'DIRTY' | 'IN_PROGRESS' | 'INSPECTION' | 'CLEAN';

export interface Room {
  id: string;
  number: string;
  floor: number;
  roomTypeId: string;
  roomType: { id: string; name: string; basePrice: number };
  physicalStatus: PhysicalStatus;
  cleaningStatus: CleaningStatus;
  notes?: string | null;
  isActive: boolean;
  photoUrl?: string | null;
}

// ─── Status labels (kept for drawer + accessibility) ─────────────────────────

export const PHYSICAL_STATUS_LABELS: Record<PhysicalStatus, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  OUT_OF_SERVICE: 'Fuera de servicio',
  ON_HOLD: 'En espera',
};

export const CLEANING_STATUS_LABELS: Record<CleaningStatus, string> = {
  DIRTY: 'Sucia',
  IN_PROGRESS: 'En limpieza',
  INSPECTION: 'Inspección',
  CLEAN: 'Limpia',
};

// ─── Dual-status → single RoomStatus mapping ─────────────────────────────────
//
// The card shows ONE StatusPill. Drawer still shows both statuses separately
// via its own dropdowns. Mapping rules (priority order):
//  1. OUT_OF_SERVICE → maintenance
//  2. ON_HOLD        → blocked
//  3. OCCUPIED       → occupied
//  4. AVAILABLE + DIRTY | IN_PROGRESS → cleaning
//  5. AVAILABLE + CLEAN | INSPECTION  → available

function mapPhysicalToRoomStatus(
  physical: PhysicalStatus,
  cleaning: CleaningStatus,
): RoomStatus {
  if (physical === 'OUT_OF_SERVICE') return 'maintenance';
  if (physical === 'ON_HOLD') return 'blocked';
  if (physical === 'OCCUPIED') return 'occupied';
  // physical is AVAILABLE — defer to cleaning state
  if (cleaning === 'DIRTY' || cleaning === 'IN_PROGRESS') return 'cleaning';
  return 'available';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * RoomsPage — room inventory as responsive card grid (1/2/3/4 cols).
 *
 * Route: /rooms
 * physicalStatus and cleaningStatus are collapsed into a single StatusPill
 * per card via mapPhysicalToRoomStatus(). Both statuses remain editable
 * inside the RoomDrawer independently.
 */
export function RoomsPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: () => api.get<Room[]>('/inventory/rooms').then((r) => r.data),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/inventory/rooms/${id}/deactivate`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });

  function openCreate() {
    setSelectedRoom(null);
    setDrawerOpen(true);
  }

  function openDetail(room: Room) {
    setSelectedRoom(room);
    setDrawerOpen(true);
  }

  function handleSuccess() {
    void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    setDrawerOpen(false);
    setSelectedRoom(null);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display italic text-3xl text-ink-1">
            Habitaciones
          </h1>
          <p className="text-ink-3 text-sm mt-1">
            Inventario de habitaciones con estado físico y de limpieza independientes
          </p>
        </div>
        <Button variant="terracotta" onClick={openCreate}>
          Nueva habitación
        </Button>
      </div>

      {/* Grid / states */}
      {isLoading ? (
        <div className="bg-warm-paper border border-warm-line rounded-xl p-12 flex flex-col items-center gap-3">
          <p className="text-ink-3 text-sm">Cargando habitaciones...</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-warm-paper border border-warm-line rounded-xl p-12 flex flex-col items-center gap-3">
          <BedDouble className="w-12 h-12 text-mustard" aria-hidden />
          <p className="text-ink-2 text-sm">No hay habitaciones que mostrar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rooms.map((room) => (
            <button type="button"
              key={room.id}
              onClick={() => openDetail(room)}
              aria-label={`Habitación ${room.number}, ${room.roomType?.name ?? 'Sin tipo'}`}
              className="bg-warm-white border border-warm-line rounded-xl overflow-hidden text-left hover:border-warm-line-strong hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-terracotta"
            >
              {/* Photo placeholder / image */}
              <div className="aspect-video bg-warm-cream flex items-center justify-center">
                {room.photoUrl ? (
                  <img
                    src={room.photoUrl}
                    alt={`Habitación ${room.number}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-ink-4 font-mono text-sm">Sin foto</span>
                )}
              </div>

              {/* Card body */}
              <div className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xl text-ink-1 leading-none">
                      {room.number}
                    </p>
                    <p className="text-ink-2 text-sm mt-1 truncate">
                      {room.roomType?.name ?? 'Sin tipo'}
                    </p>
                  </div>
                  <StatusPill
                    status={mapPhysicalToRoomStatus(room.physicalStatus, room.cleaningStatus)}
                    className="shrink-0"
                  />
                </div>

                {room.floor != null && (
                  <p className="text-ink-3 text-xs">Piso {room.floor}</p>
                )}

                {/* Deactivate action — stops propagation so card click still opens drawer */}
                {room.isActive && (
                  <div className="mt-1 flex justify-end">
                    <button type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deactivateMutation.mutate(room.id);
                      }}
                      disabled={deactivateMutation.isPending}
                      className="text-xs text-ink-3 hover:text-terracotta transition-colors disabled:opacity-50"
                    >
                      Desactivar
                    </button>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Drawer */}
      <RoomDrawer
        isOpen={drawerOpen}
        room={selectedRoom}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedRoom(null);
        }}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
