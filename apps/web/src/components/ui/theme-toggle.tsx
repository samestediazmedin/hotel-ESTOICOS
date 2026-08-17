import * as React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from './button';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ThemeToggleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ className, ...props }, ref) => {
    const { theme, toggle } = useTheme();
    const isDark = theme === 'dark';
    const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

    return (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        title={label}
        onClick={toggle}
        className={cn(className)}
        {...props}
      >
        {isDark ? (
          <Sun aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Moon aria-hidden="true" className="h-4 w-4" />
        )}
      </Button>
    );
  },
);
ThemeToggle.displayName = 'ThemeToggle';

export { ThemeToggle };
