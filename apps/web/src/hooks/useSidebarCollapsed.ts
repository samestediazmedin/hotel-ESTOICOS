import { useState } from 'react';

/** localStorage key — exported for use in tests. */
export const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

/**
 * useSidebarCollapsed
 *
 * Persists sidebar collapse state in localStorage.
 * Initial value is read synchronously via useState lazy initializer —
 * no useEffect needed, and no SSR concern (this is a Vite SPA).
 *
 * Returns { collapsed, toggle } where `toggle` writes the new boolean
 * back to localStorage before updating React state.
 */
export function useSidebarCollapsed(): {
  collapsed: boolean;
  toggle: () => void;
} {
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  );

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? 'true' : 'false');
      } catch {
        /* localStorage unavailable (private mode etc.) — non-fatal */
      }
      return next;
    });
  };

  return { collapsed, toggle };
}
