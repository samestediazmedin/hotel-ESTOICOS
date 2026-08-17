// schedule-x decision: fallback — @schedule-x/calendar v4.6.0 does not export
// a resource/timeline view. ResourceGrid is internal-only; no createViewResource* function
// is accessible. Using pure CSS Grid fallback (RoomRackTable) instead.

// This file is the public entry point for the room rack calendar.
// ReservationsPage imports from here — it never imports RoomRackTable directly.

export { RoomRackTable as RoomRackCalendar } from './components/RoomRackTable';
export type { RoomRackRoom, MoveReservationArgs } from './components/RoomRackTable';
