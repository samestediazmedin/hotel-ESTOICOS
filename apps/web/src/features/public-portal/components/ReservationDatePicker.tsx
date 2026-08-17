/**
 * ReservationDatePicker — encapsulated react-day-picker v10 range wrapper.
 *
 * CSS is imported HERE (component-scoped) — does NOT leak globally.
 * .rdp-* class tree is contained to this component's render output.
 *
 * Locale: Spanish (es-CO) from react-day-picker/locale — no date-fns dependency.
 * numberOfMonths: parametrized so callers choose 1 (mobile) or 2 (desktop).
 */
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import 'react-day-picker/dist/style.css';

interface Props {
  range: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  numberOfMonths?: 1 | 2;
}

export function ReservationDatePicker({ range, onChange, numberOfMonths = 1 }: Props) {
  return (
    <DayPicker
      mode="range"
      selected={range}
      onSelect={onChange}
      disabled={{ before: new Date() }}
      numberOfMonths={numberOfMonths}
      locale={es}
      classNames={{
        range_start: 'bg-terracotta text-warm-white rounded-l-full',
        range_end: 'bg-terracotta text-warm-white rounded-r-full',
        range_middle: 'bg-terracotta-tint text-ink-1',
        day_button: 'hover:bg-warm-cream rounded-full',
        today: 'font-bold text-terracotta',
      }}
    />
  );
}
