/**
 * Guest contact event types — Phase 16 (GCC-08, GCC-11)
 *
 * These types mirror the backend DTOs from apps/api/src/modules/guest-contact/.
 * Keep in sync if backend shapes change.
 */

export type ContactMethod = 'CALL' | 'WHATSAPP' | 'EMAIL';

/**
 * Full contact event DTO returned by the REST API.
 * Matches ContactEventResponseDto from 16-01.
 */
export interface GuestContactEventDto {
  id: string;
  guestId: string;
  staffUserId: string;
  method: ContactMethod;
  notes: string | null;
  createdAt: string; // ISO 8601
  staffUser: {
    id: string;
    name: string | null;
    email: string;
  };
}

/**
 * Payload emitted over Socket.io on 'contact-event.created'.
 * staffUserName comes from the backend DB JOIN — treat as authoritative.
 * Never substitute user.name from the auth store for toast display (trap #6).
 */
export interface ContactEventSocketPayload {
  eventId: string;
  guestId: string;
  method: ContactMethod;
  staffUserId: string;
  staffUserName: string; // DB-joined, authoritative — use for toast text
  createdAt: string; // ISO 8601
}

/**
 * Condensed summary of the most recent contact event, embedded in the
 * guests list response (GET /api/guests) to power the "Último contacto"
 * column without N+1 queries.
 * Added by 16-02's GuestsRepository.findAll() include extension.
 */
export interface LastContactEventSummary {
  method: ContactMethod;
  createdAt: string; // ISO 8601
  staffUserName: string | null;
}
