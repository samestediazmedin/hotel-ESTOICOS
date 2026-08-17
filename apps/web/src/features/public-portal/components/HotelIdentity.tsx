import { Star, MapPin } from 'lucide-react';
import type { HotelInfo } from '../types';

interface HotelIdentityProps {
  hotelInfo: HotelInfo;
}

export function HotelIdentity({ hotelInfo }: HotelIdentityProps) {
  const parts = hotelInfo.hotelName.split(' ');
  const first = parts[0];
  const rest = parts.slice(1).join(' ');

  return (
    <div className="pt-6 pb-8 flex flex-col gap-4">
      {/* H1 */}
      <h1 className="font-display text-3xl lg:text-4xl leading-tight text-ink-1">
        {first}
        {rest && (
          <>
            {' '}
            <i className="italic">{rest}</i>
          </>
        )}
      </h1>

      {/* Rating row */}
      <div className="flex items-center gap-2 text-sm text-ink-2 flex-wrap">
        <Star className="w-4 h-4 fill-mustard text-mustard shrink-0" />
        <span className="font-medium font-mono text-ink-1">{hotelInfo.rating.toFixed(2)}</span>
        <span>· {hotelInfo.reviewCount} reseñas</span>
        <span className="text-ink-4">·</span>
        <MapPin className="w-4 h-4 text-terracotta shrink-0" />
        <span>{hotelInfo.hotelAddress}</span>
      </div>

      {/* Tags / pills */}
      <div className="flex flex-wrap gap-2">
        {hotelInfo.tags.map((tag) => (
          <span
            key={tag}
            className="px-3 py-1 rounded-full bg-warm-paper text-ink-2 text-xs border border-warm-line"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Description */}
      <p className="text-base leading-relaxed text-ink-2 max-w-2xl">{hotelInfo.description}</p>
    </div>
  );
}
