import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/auth.store';

/**
 * Module-level singleton — created once per accessToken value.
 * Prevents duplicate connections on React strict-mode double-mount (P7).
 */
let socket: Socket | null = null;

/**
 * useHousekeepingSocket
 *
 * Connects to the housekeeping Socket.io namespace on mount.
 * Disconnects on unmount or when accessToken changes (handles JWT rotation — P8).
 *
 * Real-time strategy (§4.7 RESEARCH):
 *   - On 'room:statusUpdate' → invalidateQueries (full refetch, no stale flicker)
 *   - On 'connect' (incl. reconnect) → invalidateQueries (repairs missed events)
 *   - On 'connect_error' → console.warn only; socket.io reconnection handles retry
 *
 * Auth: token in handshake.auth.token (NOT URL) per 05-02 decision.
 * The backend HousekeepingGateway reads client.handshake.auth?.token.
 */
export function useHousekeepingSocket(): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;

    // VITE_API_URL: the full base URL of the API server.
    // Falls back to same-origin (Vite proxy) in development.
    // In production on Railway, set VITE_API_URL to the API service URL.
    const apiUrl = import.meta.env.VITE_API_URL ?? '';

    socket = io(apiUrl, {
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.on('room:statusUpdate', () => {
      void queryClient.invalidateQueries({ queryKey: ['housekeeping', 'rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['housekeeping', 'tasks'] });
    });

    // On connect (initial) and reconnect (after drop), repair missed events
    socket.on('connect', () => {
      void queryClient.invalidateQueries({ queryKey: ['housekeeping', 'rooms'] });
    });

    socket.on('connect_error', (err) => {
      // JWT invalid → backend calls client.disconnect(true).
      // socket.io will retry per reconnectionAttempts policy.
      console.warn('[housekeeping-socket] connect_error', err.message);
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [accessToken, queryClient]);
}
