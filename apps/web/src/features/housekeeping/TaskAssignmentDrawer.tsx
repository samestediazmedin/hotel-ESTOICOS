import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BoardRoom } from './housekeeping.api';
import { housekeepingApi } from './housekeeping.api';
import { PRIORITY_LABELS } from './cleaning-transitions';
import { api } from '@/lib/api';

const schema = z.object({
  assignedToId: z.string().uuid().nullable().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

interface StaffUser {
  id: string;
  name: string;
  role: string;
}

interface TaskAssignmentDrawerProps {
  room: BoardRoom;
  onClose: () => void;
}

/**
 * TaskAssignmentDrawer — inline fixed-panel drawer for MANAGER/ADMIN (HK-03)
 *
 * Pattern: `fixed right-0 top-0 h-full` — NOT shadcn Sheet.
 * Consistent with RoomDrawer (Phase 02-01), CheckInDrawer (Phase 04-01).
 *
 * Fetches HOUSEKEEPING staff from /api/users?role=HOUSEKEEPING for assignee dropdown.
 * Priority defaults to MEDIUM (backend default).
 * On success: invalidates housekeeping rooms + tasks queries.
 */
export function TaskAssignmentDrawer({ room, onClose }: TaskAssignmentDrawerProps) {
  const queryClient = useQueryClient();

  const { data: staffData } = useQuery({
    queryKey: ['users', 'housekeeping'],
    queryFn: () =>
      api
        .get<{ users: StaffUser[] }>('/users', { params: { role: 'HOUSEKEEPING' } })
        .then((r) => r.data),
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: 'MEDIUM',
      assignedToId: null,
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      housekeepingApi.createTask({
        roomId: room.id,
        assignedToId: values.assignedToId ?? null,
        priority: values.priority,
        notes: values.notes,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['housekeeping', 'rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['housekeeping', 'tasks'] });
      onClose();
    },
  });

  const errorMessage = (() => {
    if (!mutation.isError) return null;
    const axiosError = mutation.error as { response?: { data?: { message?: string } } };
    return axiosError?.response?.data?.message ?? 'Error al crear la tarea.';
  })();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        data-testid="task-assignment-backdrop"
      />

      {/* Inline fixed-panel drawer */}
      <div
        className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-xl z-50 p-6 overflow-y-auto"
        data-testid="task-assignment-drawer"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-ink-1">
            Asignar tarea — Hab. {room.number}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink-2 text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="space-y-5"
        >
          {/* Assignee select */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Asignar a
            </label>
            <Controller
              name="assignedToId"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? null : e.target.value)
                  }
                  className="w-full border border-warm-line rounded-md p-2 text-sm text-ink-1"
                >
                  <option value="">Sin asignar</option>
                  {staffData?.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.assignedToId && (
              <p className="text-xs text-red-600 mt-1">
                {errors.assignedToId.message}
              </p>
            )}
          </div>

          {/* Priority radio buttons */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-2">
              Prioridad
            </label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <div className="flex gap-2">
                  {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => field.onChange(p)}
                      className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                        field.value === p
                          ? p === 'HIGH'
                            ? 'bg-red-500 text-white border-red-500'
                            : p === 'MEDIUM'
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-white text-ink-2 border-warm-line hover:border-text-brand'
                      }`}
                      data-testid={`priority-${p}`}
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Notes textarea */}
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">
              Notas
            </label>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  className="w-full border border-warm-line rounded-md p-2 text-sm h-24 resize-none"
                  placeholder="Instrucciones adicionales…"
                />
              )}
            />
            {errors.notes && (
              <p className="text-xs text-red-600 mt-1">{errors.notes.message}</p>
            )}
          </div>

          {/* Inline error */}
          {errorMessage && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md p-2">
              {errorMessage}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="px-4 py-2 bg-text-brand text-white rounded-md text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              Asignar tarea
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-ink-3 underline hover:no-underline text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
