import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ConversationListItemDto, ConversationDetailDto, MessageDto } from './dto/conversation-response.dto';

/**
 * ConversationRepository — Prisma wrapper for AIConversation + AIMessage.
 *
 * AI-11: listForUser returns conversations ordered by lastMessageAt DESC NULLS LAST.
 * AI-08: loadForUser scopes by userId — never returns another user's conversation.
 *
 * Note: AIMessage.content stores JSON string for tool/assistant roles.
 * For compatibility with the existing schema where content is String,
 * we store the JSON-stringified content and parse on read.
 */
@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * listForUser — returns paginated conversation list for a user.
   * Ordered by lastMessageAt DESC NULLS LAST (most recent first, null goes last).
   */
  async listForUser(userId: string, limit = 50): Promise<ConversationListItemDto[]> {
    const rows = await (this.prisma as any).aIConversation.findMany({
      where: { userId },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        lastMessageAt: true,
      },
    });

    return rows.map((r: any) => ({
      id: r.id,
      title: r.title ?? null,
      createdAt: r.createdAt.toISOString(),
      lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
    }));
  }

  /**
   * loadForUser — returns a conversation with its messages, scoped to the owner.
   * Returns null if not found OR if the conversation belongs to a different user.
   * (404 not 403 — avoids leaking existence per AI-08 security requirement)
   */
  async loadForUser(id: string, userId: string): Promise<ConversationDetailDto | null> {
    const conv = await (this.prisma as any).aIConversation.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conv) return null;

    const messages: MessageDto[] = conv.messages.map((m: any) => {
      // Try to parse content as JSON (tool/assistant roles store structured data)
      let contentJson: unknown;
      try {
        contentJson = JSON.parse(m.content);
      } catch {
        contentJson = m.content; // plain string for simple user messages
      }

      return {
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'tool',
        contentJson,
        createdAt: m.createdAt.toISOString(),
      };
    });

    return {
      id: conv.id,
      title: conv.title ?? null,
      createdAt: conv.createdAt.toISOString(),
      lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : null,
      messages,
    };
  }

  /**
   * create — creates a new empty conversation for the user.
   * Returns the conversation id for the client to use in subsequent messages.
   */
  async create(userId: string, title?: string): Promise<{ id: string }> {
    const conv = await (this.prisma as any).aIConversation.create({
      data: { userId, title: title ?? null },
      select: { id: true },
    });
    return { id: conv.id };
  }

  /**
   * appendMessage — adds a message to an existing conversation.
   * Plan 07-02 uses this to persist assistant turns and tool results.
   */
  async appendMessage(
    conversationId: string,
    role: string,
    contentJson: unknown,
  ): Promise<void> {
    const content = typeof contentJson === 'string' ? contentJson : JSON.stringify(contentJson);
    await (this.prisma as any).aIMessage.create({
      data: { conversationId, role, content },
    });
  }

  /**
   * touchLastMessageAt — updates lastMessageAt to NOW() and auto-generates title
   * from the first 60 chars of the user message if title is not yet set.
   *
   * Called by Plan 07-02 AiAssistantService after message insertion.
   */
  async touchLastMessageAt(conversationId: string, firstUserMessage?: string): Promise<void> {
    const conv = await (this.prisma as any).aIConversation.findUnique({
      where: { id: conversationId },
      select: { title: true },
    });

    const updateData: Record<string, unknown> = { lastMessageAt: new Date() };

    if (conv && !conv.title && firstUserMessage) {
      updateData['title'] = firstUserMessage.slice(0, 60);
    }

    await (this.prisma as any).aIConversation.update({
      where: { id: conversationId },
      data: updateData,
    });
  }
}
