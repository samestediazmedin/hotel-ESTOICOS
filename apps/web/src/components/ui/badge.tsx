import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-warm-cream text-ink-2',
        available:   'bg-status-available-bg text-status-available',
        reserved:    'bg-status-reserved-bg text-status-reserved',
        occupied:    'bg-status-occupied-bg text-status-occupied',
        cleaning:    'bg-status-cleaning-bg text-status-cleaning',
        maintenance: 'bg-status-maintenance-bg text-status-maintenance',
        blocked:     'bg-status-blocked-bg text-status-blocked',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
