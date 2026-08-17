/**
 * tool-output.dto.ts — Explicit return-type interfaces for each AI tool.
 *
 * These are NOT Prisma types — they are explicit DTOs that define the exact
 * shape the LLM receives. Using explicit DTOs (not Prisma types) prevents
 * accidentally including PII fields that appear in DB rows but should not
 * enter the LLM context (AI-06).
 *
 * Caps: availability max 20; checkins/checkouts max 50; find_guest max 10.
 */

// ─── get_availability ──────────────────────────────────────────────────────

export interface AvailableRoomDto {
  roomId: string;
  roomNumber: string;
  typeName: string;
  floor: number;
  pricePerNight: number; // COP integer
}

export interface GetAvailabilityOutputDto {
  rooms: AvailableRoomDto[];
  truncated: boolean;
  total: number;
}

// ─── get_occupancy_kpi ────────────────────────────────────────────────────

export interface GetOccupancyKpiOutputDto {
  businessDate: string;     // YYYY-MM-DD
  occupancyPct: number;     // 0..1 — frontend multiplies by 100
  adr: number;              // COP integer (Average Daily Rate)
  revpar: number;           // COP integer (Revenue Per Available Room)
  totalRevenue: number;     // COP integer
  arrivalsCount: number;
  departuresCount: number;
  noDataAvailable?: boolean; // true when no night audit has run yet
}

// ─── find_guest ────────────────────────────────────────────────────────────

export interface GuestAiDto {
  id: string;
  fullName: string;
  nationality: string;
  totalStays: number;
  // documentNumber intentionally ABSENT — stricter than staff two-DTO (AI-06)
}

export interface FindGuestOutputDto {
  guests: GuestAiDto[];
  truncated: boolean;
  total: number;
}

// ─── get_reservation ──────────────────────────────────────────────────────

export interface GetReservationOutputDto {
  id: string;
  status: string;
  checkInDate: string;    // YYYY-MM-DD
  checkOutDate: string;   // YYYY-MM-DD
  guestName: string;
  roomNumber: string | null;
  totalNights: number;
}

// ─── get_checkins_today ───────────────────────────────────────────────────

export interface CheckinTodayItemDto {
  reservationId: string;
  guestName: string;
  roomNumber: string | null;
  checkInDate: string;    // YYYY-MM-DD
  status: string;
}

export interface GetCheckinsTodayOutputDto {
  checkins: CheckinTodayItemDto[];
  truncated: boolean;
  total: number;
}

// ─── get_checkouts_today ──────────────────────────────────────────────────

export interface CheckoutTodayItemDto {
  reservationId: string;
  guestName: string;
  roomNumber: string | null;
  checkOutDate: string;   // YYYY-MM-DD
  folioBalance: number;   // COP integer
}

export interface GetCheckoutsTodayOutputDto {
  checkouts: CheckoutTodayItemDto[];
  truncated: boolean;
  total: number;
}

// ─── get_folio_summary ────────────────────────────────────────────────────

export interface GetFolioSummaryOutputDto {
  folioId: string;
  isOpen: boolean;
  totalCharged: number;       // COP integer (sum of amounts, no line item descriptions)
  lineItemCount: number;
  lastChargeAt: string | null; // ISO timestamp or null if no charges
  snapshotTotal: number | null; // COP integer from closed folio hash, null if open
}

// ─── get_room_cleaning_status ────────────────────────────────────────────

export interface RoomCleaningStatusDto {
  roomNumber: string;
  floor: number;
  physicalStatus: string;
  cleaningStatus: string;
  updatedAt: string;          // ISO timestamp
}

export interface GetRoomCleaningStatusOutputDto {
  rooms: RoomCleaningStatusDto[];
  total: number;
}

// ─── get_my_cleaning_assignments ─────────────────────────────────────────

export interface CleaningAssignmentDto {
  taskId: string;
  roomNumber: string;
  floor: number;
  priority: string;
  notes: string | null;
  businessDate: string;       // YYYY-MM-DD
  completedAt: string | null; // ISO timestamp or null
}

export interface GetMyCleaningAssignmentsOutputDto {
  assignments: CleaningAssignmentDto[];
  total: number;
}
