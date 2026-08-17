import { api } from '@/lib/api';
import type { ConversationListItem, ConversationDetail } from './types';

/**
 * AI Assistant REST API client.
 *
 * Uses the JWT-aware axios instance from @/lib/api.
 * The base URL of the api instance is '/api', so paths below are relative.
 */
export const aiAssistantApi = {
  /**
   * GET /api/ai-assistant/conversations
   * Returns up to 10 most-recent conversations for the authenticated user,
   * sorted by lastMessageAt DESC.
   */
  listConversations: (): Promise<ConversationListItem[]> =>
    api.get<ConversationListItem[]>('/ai-assistant/conversations').then((r) => r.data),

  /**
   * GET /api/ai-assistant/conversations/:id
   * Loads full conversation detail with all messages.
   * Returns 404 if the conversation does not belong to the caller.
   */
  loadConversation: (id: string): Promise<ConversationDetail> =>
    api.get<ConversationDetail>(`/ai-assistant/conversations/${id}`).then((r) => r.data),

  /**
   * POST /api/ai-assistant/conversations
   * Creates an empty conversation and returns its id.
   * Used when the user sends the first message of a new chat.
   */
  createConversation: (): Promise<{ id: string }> =>
    api.post<{ id: string }>('/ai-assistant/conversations').then((r) => r.data),
};
