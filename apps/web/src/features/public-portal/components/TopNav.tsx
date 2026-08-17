import { Link } from 'react-router-dom';
import { Star, LogIn } from 'lucide-react';

interface TopNavProps {
  hotelName: string;
  onNavClick: (id: string) => void;
  onConciergeClick: () => void;
  /**
   * 2026-05-28 — hide the "Ofertas" item when there are no active offers,
   * so the nav doesn't link to a section that won't be rendered.
   */
  showOffers?: boolean;
}

const BASE_NAV_ITEMS: { label: string; id: string }[] = [
  { label: 'Inicio', id: 'inicio' },
  { label: 'Habitaciones', id: 'habitaciones' },
  { label: 'Concierge', id: 'concierge' },
  { label: 'Ubicación', id: 'ubicacion' },
];

function HotelNameDisplay({ hotelName }: { hotelName: string }) {
  const parts = hotelName.split(' ');
  const first = parts[0];
  const rest = parts.slice(1).join(' ');
  return (
    <span className="font-display text-lg text-ink-1">
      {first}
      {rest && (
        <>
          {' '}
          <i className="italic">{rest}</i>
        </>
      )}
    </span>
  );
}

export function TopNav({ hotelName, onNavClick, onConciergeClick, showOffers = false }: TopNavProps) {
  // Insert "Ofertas" right after "Habitaciones" so it sits in the natural flow.
  const navItems = (() => {
    if (!showOffers) return BASE_NAV_ITEMS;
    const items = [...BASE_NAV_ITEMS];
    const habIdx = items.findIndex((i) => i.id === 'habitaciones');
    const offerItem = { label: 'Ofertas', id: 'ofertas' };
    items.splice(habIdx + 1, 0, offerItem);
    return items;
  })();

  return (
    <nav className="sticky top-0 z-40 bg-warm-white/95 backdrop-blur border-b border-warm-line">
      <div className="max-w-7xl mx-auto px-4 lg:px-12 h-16 flex items-center gap-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-9 w-9 rounded-full bg-terracotta text-warm-white font-display text-base flex items-center justify-center select-none">
            H
          </div>
          <HotelNameDisplay hotelName={hotelName} />
        </Link>

        {/* Anchor links — desktop only */}
        <div className="hidden md:flex gap-6 flex-1">
          {navItems.map(({ label, id }) => {
            if (label === 'Concierge') {
              return (
                <button
                  key={id}
                  type="button"
                  onClick={onConciergeClick}
                  className="text-sm text-ink-2 hover:text-ink-1 transition-colors"
                >
                  {label}
                </button>
              );
            }
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavClick(id)}
                className="text-sm text-ink-2 hover:text-ink-1 transition-colors"
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Right action buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            aria-label="Guardar"
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-warm-paper transition-colors"
          >
            <Star className="w-5 h-5 text-ink-3" />
          </button>
          <Link
            to="/login"
            aria-label="Acceso colaboradores"
            className="flex items-center gap-2 px-3 h-9 rounded-full bg-terracotta text-warm-white text-sm font-medium hover:bg-terracotta-deep transition-colors shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Staff</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
