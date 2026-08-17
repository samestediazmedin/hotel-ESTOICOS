// ─── Venue types ──────────────────────────────────────────────────────────────

export type VenueType =
  | 'RESTAURANT'
  | 'BAR'
  | 'CAFE'
  | 'MUSEUM'
  | 'PARK'
  | 'SHOPPING'
  | 'NIGHTLIFE'
  | 'TRANSPORT_HUB'
  | 'EVENT_VENUE'
  | 'OTHER';

export interface VenueCardData {
  id: string;
  name: string;
  type: VenueType;
  /** Raw Foursquare category name (e.g. "Italian Restaurant") — used as subtitle. */
  category?: string | null;
  rating: number | null;
  distanceKm: number;
  /** Real venue photo (Foursquare Premium). Currently always null on the free tier. */
  photoUrl: string | null;
  /** Foursquare category PNG icon (64×64) — visual identity in lieu of a real photo. */
  categoryIconUrl?: string | null;
  mapsUrl: string | null;
  phone: string | null;
  reservationUrl: string | null;
  address: string | null;
}

// ─── SSE event union ──────────────────────────────────────────────────────────

export type SseEvent =
  | { type: 'content_delta'; text: string }
  | { type: 'tool_call_start'; toolName: string; toolCallId: string }
  | { type: 'tool_result'; toolName: string; toolCallId: string; result: unknown }
  | { type: 'message_stop'; finishReason: string }
  | { type: 'budget_exceeded'; message: string }
  | { type: 'error'; message: string };

// ─── Chat message ─────────────────────────────────────────────────────────────

export interface ConciergeMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isStreaming: boolean;
  toolResults?: VenueCardData[];
  error?: string;
}
