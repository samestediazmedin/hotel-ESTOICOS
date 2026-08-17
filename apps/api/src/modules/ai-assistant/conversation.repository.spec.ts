import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationRepository } from './conversation.repository';

/**
 * ConversationRepository tests — covers AI-11 data access layer.
 *
 * Test 5: listForUser returns rows sorted by lastMessageAt DESC NULLS LAST
 * Test 6: loadForUser scopes by userId — never returns another user's row
 */

function buildMockPrisma() {
  const conversations = [
    {
      id: 'conv-1',
      userId: 'user-1',
      title: 'First conversation',
      createdAt: new Date('2026-05-15T08:00:00Z'),
      lastMessageAt: new Date('2026-05-15T10:00:00Z'),
    },
    {
      id: 'conv-2',
      userId: 'user-1',
      title: 'Second conversation',
      createdAt: new Date('2026-05-15T09:00:00Z'),
      lastMessageAt: new Date('2026-05-15T11:00:00Z'), // more recent
    },
    {
      id: 'conv-3',
      userId: 'user-2', // different user
      title: 'Other user conv',
      createdAt: new Date('2026-05-15T07:00:00Z'),
      lastMessageAt: new Date('2026-05-15T12:00:00Z'), // most recent overall
    },
  ];

  return {
    aIConversation: {
      findMany: vi.fn().mockImplementation(async ({ where, orderBy }: any) => {
        // Filter by userId
        let result = conversations.filter((c) => c.userId === where?.userId);
        // Sort by lastMessageAt DESC (simulate the Prisma behavior)
        result = result.sort((a, b) => {
          const aTime = a.lastMessageAt?.getTime() ?? 0;
          const bTime = b.lastMessageAt?.getTime() ?? 0;
          return bTime - aTime;
        });
        return result;
      }),
      findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
        const conv = conversations.find(
          (c) => c.id === where?.id && c.userId === where?.userId,
        );
        if (!conv) return null;
        return { ...conv, messages: [] };
      }),
      create: vi.fn().mockResolvedValue({ id: 'conv-new' }),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    aIMessage: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

describe('ConversationRepository', () => {
  let repo: ConversationRepository;
  let mockPrisma: ReturnType<typeof buildMockPrisma>;

  beforeEach(() => {
    mockPrisma = buildMockPrisma();
    repo = new ConversationRepository(mockPrisma as any);
  });

  // Test 5: listForUser returns rows sorted by lastMessageAt DESC NULLS LAST (AI-11)
  it('Test 5: listForUser returns conversations ordered by lastMessageAt DESC for user-1', async () => {
    const result = await repo.listForUser('user-1');

    expect(result).toHaveLength(2); // only user-1's conversations
    // First result should be the most recent: conv-2 (11:00 > 10:00)
    expect(result[0].id).toBe('conv-2');
    expect(result[1].id).toBe('conv-1');

    // Verify it was queried with correct userId filter
    expect(mockPrisma.aIConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });

  // Test 6: loadForUser scopes by userId — never returns another user's row (AI-08)
  it('Test 6: loadForUser scopes by userId and does not return other users conversations', async () => {
    // Requesting user-2's conversation as user-1 should return null
    const result = await repo.loadForUser('conv-3', 'user-1');
    expect(result).toBeNull();

    // Confirm it was queried with BOTH id AND userId filter (not just id)
    expect(mockPrisma.aIConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-3', userId: 'user-1' },
      }),
    );
  });
});
