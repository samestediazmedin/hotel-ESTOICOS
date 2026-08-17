import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuthStore, markRecentAuth } from './auth.store';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  mustChangePassword?: boolean;
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'HOUSEKEEPING';
    name: string;
  };
}

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setAccessToken, setUser, clearAuth, accessToken } = useAuthStore();

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data } = await api.post<LoginResponse>('/auth/login', credentials);
      setAccessToken(data.accessToken);
      // Mark that a session was successfully established so subsequent page
      // reloads attempt the silent /auth/refresh restore. Anonymous visitors
      // never set this flag, so they avoid the noisy 401 in the console.
      markRecentAuth();

      if (data.user) {
        setUser(data.user);
      }

      if (data.mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { status: number; data?: { message?: string } };
      };

      if (axiosError.response?.status === 429) {
        // D-12: rate-limit message — D-11: still generic, no email enumeration
        setError('Credenciales incorrectas, intente más tarde.');
      } else {
        // D-11: generic message for all other auth failures (401, 403, etc.)
        setError('Credenciales incorrectas');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Always clear local state even if server call fails
    } finally {
      clearAuth();
      // UX rule (2026-05-22): logout returns to public portal, not /login.
      // Login is reachable only via Staff button or direct /login URL.
      navigate('/');
    }
  };

  return {
    login,
    logout,
    isLoading,
    error,
    isAuthenticated: accessToken !== null,
  };
}
