import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ConciergeContent } from '@/features/concierge/ConciergeContent';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConciergeDrawerProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ConciergeDrawer — slide-over panel that embeds ConciergeContent.
 *
 * Desktop (≥768px): slides from the right, fixed width 480px.
 * Mobile (<768px): full-screen overlay.
 *
 * A11y:
 *  - role="dialog" aria-modal="true" aria-labelledby="concierge-drawer-title"
 *  - Escape key closes the drawer
 *  - Body scroll is locked while open
 *  - Focus moves to the close button on open
 *  - Backdrop click closes the drawer
 *
 * Animation: transform translateX — off-screen → on-screen, 300ms ease-out.
 */
export function ConciergeDrawer({ open, onClose }: ConciergeDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // ─── Escape key handler ──────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // ─── Body scroll lock ────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // ─── Focus management ────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      // Move focus to the close button when drawer opens
      // Small delay so the CSS transition has started
      const id = setTimeout(() => closeButtonRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          'fixed inset-0 z-40 bg-ink-1/40 transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="concierge-drawer-title"
        className={[
          // Positioning: right-side panel on desktop, full-screen on mobile
          'fixed inset-y-0 right-0 z-50 flex flex-col',
          'w-full md:w-[480px]',
          // Background and border
          'bg-warm-white shadow-2xl',
          // Slide animation
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Drawer header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-warm-line shrink-0">
          {/* Hotel logo dot */}
          <div className="w-7 h-7 rounded-full bg-terracotta flex items-center justify-center shrink-0">
            <span className="text-warm-white text-xs font-display" aria-hidden="true">
              H
            </span>
          </div>

          <h2
            id="concierge-drawer-title"
            className="font-display text-base text-ink-1 flex-1"
          >
            Concierge IA
          </h2>

          <button type="button"
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar concierge"
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-warm-paper transition-colors text-ink-3 hover:text-ink-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer body — ConciergeContent fills remaining height */}
        <div className="flex-1 overflow-hidden hos">
          <ConciergeContent embedded={true} />
        </div>
      </div>
    </>
  );
}
