import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { useConciergeStore } from '../concierge.store';

// ─── Session-storage key for one-time bubble dismissal ──────────────────────

const BUBBLE_DISMISSED_KEY = 'concierge-bubble-dismissed';

function isBubbleDismissed(): boolean {
  try {
    return sessionStorage.getItem(BUBBLE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function markBubbleDismissed(): void {
  try {
    sessionStorage.setItem(BUBBLE_DISMISSED_KEY, '1');
  } catch {
    /* sessionStorage unavailable — bubble will reappear, acceptable fallback */
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ConciergeFab — persistent floating action button + one-time attention bubble.
 *
 * Phase 2 visibility upgrade:
 * - Larger pill shape, ALWAYS shows label (not icon-only on any viewport)
 * - Subtle pulse ring animation draws the eye without being obnoxious
 * - 3s after mount, shows an attention bubble ("¿Le ayudo a planear su estadía?")
 *   that invites a click. Dismissed via X button or by opening the drawer.
 *   Once dismissed, does not reappear for the session (sessionStorage).
 *
 * A11y: focusable, keyboard-activatable, aria-labels, focus-visible ring.
 *       Dismiss button is keyboard-reachable. All animations respect
 *       prefers-reduced-motion via CSS (animation: none).
 * Mobile: bottom-20 clearance for the reservation bar.
 */
export function ConciergeFab() {
  const isDrawerOpen = useConciergeStore((s) => s.isDrawerOpen);
  const openDrawer = useConciergeStore((s) => s.openDrawer);
  const { pathname } = useLocation();

  const [showBubble, setShowBubble] = useState(false);

  // Show attention bubble 3s after mount (one-time per session)
  useEffect(() => {
    if (isBubbleDismissed() || isDrawerOpen || pathname === '/concierge') return;

    const timer = setTimeout(() => {
      // Re-check in case drawer opened during the 3s wait
      if (!isBubbleDismissed()) {
        setShowBubble(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isDrawerOpen, pathname]);

  // Dismiss the bubble and persist to sessionStorage
  const dismissBubble = useCallback(() => {
    setShowBubble(false);
    markBubbleDismissed();
  }, []);

  // Opening the drawer also dismisses the bubble
  const handleOpenDrawer = useCallback(() => {
    dismissBubble();
    openDrawer();
  }, [dismissBubble, openDrawer]);

  // Don't render on /concierge page or when drawer is open
  if (isDrawerOpen || pathname === '/concierge') return null;

  return (
    <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-30 flex flex-col items-end gap-3">
      {/* ── Attention bubble ─────────────────────────────────────────────── */}
      {showBubble && (
        <div
          role="status"
          aria-live="polite"
          className="
            animate-bubble-in
            relative max-w-[280px] sm:max-w-xs
            rounded-2xl rounded-br-sm
            bg-warm-white border border-warm-line-strong
            shadow-xl shadow-ink-1/8
            p-4 pr-9
            text-sm leading-relaxed text-ink-2
          "
        >
          <button
            type="button"
            onClick={dismissBubble}
            aria-label="Cerrar sugerencia del concierge"
            className="
              absolute top-2 right-2
              flex items-center justify-center
              w-6 h-6 rounded-full
              text-ink-3 hover:text-ink-1 hover:bg-warm-cream
              transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-1
              cursor-pointer
            "
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleOpenDrawer}
            className="text-left cursor-pointer"
          >
            <span className="font-medium text-ink-1">
              ¿Le ayudo a planear su estadía?
            </span>{' '}
            Pregúnteme por disponibilidad, planes cercanos o información del hotel.
          </button>

          {/* Tail triangle pointing down-right toward the FAB */}
          <div
            className="absolute -bottom-2 right-4 w-4 h-4 bg-warm-white border-b border-r border-warm-line-strong rotate-45"
            aria-hidden="true"
          />
        </div>
      )}

      {/* ── FAB button ───────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Pulse ring — sits behind the button */}
        <span
          aria-hidden="true"
          className="
            absolute inset-0
            rounded-full
            bg-terracotta/20
            animate-concierge-ping
          "
        />

        <button
          type="button"
          onClick={handleOpenDrawer}
          aria-label="Abrir concierge — asistente virtual del hotel"
          className="
            relative
            flex items-center gap-2.5
            rounded-full bg-terracotta text-warm-white
            shadow-lg shadow-terracotta/30
            px-5 py-3.5 sm:px-6 sm:py-4
            text-sm sm:text-base font-semibold
            tracking-wide
            transition-all duration-300
            hover:bg-terracotta-deep hover:shadow-xl hover:shadow-terracotta/40
            hover:scale-[1.04]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-warm-white
            animate-fab-glow
            cursor-pointer
          "
        >
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
          <span>¿Le ayudo?</span>
        </button>
      </div>
    </div>
  );
}
