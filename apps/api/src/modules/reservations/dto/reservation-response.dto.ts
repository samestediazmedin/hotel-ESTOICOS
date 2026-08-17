/**
 * ReservationResponseDto — shape returned to staff callers.
 * Uses declare keyword to satisfy strictPropertyInitialization.
 */
export class ReservationResponseDto {
  declare id: string;
  declare guestId: string;
  declare roomId: string | null;
  declare roomTypeId: string;
  declare checkInDate: string;   // ISO date string "YYYY-MM-DD"
  declare checkOutDate: string;  // ISO date string "YYYY-MM-DD"
  declare status: string;
  declare source: string;
  declare adults: number;
  declare children: number;
  declare totalNights: number;
  declare notes: string | null;
  declare createdAt: string;
  declare updatedAt: string;
}
