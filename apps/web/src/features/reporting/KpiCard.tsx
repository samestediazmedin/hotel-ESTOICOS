interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  /** Optional delta percentage, e.g. 4 = +4%, -2 = -2% */
  delta?: number;
  /**
   * @deprecated v1.0 tone prop — accepted for backward-compat but ignored in render.
   * Use `delta` instead for up/down indicators.
   */
  tone?: 'default' | 'warning' | 'success';
}

/**
 * KpiCard — presentational card for a single KPI metric.
 *
 * Renders '—' when value is null/undefined/empty string.
 * Design: warm-paper background, font-mono value, optional delta indicator.
 */
export function KpiCard({ title, value, subtitle, delta }: KpiCardProps) {
  const displayValue =
    value === null || value === undefined || value === '' ? '—' : String(value);

  const showDelta = typeof delta === 'number';
  const isPositive = showDelta && delta > 0;

  return (
    <div className="bg-warm-paper border border-warm-line rounded-xl p-4 flex flex-col gap-1">
      <p className="text-[11px] font-medium uppercase tracking-widest text-ink-3 truncate">
        {title}
      </p>
      <p className="font-mono text-3xl text-ink-1 mt-1 leading-tight">
        {displayValue}
      </p>
      {showDelta && (
        <span
          className={`text-xs mt-1 inline-block ${isPositive ? 'text-olive' : 'text-terracotta'}`}
        >
          {isPositive ? '↑' : '↓'} {Math.abs(delta!)}%
        </span>
      )}
      {subtitle && (
        <p className="text-xs text-ink-3 mt-1 leading-snug">{subtitle}</p>
      )}
    </div>
  );
}
