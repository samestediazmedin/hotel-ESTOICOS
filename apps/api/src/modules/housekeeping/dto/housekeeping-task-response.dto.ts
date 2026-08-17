export interface HousekeepingTaskResponseDto {
  id: string;
  roomId: string;
  roomNumber?: string;
  assignedToId: string | null;
  assignedToName?: string | null;
  createdById: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  notes: string | null;
  completedAt: Date | null;
  businessDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
