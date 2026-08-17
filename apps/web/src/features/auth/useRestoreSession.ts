import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore, hasRecentAuth, clearRecentAuth } from './auth.store';

/**
 * useRestoreSession — G3 fix
 *
 * Calls POST /auth/refresh on App mount. If the browser still holds a valid
 * httpOnly refresh cookie the server issues a new accessToken AND echoes the
 * current user record so role-aware UI (Sidebar, ProtectedRoute) hydrates
 * correctly on hard refresh.
 *
 * Bug history (2026-05-28): previously only the accessToken was set, leaving
 * `user` null and the Sidebar reading role='' → all ADMIN/MANAGER nav items
 * disappeared until the next login.
 *
 * Protection guards:
 *  - If accessToken already present in store (e.g. normal login flow), skips
 *    the network call and marks restore complete immediately.
 *  - Empty dependency array ensures this runs exactly once per page load.
 *  - On any failure (401, network error, expired cookie) we resolve silently
 *    with isRestoring=false — ProtectedRoute redirects to /login.
 *
 * Returns nothing — ProtectedRoute reads isRestoring directly from the store.
 */
interface RefreshResponse {
  accessToken: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    role: 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'HOUSEKEEPING';
  };
}

export function useRestoreSession() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const setIsRestoring = useAuthStore((s) => s.setIsRestoring);

  useEffect(() => {
    if (accessToken) {
      // Already have a token (normal login flow) — restore is a no-op
      setIsRestoring(false);
      return;
    }

    // 2026-05-27 — Skip the refresh call entirely for purely anonymous visitors
    // (huéspedes públicos en /booking, etc.). The flag is set in auth.store on
    // successful login and cleared on logout/refresh failure, so only sessions
    // that were authenticated at some point will trigger the refresh attempt.
    // Eliminates the noisy 401 in the browser console for public visitors.
    if (!hasRecentAuth()) {
      setIsRestoring(false);
      return;
    }

    api
      .post<RefreshResponse>('/auth/refresh', {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        // 2026-05-28 — Hydrate the user so the Sidebar (and any other role-gated
        // UI) renders correctly on hard refresh. The backend now echoes the
        // user record from /auth/refresh; ignore older deployments that only
        // returned { accessToken } so we don't crash.
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        // Cookie expired or invalid — drop the flag so subsequent reloads don't
        // attempt refresh again. ProtectedRoute will redirect to /login.
        clearRecentAuth();
      })
      .finally(() => {
        setIsRestoring(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
