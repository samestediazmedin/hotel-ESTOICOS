import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// ─── Payload type ─────────────────────────────────────────────────────────────

export interface ContactEventPayload {
  eventId: string;
  guestId: string;
  method: 'CALL' | 'WHATSAPP' | 'EMAIL';
  staffUserId: string;
  staffUserName: string | null;
  createdAt: string; // ISO string
}

// ─── Gateway ──────────────────────────────────────────────────────────────────

/**
 * GuestContactGateway — Socket.io gateway for real-time guest contact events.
 *
 * Namespace: / (default — same as HousekeepingGateway; NestJS supports multiple
 *             gateways on the same namespace sharing the same Server instance)
 * CORS:      process.env.FRONTEND_URL (defaults to http://localhost:5173 for dev)
 * Auth:      JWT extracted from client.handshake.auth.token
 *            Verified via JwtService.verifyAsync — NOT @UseGuards(JwtAuthGuard)
 *            (guards run at message level, not connection level)
 *
 * Rooms: DYNAMIC per-guest — clients join via 'join-room' / 'leave-room' messages.
 *   Unlike HousekeepingGateway (one static room), this gateway uses per-guest rooms
 *   named `guest:{guestId}`. Staff open a guest's detail page → join-room, leave → leave-room.
 *
 * Emitted events:
 *   - 'contact-event.created' with ContactEventPayload
 *
 * Received messages:
 *   - 'join-room'  → client joins room `guest:{guestId}` (validated prefix)
 *   - 'leave-room' → client leaves room
 *
 * Called by:
 *   - GuestContactService.createEvent (after Prisma insert succeeds)
 *
 * P5 — Gateway NEVER imports GuestContactService (one-way DI: service → gateway).
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/',
})
export class GuestContactGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(GuestContactGateway.name);

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
   * Token is expected in client.handshake.auth.token.
   * On missing token  → disconnect immediately.
   * On invalid token  → disconnect immediately.
   * On valid token    → allow connection (NO auto-join to any room — rooms are dynamic).
   *
   * Delta from HousekeepingGateway: no `client.join(...)` here.
   * Clients join rooms explicitly via 'join-room' message.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        client.disconnect(true);
        return;
      }
      await this.jwtService.verifyAsync(token, { secret: this.jwtSecret });
      this.logger.log(`GuestContact client connected: ${client.id}`);
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
    this.logger.log(`GuestContact client disconnected: ${client.id}`);
  }

  /**
   * handleJoinRoom — client requests to join a guest room.
   *
   * Room name MUST start with 'guest:' — defense-in-depth against clients
   * joining arbitrary rooms (e.g., 'housekeeping'). Any authenticated staff
   * role may join any guest room in v1.3.
   */
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    if (!room.startsWith('guest:')) {
      this.logger.warn(`Client ${client.id} attempted invalid room join: ${room}`);
      return;
    }
    await client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
  }

  /**
   * handleLeaveRoom — client requests to leave a guest room.
   */
  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await client.leave(room);
    this.logger.log(`Client ${client.id} left ${room}`);
  }

  /**
   * emitContactEvent — broadcast a new contact event to all subscribers of the guest room.
   *
   * Called by GuestContactService AFTER the prisma.guestContactEvent.create commits.
   * Fire-and-forget — no return value, no await from the caller.
   */
  emitContactEvent(guestId: string, payload: ContactEventPayload): void {
    this.server.to(`guest:${guestId}`).emit('contact-event.created', payload);
  }
}
