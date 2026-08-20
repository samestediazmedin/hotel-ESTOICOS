import { useEffect } from 'react';

/**
 * Force light theme while a public-portal surface is mounted.
 * Removes `data-theme` from <html> on mount; restores prior value on unmount.
 * Does NOT touch localStorage — staff theme preference survives navigation away.
 */
export function useForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.dataset.theme;
    delete root.dataset.theme;
    return () => {
      if (prev) root.dataset.theme = prev;
    };
  }, []);
}

