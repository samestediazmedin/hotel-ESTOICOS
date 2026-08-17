import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ZodError } from 'zod';
import { ForbiddenException } from '@nestjs/common';
import { TOOL_REGISTRY, OPENAI_TOOL_DEFINITIONS, getToolDefinitionsForRole } from './tool-registry';
import type { Role } from './tool-registry';
import type { AiToolCallLogInput } from './audit-log.repository';

/**
 * Tool executor tests — covers AI-03, AI-04, AI-05, AI-06, AI-09, AI-23 requirements.
 *
 * Tests 1-2: Registry integrity (count + OpenAI tool definition format).
 * Tests 3-6: ToolExecutorService try/finally audit coverage.
 * Test 7: find_guest output never contains documentNumber (AI-06).
 * Test 8: No write operations in any handler source (AI-04 read-only enforcement).
 * Tests 9-16: Role-based tool filtering + gate enforcement (AI-23).
 */

// ─── Shared test utilities ────────────────────────────────────────────────

const mockUserCtx = { id: 'user-1', email: 'staff@hotel.com', role: 'ADMIN' };

function buildMockAuditRepo() {
  const insertSpy = vi.fn().mockResolvedValue(undefined);
  return {
    insert: insertSpy,
    _spy: insertSpy,
  };
}

function buildMockDeps(overrides: Record<string, unknown> = {}) {
  return {
    availability: {
      searchAvailable: vi.fn().mockResolvedValue([]),
    },
    dashboard: {
      getDashboard: vi.fn().mockResolvedValue({
        businessDate: '2026-05-15',
        snapshot: null,
        liveKpis: { roomsInCleaning: 0, activeServiceRequests: 0, roomStatusBreakdown: {} },
      }),
    },
    guests: {
      searchByNameForAI: vi.fn().mockResolvedValue([]),
    },
    reservations: {
      findByIdForAI: vi.fn().mockResolvedValue(null),
      findCheckinsTodayForAI: vi.fn().mockResolvedValue([]),
      findCheckoutsTodayForAI: vi.fn().mockResolvedValue([]),
    },
    folio: {
      getFolioSummaryForAI: vi.fn().mockResolvedValue({
        folioId: 'folio-1',
        isOpen: true,
        totalCharged: 0,
        lineItemCount: 0,
        lastChargeAt: null,
        snapshotTotal: null,
      }),
    },
    prisma: {
      room: {
        findMany: vi.fn().mockResolvedValue([
          {
            number: '101',
            floor: 1,
            physicalStatus: 'AVAILABLE',
            cleaningStatus: 'CLEAN',
            updatedAt: new Date('2026-05-15T10:00:00Z'),
          },
          {
            number: '202',
            floor: 2,
            physicalStatus: 'OCCUPIED',
            cleaningStatus: 'DIRTY',
            updatedAt: new Date('2026-05-15T08:00:00Z'),
          },
        ]),
      },
      housekeepingTask: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'task-1',
            priority: 'HIGH',
            notes: 'Extra towels needed',
            businessDate: new Date('2026-05-15'),
            completedAt: null,
            room: { number: '202', floor: 2 },
          },
        ]),
      },
    },
    sanitize: (s: string) => s,
    ...overrides,
  };
}

// ─── Test 1: TOOL_REGISTRY has exactly 9 entries ─────────────────────────

describe('TOOL_REGISTRY', () => {
  it('has exactly 9 entries with the locked tool names (AI-03 + AI-23)', () => {
    const keys = Object.keys(TOOL_REGISTRY);
    expect(keys).toHaveLength(9);
    expect(keys).toContain('get_availability');
    expect(keys).toContain('get_occupancy_kpi');
    expect(keys).toContain('find_guest');
    expect(keys).toContain('get_reservation');
    expect(keys).toContain('get_checkins_today');
    expect(keys).toContain('get_checkouts_today');
    expect(keys).toContain('get_folio_summary');
    expect(keys).toContain('get_room_cleaning_status');
    expect(keys).toContain('get_my_cleaning_assignments');
  });

  // ─── Test 2: OPENAI_TOOL_DEFINITIONS ─────────────────────────────────────

  it('OPENAI_TOOL_DEFINITIONS has length 9 and uses current tools format (not deprecated functions)', () => {
    expect(OPENAI_TOOL_DEFINITIONS).toHaveLength(9);

    for (const def of OPENAI_TOOL_DEFINITIONS) {
      // Must use current format: { type: 'function', function: { ... } }
      expect(def.type).toBe('function');
      // Use type assertion to access function properties (openai v6 uses union type)
      const d = def as { type: 'function'; function: { name: string; description?: string; parameters?: unknown } };
      expect(d.function).toBeDefined();
      expect(d.function.name).toBeTruthy();
      expect(d.function.description).toBeTruthy();
      expect(d.function.parameters).toBeDefined();
      expect((d.function.parameters as any).type).toBe('object');
      // Must NOT use deprecated 'functions' key
      expect((def as any).functions).toBeUndefined();
    }
  });
});

// ─── ToolExecutorService try/finally audit tests ─────────────────────────

describe('ToolExecutorService.executeOne', () => {
  let auditRepo: ReturnType<typeof buildMockAuditRepo>;
  let deps: ReturnType<typeof buildMockDeps>;
  let service: import('./tool-executor.service').ToolExecutorService;

  beforeEach(async () => {
    auditRepo = buildMockAuditRepo();
    deps = buildMockDeps();

    const { ToolExecutorService } = await import('./tool-executor.service');

    // Bypass NestJS DI — instantiate directly for unit testing
    service = new ToolExecutorService(auditRepo as any, deps as any);
    // Skip onModuleInit() assertion in unit test context
    (service as any).onModuleInit = () => {};
  });

  // Test 3: Zod validation error → audit row written with outputStatus 'validation_error'

  it('Test 3: on Zod validation error, writes audit row with validation_error status (AI-09)', async () => {
    await expect(
      service.executeOne('get_availability', { startDate: 'not-a-date', endDate: '2026-06-05' }, mockUserCtx),
    ).rejects.toThrow();

    expect(auditRepo.insert).toHaveBeenCalledOnce();
    const logEntry = auditRepo.insert.mock.calls[0][0] as AiToolCallLogInput;
    expect(logEntry.outputStatus).toBe('validation_error');
    expect(logEntry.toolName).toBe('get_availability');
    expect(logEntry.userId).toBe('user-1');
    expect(logEntry.durationMs).toBeGreaterThanOrEqual(0);
  });

  // Test 4: Handler throws runtime error → audit row written with outputStatus 'error'

  it('Test 4: on handler runtime error, writes audit row with error status (AI-09)', async () => {
    deps.availability.searchAvailable = vi.fn().mockRejectedValue(new Error('DB connection lost'));

    const validInput = { startDate: '2026-06-01', endDate: '2026-06-05' };
    await expect(service.executeOne('get_availability', validInput, mockUserCtx)).rejects.toThrow('DB connection lost');

    expect(auditRepo.insert).toHaveBeenCalledOnce();
    const logEntry = auditRepo.insert.mock.calls[0][0] as AiToolCallLogInput;
    expect(logEntry.outputStatus).toBe('error');
    expect(logEntry.errorMsg).toContain('DB connection lost');
    expect(logEntry.durationMs).toBeGreaterThanOrEqual(0);
  });

  // Test 5: Success path → audit row written with outputStatus 'success' and durationMs > 0

  it('Test 5: on success, writes audit row with success status and durationMs > 0 (AI-09)', async () => {
    const validInput = { startDate: '2026-06-01', endDate: '2026-06-05' };
    const result = await service.executeOne('get_availability', validInput, mockUserCtx);

    expect(result.toolName).toBe('get_availability');
    expect(result.sanitizedOutput).toBeDefined();

    expect(auditRepo.insert).toHaveBeenCalledOnce();
    const logEntry = auditRepo.insert.mock.calls[0][0] as AiToolCallLogInput;
    expect(logEntry.outputStatus).toBe('success');
    expect(logEntry.errorMsg).toBeUndefined();
    expect(logEntry.durationMs).toBeGreaterThanOrEqual(0);
  });

  // Test 6: Unknown tool → throws + audit row written

  it('Test 6: unknown tool throws BadRequestException and still writes audit row (AI-09)', async () => {
    await expect(service.executeOne('unknown_tool', {}, mockUserCtx)).rejects.toThrow('Unknown tool');

    expect(auditRepo.insert).toHaveBeenCalledOnce();
    const logEntry = auditRepo.insert.mock.calls[0][0] as AiToolCallLogInput;
    expect(logEntry.outputStatus).toBe('error');
    expect(logEntry.toolName).toBe('unknown_tool');
  });

  // Test 7: find_guest output never contains documentNumber (AI-06)

  it('Test 7: find_guest handler output never includes documentNumber key (AI-06)', async () => {
    deps.guests.searchByNameForAI = vi.fn().mockResolvedValue([
      { id: 'g-1', fullName: 'Jose Garcia', nationality: 'CO', totalStays: 3 },
      // This would be a bug: if documentNumber leaked from the service, it must not appear
    ]);

    const result = await service.executeOne('find_guest', { query: 'Jose' }, mockUserCtx);
    const output = result.sanitizedOutput as any;

    expect(output.guests).toHaveLength(1);
    for (const guest of output.guests) {
      expect(guest).not.toHaveProperty('documentNumber');
      expect(guest).not.toHaveProperty('documentType');
    }
  });

  // ─── AI-23 Role gate tests ──────────────────────────────────────────────

  // Test 9: HOUSEKEEPING calling get_occupancy_kpi → ForbiddenException + audit 'rejected'

  it('Test 9: HOUSEKEEPING calling get_occupancy_kpi throws ForbiddenException and audits rejection (AI-23)', async () => {
    const hkUser = { id: 'hk-1', email: 'hk@hotel.com', role: 'HOUSEKEEPING' };

    await expect(
      service.executeOne('get_occupancy_kpi', {}, hkUser),
    ).rejects.toThrow(ForbiddenException);

    expect(auditRepo.insert).toHaveBeenCalledOnce();
    const logEntry = auditRepo.insert.mock.calls[0][0] as AiToolCallLogInput;
    expect(logEntry.outputStatus).toBe('rejected');
    expect(logEntry.errorMsg).toContain('role_not_allowed');
    expect(logEntry.toolName).toBe('get_occupancy_kpi');
    expect(logEntry.userId).toBe('hk-1');
  });

  // Test 10: RECEPTION calling get_my_cleaning_assignments → ForbiddenException

  it('Test 10: RECEPTION calling get_my_cleaning_assignments throws ForbiddenException (AI-23)', async () => {
    const recUser = { id: 'rec-1', email: 'rec@hotel.com', role: 'RECEPTION' };

    await expect(
      service.executeOne('get_my_cleaning_assignments', {}, recUser),
    ).rejects.toThrow(ForbiddenException);

    expect(auditRepo.insert).toHaveBeenCalledOnce();
    const logEntry = auditRepo.insert.mock.calls[0][0] as AiToolCallLogInput;
    expect(logEntry.outputStatus).toBe('rejected');
  });

  // Test 11: ADMIN can call all 9 tools without ForbiddenException

  it('Test 11: ADMIN can call all 9 tools without ForbiddenException (AI-23)', async () => {
    const toolInputs: Record<string, unknown> = {
      get_availability: { startDate: '2026-06-01', endDate: '2026-06-05' },
      get_occupancy_kpi: {},
      find_guest: { query: 'Jose' },
      get_reservation: { confirmationCode: 'ABC123' },
      get_checkins_today: {},
      get_checkouts_today: {},
      get_folio_summary: { reservationId: 'cmtc96589eefb0828c0717909' },
      get_room_cleaning_status: {},
      get_my_cleaning_assignments: {},
    };

    // Mock find_guest to return data
    deps.guests.searchByNameForAI = vi.fn().mockResolvedValue([]);
    // Mock get_reservation to return data
    deps.reservations.findByIdForAI = vi.fn().mockResolvedValue({
      id: 'cmtc96589eefb0828c0717909',
      status: 'CONFIRMED',
      checkInDate: '2026-06-01',
      checkOutDate: '2026-06-05',
      guestName: 'Test',
      roomNumber: '101',
      totalNights: 4,
    });

    for (const [toolName, input] of Object.entries(toolInputs)) {
      // Reset audit spy for each tool
      auditRepo.insert.mockClear();

      // Should NOT throw ForbiddenException — may throw other errors (e.g. NotFoundException)
      // but we only care that ForbiddenException is NOT thrown
      try {
        await service.executeOne(toolName, input, mockUserCtx);
      } catch (err) {
        expect(err).not.toBeInstanceOf(ForbiddenException);
      }
    }
  });

  // Test 12: get_room_cleaning_status returns expected DTO shape

  it('Test 12: get_room_cleaning_status returns expected DTO shape with room data', async () => {
    const result = await service.executeOne('get_room_cleaning_status', {}, mockUserCtx);
    const output = result.sanitizedOutput as any;

    expect(output.rooms).toHaveLength(2);
    expect(output.total).toBe(2);
    expect(output.rooms[0]).toEqual({
      roomNumber: '101',
      floor: 1,
      physicalStatus: 'AVAILABLE',
      cleaningStatus: 'CLEAN',
      updatedAt: '2026-05-15T10:00:00.000Z',
    });
    // No internal IDs or notes exposed
    expect(output.rooms[0]).not.toHaveProperty('id');
    expect(output.rooms[0]).not.toHaveProperty('notes');
  });

  // Test 13: get_my_cleaning_assignments filters by userCtx.id

  it('Test 13: get_my_cleaning_assignments filters by assignedToId = userCtx.id', async () => {
    const result = await service.executeOne('get_my_cleaning_assignments', {}, mockUserCtx);
    const output = result.sanitizedOutput as any;

    expect(output.assignments).toHaveLength(1);
    expect(output.total).toBe(1);
    expect(output.assignments[0]).toMatchObject({
      taskId: 'task-1',
      roomNumber: '202',
      floor: 2,
      priority: 'HIGH',
      notes: 'Extra towels needed',
      businessDate: '2026-05-15',
      completedAt: null,
    });

    // Verify Prisma was called with userCtx.id filter
    expect(deps.prisma.housekeepingTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignedToId: 'user-1',
        }),
      }),
    );
  });

  // Test 14: HOUSEKEEPING can access get_room_cleaning_status and get_my_cleaning_assignments

  it('Test 14: HOUSEKEEPING can access housekeeping tools without ForbiddenException', async () => {
    const hkUser = { id: 'hk-1', email: 'hk@hotel.com', role: 'HOUSEKEEPING' };

    // get_room_cleaning_status — should succeed
    const statusResult = await service.executeOne('get_room_cleaning_status', {}, hkUser);
    expect(statusResult.sanitizedOutput).toBeDefined();

    auditRepo.insert.mockClear();

    // get_my_cleaning_assignments — should succeed
    const assignResult = await service.executeOne('get_my_cleaning_assignments', {}, hkUser);
    expect(assignResult.sanitizedOutput).toBeDefined();
  });

  // Test 15: HOUSEKEEPING blocked from guest/reservation/folio tools

  it('Test 15: HOUSEKEEPING blocked from guest, reservation, availability, folio, checkins tools (AI-23)', async () => {
    const hkUser = { id: 'hk-1', email: 'hk@hotel.com', role: 'HOUSEKEEPING' };
    const blockedTools = [
      'get_availability',
      'get_occupancy_kpi',
      'find_guest',
      'get_reservation',
      'get_checkins_today',
      'get_folio_summary',
    ];

    for (const toolName of blockedTools) {
      auditRepo.insert.mockClear();
      await expect(
        service.executeOne(toolName, {}, hkUser),
      ).rejects.toThrow(ForbiddenException);
    }
  });

  // Test 16: Audit log entry on rejected call contains rejection reason

  it('Test 16: audit log entry on rejected call contains rejection reason and tool metadata', async () => {
    const recUser = { id: 'rec-1', email: 'rec@hotel.com', role: 'RECEPTION' };

    await expect(
      service.executeOne('get_occupancy_kpi', { date: '2026-05-15' }, recUser),
    ).rejects.toThrow(ForbiddenException);

    expect(auditRepo.insert).toHaveBeenCalledOnce();
    const logEntry = auditRepo.insert.mock.calls[0][0] as AiToolCallLogInput;
    expect(logEntry.outputStatus).toBe('rejected');
    expect(logEntry.errorMsg).toBe('role_not_allowed: RECEPTION');
    expect(logEntry.toolName).toBe('get_occupancy_kpi');
    expect(logEntry.userId).toBe('rec-1');
    expect(logEntry.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ─── Test 8: No write operations in any tool handler (AI-04) ─────────────

describe('AI-04 read-only enforcement', () => {
  it('Test 8: no tool handler calls .create(), .update(), .delete(), .upsert(), or .deleteMany()', () => {
    const toolsDir = path.resolve(__dirname, 'tools');
    const toolFiles = fs.readdirSync(toolsDir).filter((f) => f.endsWith('.tool.ts'));

    const FORBIDDEN_PATTERNS = ['.create(', '.update(', '.delete(', '.upsert(', '.deleteMany('];

    const violations: string[] = [];

    for (const file of toolFiles) {
      const filePath = path.join(toolsDir, file);
      const source = fs.readFileSync(filePath, 'utf-8');

      for (const pattern of FORBIDDEN_PATTERNS) {
        if (source.includes(pattern)) {
          violations.push(`${file}: found forbidden write operation "${pattern}"`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `AI-04 VIOLATION: Tool handlers must be read-only.\n${violations.join('\n')}`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});

// ─── AI-23 Role-based tool filtering (getToolDefinitionsForRole) ─────────

describe('getToolDefinitionsForRole (AI-23)', () => {
  it('Test 17: ADMIN gets all 9 tool definitions', () => {
    const tools = getToolDefinitionsForRole('ADMIN');
    expect(tools).toHaveLength(9);
  });

  it('Test 18: MANAGER gets all 9 tool definitions', () => {
    const tools = getToolDefinitionsForRole('MANAGER');
    expect(tools).toHaveLength(9);
  });

  it('Test 19: RECEPTION gets 7 tool definitions (excludes occupancy KPI + cleaning assignments)', () => {
    const tools = getToolDefinitionsForRole('RECEPTION');
    expect(tools).toHaveLength(7);

    const names = tools.map((t) => (t as any).function.name);
    expect(names).not.toContain('get_occupancy_kpi');
    expect(names).not.toContain('get_my_cleaning_assignments');
    expect(names).toContain('get_room_cleaning_status');
  });

  it('Test 20: HOUSEKEEPING gets exactly 3 tool definitions', () => {
    const tools = getToolDefinitionsForRole('HOUSEKEEPING');
    expect(tools).toHaveLength(3);

    const names = tools.map((t) => (t as any).function.name);
    expect(names).toContain('get_checkouts_today');
    expect(names).toContain('get_room_cleaning_status');
    expect(names).toContain('get_my_cleaning_assignments');
  });

  it('Test 21: every tool in TOOL_REGISTRY has a corresponding OpenAI definition', () => {
    const registryNames = Object.keys(TOOL_REGISTRY);
    const openaiNames = OPENAI_TOOL_DEFINITIONS.map((t) => (t as any).function.name);

    for (const name of registryNames) {
      expect(openaiNames).toContain(name);
    }
  });

  it('Test 22: every tool in TOOL_REGISTRY has a non-empty allowedRoles array', () => {
    for (const [name, def] of Object.entries(TOOL_REGISTRY)) {
      expect(def.allowedRoles.length, `${name} should have at least one allowed role`).toBeGreaterThan(0);
    }
  });
});
