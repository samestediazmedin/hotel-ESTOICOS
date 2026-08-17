import { create } from 'zustand';

interface AuthUser {
  id: string;
  sub?: string; // JWT subject (same as id, used for compatibility)
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'HOUSEKEEPING';
  name?: string;
}

interface AuthState {
  /** Access token lives in memory only — NEVER persisted to localStorage */
  accessToken: string | null;
  user: AuthUser | null;
  /**
   * isRestoring — true on initial page load while useRestoreSession hook
   * attempts POST /auth/refresh. ProtectedRoute renders a loading state
   * instead of redirecting to /login prematurely. (G3 fix)
   */
  isRestoring: boolean;
  setAccessToken: (token: string) => void;
  setUser: (user: AuthUser) => void;
  setIsRestoring: (v: boolean) => void;
  clearAuth: () => void;
}

/**
 * RECENT_AUTH_KEY — localStorage flag that tells useRestoreSession whether it is
 * worth attempting POST /auth/refresh on app mount. Set after any successful
 * login (so a page refresh inside the staff PMS still restores the session),
 * cleared on logout or refresh failure. Pure anonymous visitors (huéspedes
 * públicos navegando booking) never see the flag set, so we skip the refresh
 * call entirely and avoid a noisy 401 in the browser console.
 *
 * Security note: this flag is NOT the access token — it's a single character
 * indicating 'a session probably exists'. The actual refresh token still lives
 * exclusively in the httpOnly cookie.
 */
export const RECENT_AUTH_KEY = 'hos-recent-auth';

export function markRecentAuth(): void {
  try { localStorage.setItem(RECENT_AUTH_KEY, '1'); } catch { /* SSR or blocked storage */ }
}

export function clearRecentAuth(): void {
  try { localStorage.removeItem(RECENT_AUTH_KEY); } catch { /* SSR or blocked storage */ }
}

export function hasRecentAuth(): boolean {
  try { return localStorage.getItem(RECENT_AUTH_KEY) === '1'; } catch { return false; }
}

/**
 * Zustand auth store
 *
 * SECURITY RULE (D-05, D-08):
 *   - accessToken is stored in memory only
 *   - refresh token lives in httpOnly cookie (set by server, invisible to JS)
 *   - On page refresh: accessToken is null → 401 interceptor in api.ts
 *     silently calls /auth/refresh (cookie sent automatically) → gets new token
 *   - NEVER call localStorage.setItem with the access token
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  // Starts as true — assume there may be a session until /auth/refresh resolves
  isRestoring: true,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  setIsRestoring: (v) => set({ isRestoring: v }),
  clearAuth: () => {
    clearRecentAuth();
    set({ accessToken: null, user: null });
  },
}));
