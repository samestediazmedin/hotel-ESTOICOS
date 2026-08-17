import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    globals: true,
    environment: 'node',
    root: './src',
    // Injects test-only secrets before any module loads (see test-setup.ts).
    // setupFiles run before test modules are imported, so module-load
    // fail-fast guards (e.g. CSRF_SECRET) are satisfied without weakening
    // the production-side validation.
    setupFiles: ['./test-setup.ts'],
  },
});
