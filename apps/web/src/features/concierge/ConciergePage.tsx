import { ConciergeContent } from './ConciergeContent';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ConciergePage — thin wrapper that renders ConciergeContent inside the
 * PublicConciergeLayout height envelope (100vh minus 57px header).
 *
 * The chat logic lives in ConciergeContent so the same component can be
 * rendered both here (standalone /concierge route) and inside ConciergeDrawer.
 *
 * CON-01: Accessible to anonymous visitors — no auth check, no staff sidebar.
 */
export function ConciergePage() {
  return <ConciergeContent embedded={false} />;
}
