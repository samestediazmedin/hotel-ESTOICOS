import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AiAssistantController } from './ai-assistant.controller';

/**
 * AiAssistantController tests — covers AI-08 and AI-11.
 *
 * Test 1: GET /conversations returns the caller's conversations
 * Test 2: GET /conversations/:id returns own conversation with messages
 * Test 3: GET /conversations/:id for another user returns 404 (not 403)
 * Test 4: GET /conversations/:id with non-existent id returns 404
 * Test 7: Controller class has @UseGuards(JwtAuthGuard) decorator (AI-08)
 */

const mockUser = { id: 'user-1', email: 'staff@hotel.com', role: 'ADMIN' };
const otherUser = { id: 'user-2', email: 'other@hotel.com', role: 'RECEPTION' };

function buildMockConvRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    listForUser: vi.fn().mockResolvedValue([
      { id: 'conv-1', title: 'Disponibilidad', createdAt: '2026-05-15T10:00:00.000Z', lastMessageAt: '2026-05-15T10:01:00.000Z' },
    ]),
    loadForUser: vi.fn().mockImplementation(async (id: string, userId: string) => {
      if (id === 'conv-1' && userId === 'user-1') {
        return {
          id: 'conv-1',
          title: 'Disponibilidad',
          createdAt: '2026-05-15T10:00:00.000Z',
          lastMessageAt: '2026-05-15T10:01:00.000Z',
          messages: [],
        };
      }
      return null; // different user OR non-existent id
    }),
    create: vi.fn().mockResolvedValue({ id: 'conv-new' }),
    ...overrides,
  };
}

const mockAiService = {
  streamChat: vi.fn(),
};

describe('AiAssistantController', () => {
  let controller: AiAssistantController;
  let mockRepo: ReturnType<typeof buildMockConvRepo>;

  beforeEach(() => {
    mockRepo = buildMockConvRepo();
    controller = new AiAssistantController(mockRepo as any, mockAiService as any);
  });

  // Test 1: GET /conversations returns caller's conversations (AI-11)
  it('Test 1: list() returns the calling user conversations ordered by lastMessageAt', async () => {
    const result = await controller.list(mockUser as any);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('conv-1');
    expect(mockRepo.listForUser).toHaveBeenCalledWith('user-1');
  });

  // Test 2: GET /conversations/:id returns own conversation (AI-11)
  it('Test 2: load() returns own conversation with messages', async () => {
    const result = await controller.load('conv-1', mockUser as any);
    expect(result.id).toBe('conv-1');
    expect(result.messages).toEqual([]);
    expect(mockRepo.loadForUser).toHaveBeenCalledWith('conv-1', 'user-1');
  });

  // Test 3: GET /conversations/:id for another user returns 404 (NOT 403 — AI-08)
  it('Test 3: load() for another users conversation returns 404, not 403', async () => {
    // Using conv-1 with user-2 — repo returns null (user isolation)
    await expect(controller.load('conv-1', otherUser as any)).rejects.toThrow(NotFoundException);
  });

  // Test 4: GET /conversations/:id with non-existent id returns 404
  it('Test 4: load() with non-existent id returns 404', async () => {
    await expect(controller.load('conv-nonexistent', mockUser as any)).rejects.toThrow(NotFoundException);
  });

  // Test 7: Controller has @UseGuards(JwtAuthGuard) at class level (AI-08)
  it('Test 7: AiAssistantController class is decorated with @UseGuards(JwtAuthGuard)', () => {
    // Reflect.getMetadata reads __guards__ set by @UseGuards decorator
    const guards = Reflect.getMetadata('__guards__', AiAssistantController);
    expect(guards).toBeDefined();
    expect(guards).toContain(JwtAuthGuard);
  });
});
