import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// ─── Payload type ─────────────────────────────────────────────────────────────

export interface RoomStatusUpdatePayload {
  roomId:   string;
  from:     string;
  to:       string;
  byUserId: string | null;
  at:       string;
}

// ─── Gateway ──────────────────────────────────────────────────────────────────

/**
 * HousekeepingGateway — Socket.io gateway for real-time cleaning state updates.
 *
 * Namespace: / (default — single hotel, single gateway)
 * CORS:      process.env.FRONTEND_URL (defaults to http://localhost:5173 for dev)
 * Auth:      JWT extracted from client.handshake.auth.token
 *            Verified via JwtService.verifyAsync — NOT @UseGuards(JwtAuthGuard)
 *            (guards run at message level, not connection level — RESEARCH §4.3)
 *
 * Rooms: all authenticated clients join the Socket.io room 'housekeeping'.
 *   Broadcasts are scoped to this room via server.to('housekeeping').emit(...).
 *
 * Emitted events:
 *   - 'room:statusUpdate' with RoomStatusUpdatePayload
 *
 * Received events: none — read-only broadcast from server.
 *
 * Called by:
 *   - HousekeepingService.transitionRoomCleaningStatus (after prisma.room.update)
 *   - HousekeepingService.forceTransitionToDirty (after prisma.room.update, if not idempotent)
 *
 * P5 — Gateway NEVER imports HousekeepingService (one-way DI: service → gateway).
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/',
})
export class HousekeepingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(HousekeepingGateway.name);

  private readonly jwtSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_ACCESS_SECRET')!;
  }

  /**
   * handleConnection — authenticate every incoming socket connection.
   *
   * Token is expected in client.handshake.auth.token (set by frontend io() call).
   * On missing token  → disconnect immediately (no event delivered).
   * On invalid token  → disconnect immediately (no event delivered).
   * On valid token    → join 'housekeeping' room and allow messages.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        client.disconnect(true);
        return;
      }
      await this.jwtService.verifyAsync(token, { secret: this.jwtSecret });
      await client.join('housekeeping');
      this.logger.log(`Client connected: ${client.id}`);
    } catch {
      // Invalid / expired JWT — reject the connection immediately
      client.disconnect(true);
    }
  }

  /**
   * handleDisconnect — no cleanup needed.
   * Socket.io removes the client from all rooms automatically on disconnect.
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * emitStatusUpdate — broadcast a room status change to all housekeeping clients.
   *
   * Called by HousekeepingService AFTER the prisma.room.update commits (P3).
   * Fire-and-forget — no return value, no await from the caller.
   */
  emitStatusUpdate(payload: RoomStatusUpdatePayload): void {
    this.server.to('housekeeping').emit('room:statusUpdate', payload);
  }
}
