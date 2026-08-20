import { useState } from 'react';
import { X } from 'lucide-react';

export interface TagsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}

/**
 * TagsInput — chip-style multi-value input for the hotel settings form.
 *
 * Behavior:
 * - Enter or comma → add tag (trimmed, lowercased, deduplicated)
 * - Backspace on empty input → remove last chip
 * - X button on chip → remove that chip
 * - Tag constraints: 2-40 chars, max 8 tags (configurable via `max`)
 *
 * Design: token utilities only (bg-warm-cream, text-ink-2, border-warm-line, etc.)
 */
export function TagsInput({ value, onChange, max = 8 }: TagsInputProps) {
  const [inputVal, setInputVal] = useState('');

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag || value.includes(tag) || value.length >= max) return;
    if (tag.length < 2 || tag.length > 40) return;
    onChange([...value, tag]);
    setInputVal('');
  };

  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-warm-line-strong bg-warm-paper px-2 py-1.5 focus-within:ring-1 focus-within:ring-terracotta">
      {value.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 bg-warm-cream text-ink-2 rounded-full px-2 py-0.5 text-xs"
        >
          {tag}
          <button type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Eliminar etiqueta ${tag}`}
            className="hover:text-terracotta transition-colors"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputVal);
          }
          if (e.key === 'Backspace' && !inputVal && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        placeholder={
          value.length >= max ? `Máx. ${max} etiquetas` : 'Añadir etiqueta...'
        }
        disabled={value.length >= max}
        className="flex-1 min-w-[100px] bg-transparent outline-none text-sm text-ink-1 placeholder:text-ink-3"
      />
    </div>
  );
}
