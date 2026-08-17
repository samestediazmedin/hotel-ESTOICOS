/**
 * ContactEventResponseDto — shape returned by POST and GET /api/guests/:id/contact-events
 *
 * Dates are serialized as ISO strings for JSON transport.
 */
export interface ContactEventResponseDto {
  id: string;
  guestId: string;
  staffUserId: string;
  method: 'CALL' | 'WHATSAPP' | 'EMAIL';
  notes: string | null;
  createdAt: string; // ISO string
  staffUser: {
    id: string;
    name: string | null;
    email: string;
  };
}
