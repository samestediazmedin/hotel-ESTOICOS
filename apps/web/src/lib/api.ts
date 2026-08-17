import axios from 'axios';
import { useAuthStore } from '@/features/auth/auth.store';

/**
 * Axios instance for all API calls
 *
 * withCredentials: true ensures the browser sends the httpOnly
 * refresh-token cookie on every request (including /auth/refresh)
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Track in-flight refresh promise to handle concurrent 401s
// Multiple requests can fail with 401 simultaneously; they must all
// share the same refresh call (one network request, not N)
interface RefreshTokenResponse {
  accessToken: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    role: "ADMIN" | "MANAGER" | "RECEPTION" | "HOUSEKEEPING";
  };
}
let refreshPromise: Promise<RefreshTokenResponse> | null = null;

/**
 * Request interceptor — attach access token to every request
 */
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

/**
 * Response interceptor — silent token refresh on 401
 *
 * Protocol:
 * 1. On 401: check _retry flag to avoid infinite loop
 * 2. EARLY EXIT: if the FAILING request is /auth/refresh itself, do NOT
 *    attempt another refresh and do NOT redirect — just clear auth and
 *    propagate the error. Redirecting from here causes an infinite
 *    reload loop when useRestoreSession fires on the login page with no
 *    refresh cookie (bug fix discovered during MVP local launch).
 * 3. Call /auth/refresh once (shared promise for concurrent requests)
 * 4. Update Zustand store with new access token
 * 5. Retry original request with new token
 * 6. If refresh itself fails: clearAuth + redirect to public portal /
 *    (UX rule 2026-05-22 — login reachable only via Staff button)
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Step 2 (EARLY EXIT) — never recurse on the refresh endpoint itself.
    // ProtectedRoute is responsible for redirecting unauthenticated users;
    // forcing window.location.href from here when already on /login creates
    // a page-reload loop (useRestoreSession remounts and calls refresh again).
    const url = originalRequest?.url ?? '';
    const isRefreshCall = url.includes('/auth/refresh');
    if (error.response?.status === 401 && isRefreshCall) {
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // If another request is already refreshing, wait for that promise
      if (!refreshPromise) {
        refreshPromise = axios
          .post<{ accessToken: string; user?: { id: string; email: string; name?: string; role: 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'HOUSEKEEPING' } }>(
            '/api/auth/refresh',
            {},
            { withCredentials: true },
          )
          .then((res) => res.data)
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const data = await refreshPromise;
        const newToken = data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);
        // 2026-05-28 — also hydrate the user from /auth/refresh so the Sidebar
        // role gates render correctly after a silent session refresh.
        if (data.user) useAuthStore.getState().setUser(data.user);
        // Refresh succeeded — keep the recent-auth flag fresh for next page load
        try { localStorage.setItem('hos-recent-auth', '1'); } catch { /* noop */ }
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        // Refresh failed — session is truly expired.
        // Redirect to public portal /, NOT /login (UX rule 2026-05-22).
        // Only redirect if we're NOT already on / (avoids reload loop).
        useAuthStore.getState().clearAuth();
        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
