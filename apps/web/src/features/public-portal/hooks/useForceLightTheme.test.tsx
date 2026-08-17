import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useForceLightTheme } from './useForceLightTheme';

describe('useForceLightTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('removes data-theme attribute on mount', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    renderHook(() => useForceLightTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('restores prior data-theme value on unmount', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { unmount } = renderHook(() => useForceLightTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    unmount();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('does NOT add an attribute on unmount when none existed before mount', () => {
    // No data-theme set before mount
    const { unmount } = renderHook(() => useForceLightTheme());
    unmount();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });
});
