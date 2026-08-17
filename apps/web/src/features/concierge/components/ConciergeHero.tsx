import {
  Sparkles,
  Utensils,
  Coffee,
  Trees,
  Building2,
  Bus,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react';

// ─── Category mosaic ──────────────────────────────────────────────────────────

interface Category {
  icon: LucideIcon;
  label: string;
  query: string;
}

const CATEGORIES: Category[] = [
  { icon: CalendarDays, label: 'Reservar',      query: '¿Qué habitaciones tienen disponibles para este fin de semana?' },
  { icon: Utensils,     label: 'Restaurantes',  query: 'Restaurantes cerca del hotel' },
  { icon: Coffee,       label: 'Cafes',         query: 'Mejores cafes en la zona' },
  { icon: Trees,        label: 'Parques',       query: 'Parques para visitar en Bogota' },
  { icon: Building2,    label: 'Museos',        query: 'Museos recomendados en Bogota' },
  { icon: Bus,          label: 'Transporte',    query: 'Como ir al aeropuerto' },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ConciergeHeroProps {
  onSelectQuery: (query: string) => void;
  disabled: boolean;
}

/**
 * ConciergeHero — rich empty-state for the public concierge chat.
 *
 * Shows a welcoming headline focused on the concierge's capabilities
 * (booking help, nearby plans, hotel info) + 6-category icon mosaic
 * that seeds queries.
 *
 * Responsive: 2 columns on mobile, 3 columns from md breakpoint.
 */
export function ConciergeHero({ onSelectQuery, disabled }: ConciergeHeroProps) {
  return (
    <div className="flex flex-col items-center gap-8 px-4 py-12">
      {/* Hero text */}
      <div className="flex flex-col items-center gap-3 text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-terracotta-tint flex items-center justify-center mb-1">
          <Sparkles className="w-8 h-8 text-terracotta" />
        </div>
        <h2 className="font-display text-2xl sm:text-3xl text-ink-1 leading-tight">
          ¿Le ayudo a agendar su estadía y armar un plan cerca?
        </h2>
        <p className="text-sm sm:text-base text-ink-2 leading-relaxed">
          Pregúnteme por disponibilidad, qué hacer cerca del hotel o cómo
          reservar. Estoy aquí para ayudarle.
        </p>
      </div>

      {/* Category mosaic — 2 col mobile, 3 col md+ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-md">
        {CATEGORIES.map(({ icon: Icon, label, query }) => (
          <button
            key={label}
            onClick={() => onSelectQuery(query)}
            disabled={disabled}
            className="group flex flex-col items-center gap-2 rounded-xl border border-warm-line bg-warm-white px-3 py-4 transition-all duration-300 hover:border-terracotta-soft hover:bg-terracotta-tint disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-xl bg-warm-cream flex items-center justify-center transition-all duration-300 group-hover:bg-terracotta-soft">
              <Icon className="w-5 h-5 text-ink-3 transition-colors duration-300 group-hover:text-terracotta-deep" />
            </div>
            <span className="text-xs font-medium text-ink-2 transition-colors duration-300 group-hover:text-terracotta-deep">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
