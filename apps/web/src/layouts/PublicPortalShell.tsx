import { Outlet } from 'react-router-dom';
import { ConciergeDrawer } from '@/features/public-portal/components/ConciergeDrawer';
import { ConciergeFab } from '@/features/concierge/components/ConciergeFab';
import { useConciergeStore } from '@/features/concierge/concierge.store';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PublicPortalShell — wraps ALL public-facing routes (/, /booking/*, /concierge,
 * /review/submit) to provide two persistent concierge elements:
 *
 * 1. ConciergeFab — floating button bottom-right, always visible (hides when drawer open)
 * 2. ConciergeDrawer — slide-over panel shared across all public pages
 *
 * Both read/write from the same zustand store (isDrawerOpen / openDrawer / closeDrawer),
 * so the guest can open the concierge from any page without losing chat state.
 *
 * No layout chrome here — each page manages its own nav/footer. This shell
 * only adds the concierge overlay layer.
 */
export function PublicPortalShell() {
  const isDrawerOpen = useConciergeStore((s) => s.isDrawerOpen);
  const closeDrawer = useConciergeStore((s) => s.closeDrawer);

  return (
    <>
      <Outlet />
      <ConciergeFab />
      <ConciergeDrawer open={isDrawerOpen} onClose={closeDrawer} />
    </>
  );
}
