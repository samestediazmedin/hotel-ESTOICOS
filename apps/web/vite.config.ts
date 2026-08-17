import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * Vite config — dev and preview both proxy /api, /socket.io AND /images
 * to the backend.
 *
 * dev:     vite dev (port 5180) → proxies /api + /socket.io + /images → http://localhost:3011
 * preview: vite preview (Railway service) → proxies same → process.env.API_URL
 *
 * Same-origin proxy is REQUIRED for the public Concierge endpoint to work:
 * the CSRF cookie uses sameSite: 'lax', which means cross-origin browser
 * requests would drop the cookie and break the double-submit pattern.
 *
 * /images was added 2026-05-28 — the filesystem-first storage refactor
 * publishes uploaded files at /images/<filename> served by express.static
 * on the NestJS API. Without this proxy entry, image tags fall through to
 * the SPA's index.html fallback and render as broken thumbnails.
 *
 * /socket.io is the default path for socket.io-client. We forward it with
 * ws: true so the HTTP→WS upgrade handshake survives the proxy.
 */
const apiTarget = process.env.API_URL || 'http://localhost:3003';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3003',
      '/images': 'http://localhost:3003',
      '/socket.io': {
        target: 'http://localhost:3003',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: Number(process.env.PORT) || 4173,
    host: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
      '/images': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
    allowedHosts: true,
  },
});
