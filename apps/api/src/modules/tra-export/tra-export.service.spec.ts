import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TRAExportService } from './tra-export.service';
import { TRAExportController } from './tra-export.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { GuestEncryptionService } from '../guests/encryption/guest-encryption.service';
import { TRAAuditLogRepository } from './tra-audit-log.repository';
import { ROLES_KEY } from '../../shared/decorators/roles.decorator';

// ─── Constants ────────────────────────────────────────────────────────────────

const FROM = new Date('2026-05-01T00:00:00.000Z');
const TO = new Date('2026-05-31T23:59:59.999Z');
const USER_ID = 'user-admin-001';

// ─── Mock builders ────────────────────────────────────────────────────────────

function makeGuest(overrides: Partial<ReturnType<typeof baseGuest>> = {}) {
  return { ...baseGuest(), ...overrides };
}

function baseGuest() {
  return {
    id: 'guest-001',
    fullName: 'Juan Pérez',
    documentType: 'CC',
    documentNumber: 'enc:iv:tag:ciphertext', // encrypted value
    nationality: 'Colombia',
    dateOfBirth: new Date('1990-05-15T00:00:00.000Z'),
    anonymizedAt: null,
  };
}

function makeStay(guestOverrides: Partial<ReturnType<typeof baseGuest>> = {}) {
  return {
    id: 'stay-001',
    reservationId: 'res-001',
    roomId: 'room-101',
    arrivedAt: new Date('2026-05-10T14:00:00.000Z'),
    departedAt: new Date('2026-05-13T11:00:00.000Z'),
    createdAt: new Date(),
    reservation: {
      id: 'res-001',
      guest: makeGuest(guestOverrides),
      room: { id: 'room-101', number: '101' },
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

describe('TRAExportService', () => {
  let service: TRAExportService;
  let prismaMock: any;
  let decryptMock: ReturnType<typeof vi.fn>;
  let auditCreateMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    decryptMock = vi.fn((v: string) => 'DECRYPTED-' + v);
    auditCreateMock = vi.fn().mockResolvedValue({ id: 'log-001' });

    prismaMock = {
      stay: {
        findMany: vi.fn().mockResolvedValue([makeStay()]),
      },
      traExportLog: {
        create: vi.fn().mockResolvedValue({ id: 'log-001' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TRAExportService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: GuestEncryptionService,
          useValue: { decrypt: decryptMock },
        },
        {
          provide: TRAAuditLogRepository,
          useValue: { create: auditCreateMock },
        },
      ],
    }).compile();

    service = module.get<TRAExportService>(TRAExportService);
  });

  // ── Test 1: Buffer with UTF-8 BOM ──────────────────────────────────────────

  it('Test 1: generateCsv returns a Buffer whose first 3 bytes are the UTF-8 BOM (0xEF 0xBB 0xBF)', async () => {
    const buf = await service.generateCsv(FROM, TO, USER_ID);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
  });

  // ── Test 2: Header row exact match ────────────────────────────────────────

  it('Test 2: CSV header is exactly NombreCompleto;TipoDocumento;NumeroDocumento;Nacionalidad;FechaNacimiento;FechaIngreso;FechaSalida', async () => {
    const buf = await service.generateCsv(FROM, TO, USER_ID);
    const content = buf.toString('utf-8').replace(/^﻿/, ''); // strip BOM
    const headerLine = content.split('\r\n')[0];
    expect(headerLine).toBe(
      'NombreCompleto;TipoDocumento;NumeroDocumento;Nacionalidad;FechaNacimiento;FechaIngreso;FechaSalida',
    );
  });

  // ── Test 3: Row data — decryption + DD/MM/YYYY dates ─────────────────────

  it('Test 3: Row contains decrypted documentNumber, dates in DD/MM/YYYY, and all 7 fields', async () => {
    const buf = await service.generateCsv(FROM, TO, USER_ID);
    const content = buf.toString('utf-8').replace(/^﻿/, '');
    const lines = content.split('\r\n');
    // lines[0] = header, lines[1] = first data row
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const dataRow = lines[1];

    // Should contain the decrypted document number
    expect(dataRow).toContain('DECRYPTED-enc:iv:tag:ciphertext');
    // Date of birth 1990-05-15 → 15/05/1990
    expect(dataRow).toContain('15/05/1990');
    // arrivedAt 2026-05-10 → 10/05/2026
    expect(dataRow).toContain('10/05/2026');
    // departedAt 2026-05-13 → 13/05/2026
    expect(dataRow).toContain('13/05/2026');
    // Semicolon delimiter — should have exactly 6 delimiters per row
    const cells = dataRow.split(';');
    expect(cells.length).toBe(7);

    // decrypt was called with the encrypted value
    expect(decryptMock).toHaveBeenCalledWith('enc:iv:tag:ciphertext');
  });

  // ── Test 4: ANONYMIZED sentinel — decrypt NOT called ─────────────────────

  it('Test 4: [ANONYMIZED] documentNumber appears in CSV without calling decrypt', async () => {
    prismaMock.stay.findMany.mockResolvedValue([
      makeStay({ documentNumber: '[ANONYMIZED]' }),
    ]);

    const buf = await service.generateCsv(FROM, TO, USER_ID);
    const content = buf.toString('utf-8').replace(/^﻿/, '');

    expect(content).toContain('[ANONYMIZED]');
    expect(decryptMock).not.toHaveBeenCalled();
  });

  // ── Test 5: Date-range + departedAt NOT NULL filter (P4 memory safety) ───

  it('Test 5: findMany where includes arrivedAt gte/lte range AND departedAt not null', async () => {
    await service.generateCsv(FROM, TO, USER_ID);

    expect(prismaMock.stay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          arrivedAt: expect.objectContaining({ gte: FROM }),
          departedAt: expect.objectContaining({ not: null }),
        }),
      }),
    );
  });

  // ── Test 6: Audit log row created after successful generation ─────────────

  it('Test 6: auditLogRepo.create is called with userId, fromDate, toDate, rowCount', async () => {
    await service.generateCsv(FROM, TO, USER_ID);

    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        fromDate: FROM,
        toDate: TO,
        rowCount: 1, // one stay in mock
      }),
    );
  });

  // ── Test 7: RBAC — @Roles metadata on controller ─────────────────────────

  it('Test 7: TRAExportController.exportCsv has @Roles metadata with exactly ADMIN and MANAGER', () => {
    // SetMetadata stores metadata on the function itself, not on the prototype
    // with a property key — use Reflect.getMetadata(key, fn) not (key, proto, methodName)
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      TRAExportController.prototype.exportCsv,
    );
    expect(roles).toBeDefined();
    expect(roles).toContain('ADMIN');
    expect(roles).toContain('MANAGER');
    expect(roles).not.toContain('RECEPTION');
    expect(roles).not.toContain('HOUSEKEEPING');
    expect(roles.length).toBe(2);
  });

  // ── Test 8: Null room does NOT crash ──────────────────────────────────────

  it('Test 8: Stay with null reservation.room still produces a valid CSV row', async () => {
    prismaMock.stay.findMany.mockResolvedValue([
      {
        ...makeStay(),
        reservation: {
          ...makeStay().reservation,
          room: null,
        },
      },
    ]);

    await expect(service.generateCsv(FROM, TO, USER_ID)).resolves.toBeInstanceOf(Buffer);
  });
});
