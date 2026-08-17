import { useState, type KeyboardEvent } from 'react';
import { Star } from 'lucide-react';

interface StarRatingInputProps {
  /** Current selected value. 0 = nothing selected yet. */
  value: number;
  /** Called when a star is clicked or selected via keyboard. */
  onChange: (rating: number) => void;
  disabled?: boolean;
}

/**
 * Interactive 5-star rating input.
 *
 * Accessibility:
 *   - role="radiogroup" on container (group of mutually-exclusive options)
 *   - Each star: role="radio", aria-checked, aria-label with natural language
 *   - Keyboard roving tabIndex: only the active star (or first if none) is tabbable
 *   - ArrowRight / ArrowLeft navigate between stars
 *   - Enter / Space confirm current star
 *
 * Visual states:
 *   - Default (unselected, no hover): text-warm-tan Star outline
 *   - Hover preview (1..hoverIdx): fill-mustard text-mustard
 *   - Selected (1..value): fill-mustard text-mustard
 *   - Hover overrides selected display for responsive feel
 */
export function StarRatingInput({ value, onChange, disabled }: StarRatingInputProps) {
  const [hover, setHover] = useState(0);

  // When hovering, show hover preview; otherwise show current value
  const display = hover || value;

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(Math.min(idx + 1, 5));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(Math.max(idx - 1, 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(idx);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Calificación de la estadía"
      className="flex gap-1"
    >
      {[1, 2, 3, 4, 5].map((idx) => {
        const filled = idx <= display;
        // Roving tabIndex: only 1 star per group is focusable at a time
        const isTabTarget = value === idx || (value === 0 && idx === 1);

        return (
          <button
            key={idx}
            type="button"
            role="radio"
            aria-checked={value === idx}
            aria-label={`Dar ${idx} ${idx === 1 ? 'estrella' : 'estrellas'}`}
            tabIndex={isTabTarget ? 0 : -1}
            disabled={disabled}
            onMouseEnter={() => setHover(idx)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className="p-1 transition-transform hover:scale-110 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta rounded"
          >
            <Star
              className={
                filled
                  ? 'h-8 w-8 fill-mustard text-mustard'
                  : 'h-8 w-8 text-warm-tan'
              }
            />
          </button>
        );
      })}
    </div>
  );
}
