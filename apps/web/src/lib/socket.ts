import { io, Socket } from 'socket.io-client';

/**
 * Shared Socket.io singleton for apps/web.
 *
 * Design decision (Phase 16):
 *   useHousekeepingSocket creates its own per-feature instance (historical).
 *   useGuestContactEvents uses this shared singleton to avoid a second WebSocket
 *   connection to the same default '/' namespace. Both connect to the same
 *   backend server — sharing the transport is correct.
 *
 * Token refresh: if the access token rotates, getOrCreateSocket disconnects the
 * old socket and creates a new one with the fresh token.
 *
 * Migration note: useHousekeepingSocket NOT migrated to this singleton in v1.3.
 * Deferred to v1.4 cleanup (two connections are functionally correct but wasteful).
 */

let sharedSocket: Socket | null = null;
let currentToken: string | null = null;

/**
 * Returns the existing socket if the token hasn't changed; otherwise
 * disconnects the stale socket and creates a new authenticated connection.
 */
export function getOrCreateSocket(accessToken: string): Socket {
  if (sharedSocket && currentToken === accessToken) {
    return sharedSocket;
  }

  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }

  // VITE_API_URL: full base URL of the API server.
  // Falls back to same-origin (Vite proxy) in development.
  const apiUrl = import.meta.env.VITE_API_URL ?? '';

  sharedSocket = io(apiUrl, {
    auth: { token: accessToken },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });

  currentToken = accessToken;
  return sharedSocket;
}

/**
 * Forcefully closes the shared socket and clears module state.
 * Call on logout to release the WebSocket connection.
 */
export function disconnectSocket(): void {
  sharedSocket?.disconnect();
  sharedSocket = null;
  currentToken = null;
}
