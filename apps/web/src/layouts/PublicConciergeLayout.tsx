import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useForceLightTheme } from '@/features/public-portal/hooks/useForceLightTheme';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PublicConciergeLayoutProps {
  children: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PublicConciergeLayout — public-facing layout for /concierge.
 *
 * CRITICAL: NO Sidebar, NO useAuthStore, NO ProtectedRoute dependency.
 * Distinct from StaffLayout — this is accessible to anonymous visitors.
 *
 * Mobile-first: full-screen on mobile, max-w-2xl centered on desktop.
 *
 * `hos` class on root ensures CSS token vars are available even when rendered
 * outside StaffLayout. `useForceLightTheme` prevents dark-mode from leaking
 * in from staff screens.
 */
export function PublicConciergeLayout({ children }: PublicConciergeLayoutProps) {
  useForceLightTheme();

  return (
    <div className="hos min-h-screen bg-warm-paper flex flex-col">
      {/* Hotel branding header — lightweight, no staff nav */}
      <header className="border-b border-warm-line bg-warm-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Back to home */}
          <Link
            to="/"
            aria-label="Volver al hotel"
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-warm-paper transition-colors text-ink-3 hover:text-ink-1 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2">
            {/* Minimal hotel logo placeholder */}
            <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center">
              <span className="text-warm-white text-xs font-display">H</span>
            </div>
            <span className="font-display text-ink-1 text-base sm:text-lg">
              Concierge del Hotel
            </span>
          </div>
          <span className="ml-auto text-xs text-ink-4 hidden sm:block">
            Bogotá, Colombia
          </span>
        </div>
      </header>

      {/* Main content — full width on mobile, centered on desktop */}
      <main className="flex-1 max-w-2xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
