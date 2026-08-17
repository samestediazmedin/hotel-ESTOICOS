import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HousekeepingGateway, RoomStatusUpdatePayload } from './housekeeping.gateway';
import type { Socket, Server } from 'socket.io';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClient(tokenOverride?: string | undefined | null): {
  mockJoin: ReturnType<typeof vi.fn>;
  mockDisconnect: ReturnType<typeof vi.fn>;
  client: Socket;
} {
  const mockJoin = vi.fn().mockResolvedValue(undefined);
  const mockDisconnect = vi.fn();
  const client = {
    id: 'sock-test-1',
    handshake: {
      auth: tokenOverride === undefined
        ? { token: 'valid-jwt-token' }
        : tokenOverride === null
          ? {}
          : { token: tokenOverride },
    },
    join: mockJoin,
    disconnect: mockDisconnect,
    data: {},
  } as unknown as Socket;
  return { mockJoin, mockDisconnect, client };
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

describe('HousekeepingGateway', () => {
  let gateway: HousekeepingGateway;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HousekeepingGateway,
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

    gateway = module.get(HousekeepingGateway);
    jwtService = module.get(JwtService);
  });

  // ── Test 1: valid JWT → client.join('housekeeping') + no disconnect ─────────

  it('Test 1 — handleConnection: valid JWT → joins housekeeping room, no disconnect', async () => {
    const { mockJoin, mockDisconnect, client } = makeClient(); // token = 'valid-jwt-token'
    vi.mocked(jwtService.verifyAsync).mockResolvedValue({ sub: 'user-001', role: 'HOUSEKEEPING' });

    await gateway.handleConnection(client);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-jwt-token', { secret: 'test-jwt-secret' });
    expect(mockJoin).toHaveBeenCalledWith('housekeeping');
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  // ── Test 2: no token → client.disconnect(true) + no join ──────────────────

  it('Test 2 — handleConnection: no token in auth → disconnect(true), no join', async () => {
    const { mockJoin, mockDisconnect, client } = makeClient(null); // auth = {}

    await gateway.handleConnection(client);

    expect(mockDisconnect).toHaveBeenCalledWith(true);
    expect(mockJoin).not.toHaveBeenCalled();
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  // ── Test 3: invalid JWT → disconnect(true) + no join + no rethrow ─────────

  it('Test 3 — handleConnection: verifyAsync rejects → disconnect(true), no join, no rethrow', async () => {
    const { mockJoin, mockDisconnect, client } = makeClient('bad-token');
    vi.mocked(jwtService.verifyAsync).mockRejectedValue(new Error('jwt malformed'));

    // Must NOT throw
    await expect(gateway.handleConnection(client)).resolves.toBeUndefined();

    expect(mockDisconnect).toHaveBeenCalledWith(true);
    expect(mockJoin).not.toHaveBeenCalled();
  });

  // ── Test 4: emitStatusUpdate → server.to('housekeeping').emit('room:statusUpdate') ──

  it('Test 4 — emitStatusUpdate: calls server.to("housekeeping").emit with correct payload', () => {
    const { server, mockTo, mockEmit } = makeServer();

    // Inject the mock server via reflection (NestJS sets @WebSocketServer() after init)
    (gateway as any).server = server;

    const payload: RoomStatusUpdatePayload = {
      roomId: 'room-001',
      from: 'DIRTY',
      to: 'IN_PROGRESS',
      byUserId: 'user-001',
      at: '2026-05-15T12:00:00.000Z',
    };

    gateway.emitStatusUpdate(payload);

    expect(mockTo).toHaveBeenCalledWith('housekeeping');
    expect(mockEmit).toHaveBeenCalledWith('room:statusUpdate', payload);
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });

  // ── Test 5: handleDisconnect → no throw, does not call server methods ──────

  it('Test 5 — handleDisconnect: logs and does not throw; does not call server methods', () => {
    const { server, mockTo } = makeServer();
    (gateway as any).server = server;

    const { client } = makeClient();

    expect(() => gateway.handleDisconnect(client)).not.toThrow();
    expect(mockTo).not.toHaveBeenCalled();
  });
});
