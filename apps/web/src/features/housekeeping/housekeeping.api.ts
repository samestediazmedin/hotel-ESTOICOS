import { api } from '@/lib/api';
import type { CleaningStatus } from './cleaning-transitions';

export interface BoardRoomTask {
  id: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  assignedToId: string | null;
  assignedToName: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
}

export interface BoardRoom {
  id: string;
  number: string;
  floor: number | null;
  cleaningStatus: CleaningStatus;
  activeTask?: BoardRoomTask;
}

export interface BoardResponse {
  rooms: BoardRoom[];
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  assignedToId: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  notes?: string | null;
}

export const housekeepingApi = {
  getBoard: () =>
    api.get<BoardResponse>('/housekeeping/rooms/board').then((r) => r.data),

  transitionRoom: (roomId: string, next: CleaningStatus) =>
    api.patch<void>(`/housekeeping/rooms/${roomId}/cleaning-status`, { next }),

  listTasks: (params: { assignedTo?: 'me' | 'all'; status?: string }) =>
    api
      .get<{ tasks: HousekeepingTask[] }>('/housekeeping/tasks', { params })
      .then((r) => r.data),

  createTask: (body: {
    roomId: string;
    assignedToId?: string | null;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    notes?: string;
  }) =>
    api.post<HousekeepingTask>('/housekeeping/tasks', body).then((r) => r.data),

  updateTaskStatus: (taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'DONE') =>
    api
      .patch<HousekeepingTask>(`/housekeeping/tasks/${taskId}/status`, { status })
      .then((r) => r.data),
};
