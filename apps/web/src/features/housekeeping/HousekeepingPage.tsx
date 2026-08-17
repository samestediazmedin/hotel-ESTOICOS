import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { housekeepingApi, type BoardRoom } from './housekeeping.api';
import { useHousekeepingSocket } from './useHousekeepingSocket';
import {
  CLEANING_TRANSITIONS,
  COLUMN_LABELS,
  PRIORITY_LABELS,
  type CleaningStatus,
} from './cleaning-transitions';
import { useAuthStore } from '@/features/auth/auth.store';
import { RoomStatusModal } from './RoomStatusModal';
import { TaskAssignmentDrawer } from './TaskAssignmentDrawer';

const COLUMNS: CleaningStatus[] = ['DIRTY', 'IN_PROGRESS', 'INSPECTION', 'CLEAN'];

/**
 * Top-border accent colors mapped to CSS variables.
 * Applied via inline style (borderTopColor) because Tailwind v4 utility
 * classes for `border-t-*` do not exist for custom token names.
 * Zero hex literals — all values resolve via CSS custom properties.
 */
const COLUMN_BORDER_COLORS: Record<CleaningStatus, string> = {
  DIRTY:       'var(--status-cleaning)',   // mustard — needs cleaning
  IN_PROGRESS: 'var(--status-occupied)',   // terracotta — actively cleaning
  INSPECTION:  'var(--status-reserved)',   // reserved-blue — awaiting verify
  CLEAN:       'var(--status-available)',  // olive-green — done
};

// ─── Priority badge ────────────────────────────────────────────────────────────

type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

const PRIORITY_BADGE_MAP: Record<Priority, { bg: string; label: string }> = {
  HIGH:   { bg: 'bg-terracotta', label: 'Alta' },
  MEDIUM: { bg: 'bg-mustard',    label: 'Media' },
  LOW:    { bg: 'bg-olive',      label: 'Baja' },
};

function PriorityBadge({ priority }: { priority: Priority }) {
  const { bg, label } = PRIORITY_BADGE_MAP[priority];
  return (
    <span className={`${bg} text-warm-white text-xs font-medium px-2 py-0.5 rounded-full`}>
      {label}
    </span>
  );
}

// ─── Assignee avatar ────────────────────────────────────────────────────────────

function AssigneeAvatar({ assignee }: { assignee: { name: string; initials?: string } }) {
  const initials =
    assignee.initials ??
    assignee.name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  return (
    <span
      className="w-7 h-7 rounded-full bg-terracotta-tint text-terracotta-deep font-mono text-xs flex items-center justify-center flex-shrink-0"
      title={assignee.name}
      aria-label={`Asignado a ${assignee.name}`}
    >
      {initials}
    </span>
  );
}

// ─── Suppress unused import warning — CLEANING_TRANSITIONS is used by modals ──
void CLEANING_TRANSITIONS;
void PRIORITY_LABELS;

/**
 * HousekeepingPage — 4-column kanban board (HK-01)
 *
 * Columns: Pendientes (DIRTY) · En proceso (IN_PROGRESS) · Listas hoy (INSPECTION) · Verificadas (CLEAN)
 * Real-time: useHousekeepingSocket drives invalidateQueries on room:statusUpdate events.
 * Click-modal: click a room card → RoomStatusModal with valid-next-state buttons (HK-02).
 * Task assignment: MANAGER/ADMIN only → TaskAssignmentDrawer (HK-03).
 * RECEPTION: read-only view (no transition buttons, no assign button).
 *
 * No drag-drop — deferred per RESEARCH §4.8.
 */
export function HousekeepingPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canAssign = role === 'ADMIN' || role === 'MANAGER';

  // Starts the real-time socket loop for this page's lifetime
  useHousekeepingSocket();

  const { data, isLoading, error } = useQuery({
    queryKey: ['housekeeping', 'rooms'],
    queryFn: housekeepingApi.getBoard,
    staleTime: 0, // P11 — never serve stale board on mount
  });

  const [selectedRoom, setSelectedRoom] = useState<BoardRoom | null>(null);
  const [assignRoom, setAssignRoom] = useState<BoardRoom | null>(null);

  if (isLoading) {
    return (
      <div className="p-6 text-ink-3 text-sm font-mono">Cargando tablero…</div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-terracotta text-sm">
        Error al cargar el tablero. Intente de nuevo.
      </div>
    );
  }

  const byStatus = COLUMNS.reduce<Record<CleaningStatus, BoardRoom[]>>(
    (acc, status) => {
      acc[status] = data?.rooms.filter((r) => r.cleaningStatus === status) ?? [];
      return acc;
    },
    { DIRTY: [], IN_PROGRESS: [], INSPECTION: [], CLEAN: [] },
  );

  return (
    <div className="p-6 bg-warm-paper min-h-full">
      {/* Page heading */}
      <h1 className="font-display italic text-3xl text-ink-1 mb-6">
        Housekeeping
      </h1>

      {/* 4-column kanban grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((status) => {
          const rooms = byStatus[status];
          return (
            <div
              key={status}
              data-testid={`column-${status}`}
              className="flex flex-col gap-0"
            >
              {/* Column header */}
              <div
                className="bg-warm-cream border border-warm-line rounded-t-xl px-4 py-3 flex items-center justify-between"
                style={{
                  borderTopColor: COLUMN_BORDER_COLORS[status],
                  borderTopWidth: '3px',
                }}
              >
                <h3 className="font-medium text-ink-1 text-sm">
                  {COLUMN_LABELS[status]}
                </h3>
                <span className="font-mono text-xs bg-warm-paper text-ink-2 px-2 py-0.5 rounded-full">
                  {rooms.length}
                </span>
              </div>

              {/* Card list area */}
              <div className="flex flex-col gap-2 p-2 bg-warm-paper border border-t-0 border-warm-line rounded-b-xl min-h-[200px]">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setSelectedRoom(room)}
                    className="w-full text-left bg-warm-white border border-warm-line rounded-lg p-3 cursor-pointer hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-terracotta"
                    data-testid={`room-card-${room.number}`}
                  >
                    {/* Room number + priority badge */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-base text-ink-1">
                        Hab. {room.number}
                      </span>
                      {room.activeTask?.priority && (
                        <PriorityBadge priority={room.activeTask.priority as Priority} />
                      )}
                    </div>

                    {/* Assignee row */}
                    <div className="flex items-center justify-between mt-2 gap-2">
                      {room.activeTask?.assignedToName ? (
                        <AssigneeAvatar
                          assignee={{ name: room.activeTask.assignedToName }}
                        />
                      ) : (
                        /* Unassigned placeholder — visible to all roles for
                           structural layout; click-to-assign CTA is separate below */
                        <span className="w-7 h-7 rounded-full border border-dashed border-warm-line flex items-center justify-center text-ink-4">
                          <UserPlus size={12} />
                        </span>
                      )}

                      {/* Time-elapsed label placeholder — field not yet in BoardRoomTask.
                           Will render when API exposes elapsedLabel (deferred to v1.2). */}
                    </div>

                    {/* MANAGER/ADMIN: assign-task CTA (stops card click propagation) */}
                    {canAssign && (
                      <span
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            setAssignRoom(room);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignRoom(room);
                        }}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-ink-3 border border-dashed border-warm-line rounded-full px-2 py-0.5 hover:border-terracotta hover:text-terracotta cursor-pointer transition-colors"
                        data-testid={`assign-task-${room.number}`}
                      >
                        <UserPlus size={11} />
                        Asignar tarea
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals / Drawers */}
      {selectedRoom && (
        <RoomStatusModal
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
        />
      )}

      {assignRoom && canAssign && (
        <TaskAssignmentDrawer
          room={assignRoom}
          onClose={() => setAssignRoom(null)}
        />
      )}
    </div>
  );
}
