import { MessageCircle, CalendarCheck, MapPin, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConciergeHeroBannerProps {
  /** Opens the concierge drawer via the shared zustand store. */
  onOpenConcierge: () => void;
}

// ─── Capability chips ────────────────────────────────────────────────────────

const CAPABILITIES = [
  { icon: CalendarCheck, label: 'Disponibilidad' },
  { icon: MapPin, label: 'Planes cerca' },
  { icon: HelpCircle, label: 'Info del hotel' },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ConciergeHeroBanner — above-the-fold concierge entry point.
 *
 * Placed immediately after HotelIdentity in HotelHomePage, so it is visible
 * without scrolling. Eye-catching warm terracotta background with a clear
 * heading, capability chips, and a prominent CTA. This ensures the concierge
 * is perceived as a primary feature, not a corner afterthought.
 *
 * Responsive: single-column on mobile, horizontal layout on lg+.
 * A11y: semantic section, descriptive aria-label, focusable CTA.
 */
export function ConciergeHeroBanner({ onOpenConcierge }: ConciergeHeroBannerProps) {
  return (
    <section
      aria-label="Conserje virtual del hotel"
      className="
        relative overflow-hidden
        rounded-2xl
        bg-gradient-to-br from-terracotta to-terracotta-deep
        text-warm-white
        p-6 sm:p-8 lg:p-10
        mt-2 mb-2
      "
    >
      {/* Decorative background circle — visual interest, hidden from AT */}
      <div
        aria-hidden="true"
        className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-warm-white/5"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-warm-white/5"
      />

      <div className="relative flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
        {/* Icon + text block */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-warm-white/15">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h2 className="font-display text-2xl sm:text-3xl leading-tight">
              Conserje virtual
            </h2>
          </div>

          <p className="text-warm-white/85 text-sm sm:text-base leading-relaxed max-w-lg">
            Le ayudo a consultar disponibilidad, descubrir planes cerca del hotel
            y resolver cualquier duda sobre su estadía. Respuestas al instante.
          </p>

          {/* Capability chips */}
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="
                  inline-flex items-center gap-1.5
                  rounded-full
                  bg-warm-white/15 backdrop-blur-sm
                  px-3 py-1.5
                  text-xs font-medium text-warm-white/90
                "
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="shrink-0">
          <Button
            type="button"
            onClick={onOpenConcierge}
            className="
              bg-warm-white text-terracotta-deep
              hover:bg-warm-paper hover:text-terracotta
              font-semibold
              px-6 py-3 h-auto
              text-sm sm:text-base
              rounded-xl
              shadow-lg shadow-black/10
              transition-all duration-300
              hover:scale-[1.02]
              cursor-pointer
            "
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Hablar con el concierge
          </Button>
        </div>
      </div>
    </section>
  );
}
