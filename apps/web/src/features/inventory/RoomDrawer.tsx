import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyTabPlaceholder } from '@/components/ui/empty-tab-placeholder';
import type { Room, PhysicalStatus, CleaningStatus } from './RoomsPage';

// ─── Tab system ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'detalles', label: 'Detalles' },
  { id: 'reservas', label: 'Reservas' },
  { id: 'limpieza', label: 'Limpieza' },
  { id: 'mantenimiento', label: 'Mantenimiento' },
  { id: 'historial', label: 'Historial' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Form schema ──────────────────────────────────────────────────────────────

const roomFormSchema = z.object({
  number: z.string().min(1, 'El número es requerido'),
  floor: z.number().int().min(1, 'Mínimo piso 1'),
  roomTypeId: z.string().min(1, 'Seleccione un tipo'),
  notes: z.string().optional(),
});

type RoomFormData = z.infer<typeof roomFormSchema>;

// ─── Status options ───────────────────────────────────────────────────────────

const PHYSICAL_STATUS_OPTIONS: { value: PhysicalStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'OCCUPIED', label: 'Ocupada' },
  { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
  { value: 'ON_HOLD', label: 'En espera' },
];

const CLEANING_STATUS_OPTIONS: { value: CleaningStatus; label: string }[] = [
  { value: 'DIRTY', label: 'Sucia' },
  { value: 'IN_PROGRESS', label: 'En limpieza' },
  { value: 'INSPECTION', label: 'Inspección' },
  { value: 'CLEAN', label: 'Limpia' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoomDrawerProps {
  isOpen: boolean;
  room: Room | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface RoomType {
  id: string;
  name: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * RoomDrawer — 5-tab room detail/create drawer.
 *
 * Width: max-w-[600px]
 * Tabs: Detalles (populated) | Reservas | Limpieza | Mantenimiento | Historial
 *
 * Status updates are submitted independently:
 *  - Physical status has its own "Actualizar" button
 *  - Cleaning status has its own "Actualizar" button
 *  - NEVER submits both in the same action unless user changed both
 */
export function RoomDrawer({ isOpen, room, onClose, onSuccess }: RoomDrawerProps) {
  const queryClient = useQueryClient();
  const isEdit = room !== null;
  const [activeTab, setActiveTab] = useState<TabId>('detalles');
  const [physicalStatusVal, setPhysicalStatusVal] = useState<PhysicalStatus>('AVAILABLE');
  const [cleaningStatusVal, setCleaningStatusVal] = useState<CleaningStatus>('CLEAN');
  const [statusError, setStatusError] = useState<string | null>(null);

  // Load room types for the select dropdown
  const { data: roomTypes = [] } = useQuery<RoomType[]>({
    queryKey: ['room-types'],
    queryFn: () => api.get<RoomType[]>('/inventory/room-types').then((r) => r.data),
    enabled: isOpen,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RoomFormData>({
    resolver: zodResolver(roomFormSchema),
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  // Intentional: all setState calls here reset derived UI state when `room` prop changes.
  useEffect(() => {
    if (room) {
      reset({
        number: room.number,
        floor: room.floor,
        roomTypeId: room.roomTypeId,
        notes: room.notes ?? '',
      });
      setPhysicalStatusVal(room.physicalStatus);
      setCleaningStatusVal(room.cleaningStatus);
    } else {
      reset({
        number: '',
        floor: undefined as unknown as number,
        roomTypeId: '',
        notes: '',
      });
      setPhysicalStatusVal('AVAILABLE');
      setCleaningStatusVal('CLEAN');
    }
    setActiveTab('detalles');
    setStatusError(null);
  }, [room, reset]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Room create/edit mutation ──────────────────────────────────────────────

  const onSubmit = async (data: RoomFormData) => {
    try {
      if (isEdit) {
        await api.patch(`/inventory/rooms/${room.id}`, {
          number: data.number,
          floor: data.floor,
          roomTypeId: data.roomTypeId,
          notes: data.notes || undefined,
        });
      } else {
        await api.post('/inventory/rooms', {
          number: data.number,
          floor: data.floor,
          roomTypeId: data.roomTypeId,
          notes: data.notes || undefined,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      reset();
      onSuccess();
    } catch (err) {
      console.error('Error saving room:', err);
    }
  };

  // ─── Physical status update (independent) ────────────────────────────────

  const physicalMutation = useMutation({
    mutationFn: (status: PhysicalStatus) =>
      api.patch(`/inventory/rooms/${room?.id}/status`, {
        physicalStatus: status,
      }),
    onSuccess: () => {
      setStatusError(null);
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Transición de estado no permitida';
      setStatusError(msg);
    },
  });

  // ─── Cleaning status update (independent) ────────────────────────────────

  const cleaningMutation = useMutation({
    mutationFn: (status: CleaningStatus) =>
      api.patch(`/inventory/rooms/${room?.id}/status`, {
        cleaningStatus: status,
      }),
    onSuccess: () => {
      setStatusError(null);
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error actualizando estado de limpieza';
      setStatusError(msg);
    },
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-1/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Habitación ${room.number}` : 'Nueva habitación'}
        className="fixed right-0 top-0 h-full w-full max-w-[600px] bg-warm-cream border-l border-warm-line shadow-lg z-50 flex flex-col"
      >
        {/* Header */}
        <div className="relative flex items-center justify-between p-6 border-b border-warm-line">
          <h2 className="text-ink-1 text-lg font-semibold">
            {isEdit ? `Habitación ${room.number}` : 'Nueva habitación'}
          </h2>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-md hover:bg-warm-paper flex items-center justify-center text-ink-2 hover:text-ink-1 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="border-b border-warm-line flex gap-1 px-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-3 text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-terracotta text-terracotta-deep font-medium'
                  : 'border-transparent text-ink-3 hover:text-ink-1'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Detalles ── */}
          {activeTab === 'detalles' && (
            <div className="flex flex-col gap-6">
              {/* Room form */}
              <form
                onSubmit={handleSubmit(onSubmit)}
                autoComplete="off"
                className="flex flex-col gap-4"
              >
                <div className="flex gap-4">
                  <div className="flex flex-col gap-1 flex-1">
                    <label
                      htmlFor="roomNumber"
                      className="text-sm font-medium text-ink-2"
                    >
                      Número de habitación
                    </label>
                    <Input
                      id="roomNumber"
                      type="text"
                      placeholder="101"
                      {...register('number')}
                    />
                    {errors.number && (
                      <p className="text-xs text-terracotta">
                        {errors.number.message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 w-28">
                    <label
                      htmlFor="roomFloor"
                      className="text-sm font-medium text-ink-2"
                    >
                      Piso
                    </label>
                    <Input
                      id="roomFloor"
                      type="number"
                      placeholder="1"
                      {...register('floor', { valueAsNumber: true })}
                    />
                    {errors.floor && (
                      <p className="text-xs text-terracotta">
                        {errors.floor.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="roomType"
                    className="text-sm font-medium text-ink-2"
                  >
                    Tipo de habitación
                  </label>
                  <select
                    id="roomType"
                    {...register('roomTypeId')}
                    className="flex h-9 w-full rounded-md border border-warm-line bg-warm-white px-3 py-1 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
                  >
                    <option value="">Seleccione un tipo...</option>
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name}
                      </option>
                    ))}
                  </select>
                  {errors.roomTypeId && (
                    <p className="text-xs text-terracotta">
                      {errors.roomTypeId.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="roomNotes"
                    className="text-sm font-medium text-ink-2"
                  >
                    Notas{' '}
                    <span className="text-ink-3 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    id="roomNotes"
                    rows={2}
                    placeholder="Habitación con vista al patio..."
                    {...register('notes')}
                    className="flex w-full rounded-md border border-warm-line bg-warm-white px-3 py-2 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="terracotta"
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? 'Guardando...'
                      : isEdit
                      ? 'Guardar cambios'
                      : 'Crear habitación'}
                  </Button>
                </div>
              </form>

              {/* Amenidades — shown in edit mode (bundle INT-04 chip pattern) */}
              {isEdit && room.roomType && (
                <>
                  <hr className="border-t border-warm-line my-4" />
                  <div className="flex flex-col gap-3">
                    <h3 className="text-ink-1 text-sm font-semibold">Amenidades</h3>
                    {/* Room type amenities chips — pattern: warm-paper bg + warm-line border */}
                    <div className="flex flex-wrap gap-2">
                      {/* Tipo de habitación chip */}
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-warm-paper border border-warm-line text-ink-2 text-sm">
                        {room.roomType.name}
                      </span>
                      {room.floor != null && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-warm-paper border border-warm-line text-ink-2 text-sm">
                          Piso {room.floor}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-3">
                      Amenidades detalladas disponibles en fases posteriores.
                    </p>
                  </div>
                </>
              )}

              {/* Status update section — only shown in edit mode */}
              {isEdit && (
                <>
                  <hr className="border-t border-warm-line my-4" />
                  <div className="flex flex-col gap-4">
                    <h3 className="text-ink-1 text-sm font-semibold">
                      Actualizar estados
                    </h3>

                    {statusError && (
                      <p className="text-xs text-terracotta bg-terracotta-tint border border-terracotta-soft rounded px-3 py-2">
                        {statusError}
                      </p>
                    )}

                    {/* Physical status — independent */}
                    <div className="flex items-end gap-3">
                      <div className="flex flex-col gap-1 flex-1">
                        <label
                          htmlFor="physicalStatus"
                          className="text-sm font-medium text-ink-2"
                        >
                          Estado físico
                        </label>
                        <select
                          id="physicalStatus"
                          value={physicalStatusVal}
                          onChange={(e) =>
                            setPhysicalStatusVal(e.target.value as PhysicalStatus)
                          }
                          className="flex h-9 w-full rounded-md border border-warm-line bg-warm-white px-3 py-1 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
                        >
                          {PHYSICAL_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => physicalMutation.mutate(physicalStatusVal)}
                        disabled={
                          physicalMutation.isPending ||
                          physicalStatusVal === room.physicalStatus
                        }
                        className="whitespace-nowrap"
                      >
                        {physicalMutation.isPending ? 'Actualizando...' : 'Actualizar'}
                      </Button>
                    </div>

                    {/* Cleaning status — independent */}
                    <div className="flex items-end gap-3">
                      <div className="flex flex-col gap-1 flex-1">
                        <label
                          htmlFor="cleaningStatus"
                          className="text-sm font-medium text-ink-2"
                        >
                          Estado de limpieza
                        </label>
                        <select
                          id="cleaningStatus"
                          value={cleaningStatusVal}
                          onChange={(e) =>
                            setCleaningStatusVal(e.target.value as CleaningStatus)
                          }
                          className="flex h-9 w-full rounded-md border border-warm-line bg-warm-white px-3 py-1 text-sm text-ink-1 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta"
                        >
                          {CLEANING_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => cleaningMutation.mutate(cleaningStatusVal)}
                        disabled={
                          cleaningMutation.isPending ||
                          cleaningStatusVal === room.cleaningStatus
                        }
                        className="whitespace-nowrap"
                      >
                        {cleaningMutation.isPending
                          ? 'Actualizando...'
                          : 'Actualizar'}
                      </Button>
                    </div>
                  </div>

                </>
              )}
            </div>
          )}

          {/* ── Reservas ── */}
          {activeTab === 'reservas' && (
            <EmptyTabPlaceholder message="Disponible en fase 3: Reservas" />
          )}

          {/* ── Limpieza ── */}
          {activeTab === 'limpieza' && (
            <EmptyTabPlaceholder message="Disponible en fase 5: Housekeeping" />
          )}

          {/* ── Mantenimiento ── */}
          {activeTab === 'mantenimiento' && (
            <EmptyTabPlaceholder message="Disponible en fases posteriores" />
          )}

          {/* ── Historial ── */}
          {activeTab === 'historial' && (
            <EmptyTabPlaceholder message="Disponible en fases posteriores" />
          )}
        </div>
      </div>
    </>
  );
}
