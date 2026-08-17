import { z } from 'zod';

/**
 * ChatQuerySchema — validates query params for GET /api/ai-assistant/stream.
 *
 * SSE endpoints use GET with query params (EventSource limitation).
 * message: sanitized by sanitizeInput() in controller before passing to service.
 * conversationId: optional UUID — if absent, service creates a new conversation.
 */
export const ChatQuerySchema = z.object({
  message: z.string().min(1).max(2000), // pre-sanitization length cap
  conversationId: z.string().cuid().optional(),
});

export type ChatQueryDto = z.infer<typeof ChatQuerySchema>;
