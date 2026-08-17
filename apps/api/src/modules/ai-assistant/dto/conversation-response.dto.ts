/**
 * conversation-response.dto.ts — DTOs for conversation list and detail endpoints.
 *
 * Used by:
 * - GET /api/ai-assistant/conversations — returns ConversationListItemDto[]
 * - GET /api/ai-assistant/conversations/:id — returns ConversationDetailDto
 * - POST /api/ai-assistant/conversations — returns { id: string }
 */

export interface ConversationListItemDto {
  id: string;
  title: string | null;
  createdAt: string;          // ISO datetime
  lastMessageAt: string | null; // ISO datetime or null if no messages yet
}

export interface MessageDto {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  contentJson: unknown;  // Structured OpenAI message — preserves tool_calls, tool_call_id
  createdAt: string;     // ISO datetime
}

export interface ConversationDetailDto extends ConversationListItemDto {
  messages: MessageDto[];
}
