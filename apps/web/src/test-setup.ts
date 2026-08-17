import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './test/msw-server';

// ─── scrollIntoView polyfill for jsdom ───────────────────────────────────────
// jsdom does not implement Element.scrollIntoView. Any component that calls it
// (e.g. ConciergeContent auto-scroll to last message) will throw without this stub.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

// ─── matchMedia polyfill for jsdom (required by useTheme + ThemeToggle) ──────
// jsdom does not implement window.matchMedia. Any component that calls
// window.matchMedia (e.g. useTheme → prefers-color-scheme query) will crash
// without this stub. Returns matches: false (light mode default).
if (typeof window !== 'undefined' && !window.matchMedia) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// ─── MSW global interceptor (FE-002) ─────────────────────────────────────────
// Catches ALL unhandled HTTP calls during tests and surfaces them as warnings.
// Individual tests can add specific handlers via server.use(...) in beforeEach.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
