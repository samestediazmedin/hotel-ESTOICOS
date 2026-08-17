interface EmptyTabPlaceholderProps {
  message: string;
}

/**
 * EmptyTabPlaceholder — shown in drawer tabs that will be implemented in future phases.
 * Uses design tokens — no hardcoded hex.
 */
export function EmptyTabPlaceholder({ message }: EmptyTabPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
      <span className="text-ink-3 text-2xl" aria-hidden="true">
        —
      </span>
      <p className="text-ink-3 text-sm">{message}</p>
    </div>
  );
}
