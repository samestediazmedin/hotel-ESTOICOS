interface HotelBrandingProps {
  hotelName?: string;
  city?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * HotelBranding — reusable logo + hotel name component
 * Used in: LoginPage, Sidebar, Public portal
 *
 * D-22: No hardcoded hex colors — Tailwind classes only
 * D-10: hotelName is a prop (configurable per hotel, from system_config)
 * D-23: "AI" uses font-display italic per brand spec
 */
export function HotelBranding({ hotelName = 'Hotel Sumapaz', city, size = 'md' }: HotelBrandingProps) {
  const logoSize = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const logoText = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-lg';
  const wordmarkText = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Logomark: terracota square with "H" (D-09) */}
      <div className="flex items-center gap-2">
        <div className={`${logoSize} bg-terracotta rounded-lg flex items-center justify-center`}>
          <span className={`text-text-inverse font-bold ${logoText} leading-none`}>H</span>
        </div>
        {/* Wordmark: "HotelOS" sans-serif + "AI" serif italic (D-23) */}
        <span className={`font-body font-semibold text-ink-1 ${wordmarkText}`}>
          HotelOS{' '}
          <em className="font-display italic not-italic">AI</em>
        </span>
      </div>

      {/* Hotel name from system_config — serif italic (D-09, D-23) */}
      <p className="font-display italic text-ink-2 text-base">{hotelName}</p>

      {/* Optional city / tagline */}
      {city && <p className="text-ink-3 text-xs">{city}</p>}
    </div>
  );
}
