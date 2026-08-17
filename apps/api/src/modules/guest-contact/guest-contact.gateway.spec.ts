import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GuestContactGateway, ContactEventPayload } from './guest-contact.gateway';
import type { Socket, Server } from 'socket.io';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClient(tokenOverride?: string | undefined | null): {
  mockJoin: ReturnType<typeof vi.fn>;
  mockLeave: ReturnType<typeof vi.fn>;
  mockDisconnect: ReturnType<typeof vi.fn>;
  client: Socket;
} {
  const mockJoin = vi.fn().mockResolvedValue(undefined);
  const mockLeave = vi.fn().mockResolvedValue(undefined);
  const mockDisconnect = vi.fn();
  const client = {
    id: 'sock-test-gc-1',
    handshake: {
      auth: tokenOverride === undefined
        ? { token: 'valid-jwt-token' }
        : tokenOverride === null
          ? {}
          : { token: tokenOverride },
    },
    join: mockJoin,
    leave: mockLeave,
    disconnect: mockDisconnect,
    data: {},
  } as unknown as Socket;
  return { mockJoin, mockLeave, mockDisconnect, client };
}

function makeServer() {
  const mockEmit = vi.fn();
  const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });
  const server = {
    to: mockTo,
    emit: vi.fn(),
  } as unknown as Server;
  return { server, mockTo, mockEmit };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('GuestContactGateway', () => {
  let gateway: GuestContactGateway;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestContactGateway,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue('test-jwt-secret'),
          },
        },
      ],
    }).compile();

    gateway = module.get(GuestContactGateway);
    jwtService = module.get(JwtService);
  });

  // ── Test 1: valid JWT → client stays connected, NO auto-join to any room ────

  it('Test 1 — handleConnection: valid JWT → connected, no auto-join', async () => {
    const { mockJoin, mockDisconnect, client } = makeClient();
    vi.mocked(jwtService.verifyAsync).mockResolvedValue({ sub: 'user-001', role: 'RECEPTION' });

    await gateway.handleConnection(client);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-jwt-token', { secret: 'test-jwt-secret' });
    // CRITICAL: unlike HousekeepingGateway, NO auto-join to any static room
    expect(mockJoin).not.toHaveBeenCalled();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  // ── Test 2: no token → disconnect(true) + no join ──────────────────────────

  it('Test 2 — handleConnection: no token → disconnect(true), no join', async () => {
    const { mockJoin, mockDisconnect, client } = makeClient(null);

    await gateway.handleConnection(client);

    expect(mockDisconnect).toHaveBeenCalledWith(true);
    expect(mockJoin).not.toHaveBeenCalled();
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  // ── Test 3: invalid JWT → disconnect(true) + no join + no rethrow ──────────

  it('Test 3 — handleConnection: verifyAsync rejects → disconnect(true), no join, no rethrow', async () => {
    const { mockJoin, mockDisconnect, client } = makeClient('bad-token');
    vi.mocked(jwtService.verifyAsync).mockRejectedValue(new Error('jwt malformed'));

    await expect(gateway.handleConnection(client)).resolves.toBeUndefined();

    expect(mockDisconnect).toHaveBeenCalledWith(true);
    expect(mockJoin).not.toHaveBeenCalled();
  });

  // ── Test 4: join-room with valid 'guest:...' prefix → client.join called ───

  it('Test 4 — handleJoinRoom: valid room "guest:abc123" → client.join called', async () => {
    const { mockJoin, client } = makeClient();

    await gateway.handleJoinRoom('guest:abc123', client);

    expect(mockJoin).toHaveBeenCalledWith('guest:abc123');
  });

  // ── Test 5: join-room with invalid prefix → ignored (no join) ───────────────

  it('Test 5 — handleJoinRoom: invalid room "housekeeping" → ignored, no join', async () => {
    const { mockJoin, client } = makeClient();

    await gateway.handleJoinRoom('housekeeping', client);

    expect(mockJoin).not.toHaveBeenCalled();
  });

  it('Test 5b — handleJoinRoom: invalid room "admin:xyz" → ignored, no join', async () => {
    const { mockJoin, client } = makeClient();

    await gateway.handleJoinRoom('admin:xyz', client);

    expect(mockJoin).not.toHaveBeenCalled();
  });

  // ── Test 6: leave-room → client.leave called ────────────────────────────────

  it('Test 6 — handleLeaveRoom: leave-room → client.leave called with room name', async () => {
    const { mockLeave, client } = makeClient();

    await gateway.handleLeaveRoom('guest:abc123', client);

    expect(mockLeave).toHaveBeenCalledWith('guest:abc123');
  });

  // ── Test 7: emitContactEvent → server.to(`guest:{id}`).emit('contact-event.created') ──

  it('Test 7 — emitContactEvent: emits to correct room with payload', () => {
    const { server, mockTo, mockEmit } = makeServer();
    (gateway as any).server = server;

    const payload: ContactEventPayload = {
      eventId: 'evt-001',
      guestId: 'guest-abc',
      method: 'WHATSAPP',
      staffUserId: 'user-001',
      staffUserName: 'María Pérez',
      createdAt: '2026-05-27T10:00:00.000Z',
    };

    gateway.emitContactEvent('guest-abc', payload);

    expect(mockTo).toHaveBeenCalledWith('guest:guest-abc');
    expect(mockEmit).toHaveBeenCalledWith('contact-event.created', payload);
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });

  // ── Test 8: handleDisconnect → no throw, does not call server methods ───────

  it('Test 8 — handleDisconnect: logs, does not throw, does not call server methods', () => {
    const { server, mockTo } = makeServer();
    (gateway as any).server = server;

    const { client } = makeClient();

    expect(() => gateway.handleDisconnect(client)).not.toThrow();
    expect(mockTo).not.toHaveBeenCalled();
  });
});
