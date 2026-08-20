import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BoardRoom } from './housekeeping.api';
import { housekeepingApi } from './housekeeping.api';
import { CLEANING_TRANSITIONS, type CleaningStatus } from './cleaning-transitions';
import { useAuthStore } from '@/features/auth/auth.store';

interface RoomStatusModalProps {
  room: BoardRoom;
  onClose: () => void;
}

const STATUS_LABELS: Record<CleaningStatus, string> = {
  DIRTY:       'Pendiente',
  IN_PROGRESS: 'En proceso',
  INSPECTION:  'Lista hoy',
  CLEAN:       'Verificada',
};

/**
 * RoomStatusModal — click-modal transition dialog (HK-02)
 *
 * Shows current cleaningStatus and renders ONLY the valid next-state buttons
 * derived from the frontend CLEANING_TRANSITIONS mirror.
 *
 * RBAC defense-in-depth (backend is authoritative):
 *   - RECEPTION: read-only (no buttons shown)
 *   - HOUSEKEEPING without assigned task: disabled buttons + helper text
 *   - ADMIN/MANAGER: all transitions available
 *
 * On success: invalidate query (the socket event will also fire — double-invalidate is harmless).
 * On 400/403: display inline error without closing.
 */
export function RoomStatusModal({ room, onClose }: RoomStatusModalProps) {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);

  const validNext = CLEANING_TRANSITIONS[room.cleaningStatus];
  const isReadOnly = role === 'RECEPTION';

  // HOUSEKEEPING: only transitions rooms with an assigned task belonging to them
  const hasAssignedTask =
    role === 'HOUSEKEEPING'
      ? !!(room.activeTask && room.activeTask.assignedToId === userId)
      : true; // ADMIN / MANAGER / RECEPTION bypass ownership

  const mutation = useMutation({
    mutationFn: (next: CleaningStatus) =>
      housekeepingApi.transitionRoom(room.id, next),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['housekeeping', 'rooms'] });
      onClose();
    },
  });

  const errorMessage = (() => {
    if (!mutation.isError) return null;
    const axiosError = mutation.error as { response?: { data?: { message?: string } } };
    const msg = axiosError?.response?.data?.message;
    if (axiosError?.response?.data) {
      // 403 specifically
      const status = (mutation.error as { response?: { status?: number } })?.response?.status;
      if (status === 403) return 'No tienes una tarea asignada para esta habitación.';
    }
    return msg ?? 'Error en la transición. Intente de nuevo.';
  })();

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClose();
      }}
      role="button"
      tabIndex={0}
      data-testid="room-status-modal-backdrop"
    >
      <div
        className="bg-white rounded-lg p-6 w-[420px] max-w-full mx-4 shadow-xl"
        data-testid="room-status-modal"
      >
        <h2 className="text-lg font-semibold text-ink-1 mb-1">
          Habitación {room.number}
        </h2>
        <p className="text-sm text-ink-3 mb-4">
          Estado actual:{' '}
          <strong className="text-ink-2">
            {STATUS_LABELS[room.cleaningStatus]}
          </strong>
        </p>

        {/* RECEPTION: read-only view */}
        {isReadOnly && (
          <p className="text-sm text-ink-3 italic">
            Solo lectura — el rol Recepción no puede cambiar el estado de limpieza.
          </p>
        )}

        {/* HOUSEKEEPING without assigned task */}
        {!isReadOnly && !hasAssignedTask && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded p-2">
            Sin tarea asignada — no puedes cambiar el estado de esta habitación.
          </p>
        )}

        {/* Valid next-state buttons */}
        {!isReadOnly && hasAssignedTask && (
          <div className="space-y-2">
            {validNext.map((next) => (
              <button
                key={next}
                onClick={() => mutation.mutate(next)}
                disabled={mutation.isPending}
                className="w-full px-3 py-2 bg-text-brand text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity text-sm font-medium"
                data-testid={`transition-${next}`}
              >
                Cambiar a: {STATUS_LABELS[next]}
              </button>
            ))}
          </div>
        )}

        {/* Inline error */}
        {errorMessage && (
          <p className="text-sm text-red-600 mt-3 bg-red-50 rounded p-2">
            {errorMessage}
          </p>
        )}

        <div className="mt-4 pt-3 border-t border-warm-line">
          <button
            onClick={onClose}
            className="text-sm text-ink-3 underline hover:no-underline"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
