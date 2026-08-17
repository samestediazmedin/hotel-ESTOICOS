import { Sparkles, CalendarCheck, MapPin, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConciergeTeaserProps {
  /** Called when the user clicks the CTA. Opens the concierge drawer. */
  onOpenConcierge: () => void;
}

// ─── Capability pills ────────────────────────────────────────────────────────

const CAPABILITIES = [
  { icon: CalendarCheck, label: 'Disponibilidad y reservas' },
  { icon: MapPin, label: 'Planes cerca del hotel' },
  { icon: HelpCircle, label: 'Información del hotel' },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ConciergeTeaser — mid-page invitation to use the AI concierge.
 *
 * Redesigned for higher visibility: large icon, clear heading with the value
 * proposition, capability pills showing what the concierge can do, and a
 * prominent CTA button. Warm tint background to stand out from the neutral
 * content sections around it.
 */
export function ConciergeTeaser({ onOpenConcierge }: ConciergeTeaserProps) {
  return (
    <section id="concierge" className="scroll-mt-20">
      <div className="rounded-2xl bg-terracotta-tint border border-terracotta-soft/60 p-8 lg:p-10">
        {/* Top row: icon + text */}
        <div className="flex flex-col items-center text-center gap-5">
          {/* Icon badge */}
          <div className="h-16 w-16 rounded-2xl bg-terracotta/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-terracotta" />
          </div>

          {/* Heading */}
          <div className="max-w-lg">
            <h2 className="font-display text-2xl lg:text-3xl text-ink-1 mb-2">
              ¿Le ayudo a planear su estadía?
            </h2>
            <p className="text-sm lg:text-base text-ink-2 leading-relaxed">
              Pregúnteme por disponibilidad, qué hacer cerca del hotel o cómo
              reservar. Respuestas al instante, sin descargar nada.
            </p>
          </div>

          {/* Capability pills */}
          <div className="flex flex-wrap justify-center gap-2.5 mt-1">
            {CAPABILITIES.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-warm-white/80 border border-warm-line px-3 py-1.5 text-xs font-medium text-ink-2"
              >
                <Icon className="w-3.5 h-3.5 text-terracotta" />
                {label}
              </span>
            ))}
          </div>

          {/* CTA */}
          <Button
            type="button"
            variant="terracotta"
            size="lg"
            className="mt-2"
            onClick={onOpenConcierge}
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Abrir Concierge
          </Button>
        </div>
      </div>
    </section>
  );
}
