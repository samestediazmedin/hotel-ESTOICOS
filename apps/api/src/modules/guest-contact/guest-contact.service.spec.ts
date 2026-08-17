import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GuestContactService } from './guest-contact.service';
import { GuestContactRepository } from './guest-contact.repository';
import { GuestContactGateway } from './guest-contact.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContactEventSchema } from './dto/create-contact-event.dto';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEventRow(overrides: Record<string, any> = {}) {
  return {
    id: 'evt-001',
    guestId: 'guest-abc',
    staffUserId: 'user-001',
    method: 'CALL',
    notes: null,
    createdAt: new Date('2026-05-27T10:00:00.000Z'),
    staffUser: { id: 'user-001', name: 'María Pérez', email: 'maria@hotel.com' },
    ...overrides,
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const prismaGuestFindUnique = vi.fn();
const repoCreate = vi.fn();
const repoFindMany = vi.fn();
const gatewayEmit = vi.fn();

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('GuestContactService', () => {
  let service: GuestContactService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestContactService,
        {
          provide: PrismaService,
          useValue: {
            guest: { findUnique: prismaGuestFindUnique },
          },
        },
        {
          provide: GuestContactRepository,
          useValue: {
            create: repoCreate,
            findManyByGuestId: repoFindMany,
          },
        },
        {
          provide: GuestContactGateway,
          useValue: {
            emitContactEvent: gatewayEmit,
          },
        },
      ],
    }).compile();

    service = module.get(GuestContactService);
  });

  // ── Test 1: createEvent happy path → persists row, notes=null ────────────────

  it('Test 1 — createEvent: valid guest + method=CALL → persists row with notes=null', async () => {
    prismaGuestFindUnique.mockResolvedValue({ id: 'guest-abc', fullName: 'Juan' });
    const row = makeEventRow();
    repoCreate.mockResolvedValue(row);

    const result = await service.createEvent('guest-abc', { method: 'CALL' }, 'user-001');

    expect(repoCreate).toHaveBeenCalledWith({
      guestId: 'guest-abc',
      staffUserId: 'user-001',
      method: 'CALL',
      notes: null,
    });
    expect(result.method).toBe('CALL');
    expect(result.notes).toBeNull();
  });

  // ── Test 2: createEvent with non-existent guest → NotFoundException ──────────

  it('Test 2 — createEvent: non-existent guestId → throws NotFoundException', async () => {
    prismaGuestFindUnique.mockResolvedValue(null);

    await expect(
      service.createEvent('unknown-id', { method: 'EMAIL' }, 'user-001'),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Test 3: createEvent calls gateway.emitContactEvent AFTER prisma write ────

  it('Test 3 — createEvent: emitContactEvent called AFTER repo.create resolves', async () => {
    prismaGuestFindUnique.mockResolvedValue({ id: 'guest-abc' });
    const row = makeEventRow({ method: 'WHATSAPP' });
    repoCreate.mockResolvedValue(row);

    let createResolved = false;
    repoCreate.mockImplementationOnce(async (data: any) => {
      createResolved = false;
      const result = makeEventRow({ ...data });
      createResolved = true;
      return result;
    });

    gatewayEmit.mockImplementation(() => {
      // At this point prisma write must already be done
      expect(createResolved).toBe(true);
    });

    await service.createEvent('guest-abc', { method: 'WHATSAPP' }, 'user-001');

    expect(gatewayEmit).toHaveBeenCalledTimes(1);
    const emitCall = gatewayEmit.mock.calls[0];
    expect(emitCall[0]).toBe('guest-abc');
    expect(emitCall[1].method).toBe('WHATSAPP');
  });

  // ── Test 4: createEvent returns event with staffUser.name joined ─────────────

  it('Test 4 — createEvent: returned DTO includes staffUser.name', async () => {
    prismaGuestFindUnique.mockResolvedValue({ id: 'guest-abc' });
    const row = makeEventRow({ staffUser: { id: 'user-001', name: 'Pedro García', email: 'pedro@hotel.com' } });
    repoCreate.mockResolvedValue(row);

    const result = await service.createEvent('guest-abc', { method: 'CALL' }, 'user-001');

    expect(result.staffUser.name).toBe('Pedro García');
    expect(result.staffUser.email).toBe('pedro@hotel.com');
  });

  // ── Test 5: listEvents returns up to 5 most-recent events ────────────────────

  it('Test 5 — listEvents: default limit=5 → repo called with limit=5', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeEventRow({ id: `evt-00${i}`, createdAt: new Date(`2026-05-2${i}T10:00:00.000Z`) }),
    );
    repoFindMany.mockResolvedValue(rows);

    const result = await service.listEvents('guest-abc');

    expect(repoFindMany).toHaveBeenCalledWith('guest-abc', 5);
    expect(result).toHaveLength(5);
  });

  // ── Test 6: listEvents(guestId, 100) clamps to max 50 ────────────────────────

  it('Test 6 — listEvents: limit=100 → clamped to 50', async () => {
    repoFindMany.mockResolvedValue([]);

    await service.listEvents('guest-abc', 100);

    expect(repoFindMany).toHaveBeenCalledWith('guest-abc', 50);
  });

  // ── Test 7: Zod schema rejects body missing method ────────────────────────────

  it('Test 7 — Zod schema: missing method → safeParse returns error', () => {
    const result = CreateContactEventSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  // ── Test 8: Zod schema rejects method not in enum ─────────────────────────────

  it('Test 8 — Zod schema: invalid method "SMS" → safeParse returns error', () => {
    const result = CreateContactEventSchema.safeParse({ method: 'SMS' });
    expect(result.success).toBe(false);
  });

  // ── Test 9: Zod schema rejects notes over 500 chars ──────────────────────────

  it('Test 9 — Zod schema: notes over 500 chars → safeParse returns error', () => {
    const result = CreateContactEventSchema.safeParse({
      method: 'CALL',
      notes: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  // ── Test 10: listEvents returns events ordered by createdAt DESC ──────────────

  it('Test 10 — listEvents: returns events in DESC order from repo', async () => {
    const rows = [
      makeEventRow({ id: 'evt-new', createdAt: new Date('2026-05-27T12:00:00.000Z') }),
      makeEventRow({ id: 'evt-old', createdAt: new Date('2026-05-27T08:00:00.000Z') }),
    ];
    repoFindMany.mockResolvedValue(rows);

    const result = await service.listEvents('guest-abc', 2);

    expect(result[0].id).toBe('evt-new');
    expect(result[1].id).toBe('evt-old');
  });
});
