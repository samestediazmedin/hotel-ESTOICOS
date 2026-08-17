import * as React from 'react';
import { Badge } from './badge';
import { cn } from '@/lib/utils';

export type RoomStatus =
  | 'available'
  | 'reserved'
  | 'occupied'
  | 'cleaning'
  | 'maintenance'
  | 'blocked';

const STATUS_LABELS: Record<RoomStatus, string> = {
  available:   'Disponible',
  reserved:    'Reservada',
  occupied:    'Ocupada',
  cleaning:    'Limpieza',
  maintenance: 'Mantenimiento',
  blocked:     'Bloqueada',
};

export interface StatusPillProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: RoomStatus;
  showDot?: boolean;
  label?: string;
}

const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ status, showDot = true, label, className, ...props }, ref) => (
    <Badge
      ref={ref}
      variant={status}
      data-status={status}
      className={cn(className)}
      {...props}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
        />
      )}
      {label ?? STATUS_LABELS[status]}
    </Badge>
  ),
);
StatusPill.displayName = 'StatusPill';

export { StatusPill, STATUS_LABELS };
