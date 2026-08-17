import { z } from 'zod';

/**
 * ChatMessageSchema — Zod schema for POST /api/concierge/chat request body.
 *
 * message: 1-500 chars (matches sanitizeConciergeInput max cap).
 * sessionCookie: optional opaque session identifier (max 64 chars) for audit
 *   log correlation across turns. Not used for auth — the endpoint is public.
 */
export const ChatMessageSchema = z.object({
  message: z.string().min(1).max(500),
  sessionCookie: z.string().max(64).optional(),
});

export type ChatMessageDto = z.infer<typeof ChatMessageSchema>;
