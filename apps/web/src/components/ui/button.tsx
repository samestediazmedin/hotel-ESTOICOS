import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * buttonVariants — 7 variants mapped to bundle token utilities.
 *
 * default     : terracotta fill (primary brand button)
 * terracotta  : semantic alias for `default` — use in Phase 11 for explicit intent
 * destructive : shadcn destructive bridge (--destructive: #dc2626 via globals.css :root)
 * outline     : warm-white bg, warm-line-strong border
 * secondary   : warm-white bg, ink-1 text, warm-line-strong border
 * ghost       : transparent bg, terracotta-soft hover
 * link        : terracotta text, underline on hover
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-terracotta text-warm-white shadow hover:bg-terracotta-deep',
        terracotta:
          'bg-terracotta text-warm-white shadow hover:bg-terracotta-deep',
        destructive:
          'bg-destructive text-white shadow-sm hover:bg-destructive/90',
        outline:
          'border border-warm-line-strong bg-warm-white shadow-sm hover:bg-terracotta-soft hover:text-ink-1',
        secondary:
          'bg-warm-white text-ink-1 border border-warm-line-strong shadow-sm hover:bg-terracotta-soft',
        ghost:
          'hover:bg-terracotta-soft hover:text-ink-1',
        link:
          'text-terracotta underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
