import * as React from 'react';

import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * Textarea — multi-line input primitive matching the token system of <Input>.
 *
 * Mirrors the token pattern of input.tsx (Phase 9) but for <textarea>.
 * Use for long-form fields such as hotel description.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex w-full rounded-md border border-warm-line-strong bg-warm-paper px-3 py-2 text-sm text-ink-1 shadow-sm placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-terracotta resize-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
