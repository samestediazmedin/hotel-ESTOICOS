import { useState } from 'react';
import type { RoomTypeCard } from '../types';
import type { IvaDisplayContext } from '../utils/displayPrice';
import { formatRoomPrice, formatCOPShort } from '../utils/displayPrice';
import { RoomTypeDetailDrawer } from './RoomTypeDetailDrawer';

interface RoomsSectionProps {
  rooms: RoomTypeCard[];
  ivaContext: IvaDisplayContext;
}

/**
 * RoomsSection — public homepage `Habitaciones` grid.
 *
 * 2026-05-28 — Each card is now interactive: click opens
 * RoomTypeDetailDrawer with the full gallery, complete description,
 * amenity list, and a "Reservar" CTA wired to /booking?roomTypeId=<id>.
 *
 * Keyboard accessible: the card is a real <button>, so Enter / Space
 * open the drawer just like a click.
 */
export function RoomsSection({ rooms, ivaContext }: RoomsSectionProps) {
  const [selected, setSelected] = useState<RoomTypeCard | null>(null);

  return (
    <section className="scroll-mt-20">
      <h2 className="font-display text-2xl lg:text-3xl text-ink-1 mb-6">Habitaciones</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {rooms.map((room) => {
          const isMejorValor = room.badge === 'Mejor valor';
          const cardClass = isMejorValor
            ? 'group w-full text-left rounded-2xl border-[1.5px] border-terracotta bg-terracotta-tint p-4 flex gap-4 hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta'
            : 'group w-full text-left rounded-2xl border border-warm-line bg-warm-white p-4 flex gap-4 hover:shadow-md hover:border-ink-3/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta';

          const thumbUrl = room.photos[0]?.url;

          const { amount: displayAmount, ivaIncluded } = formatRoomPrice(room.basePrice, ivaContext);

          return (
            <button
              key={room.id}
              type="button"
              onClick={() => setSelected(room)}
              aria-label={`Ver detalle de ${room.name}`}
              className={cardClass}
            >
              {thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt={room.photos[0].alt}
                  className="h-24 w-24 lg:h-28 lg:w-28 object-cover rounded-xl shrink-0 group-hover:scale-[1.02] transition-transform"
                />
              ) : (
                <div className="h-24 w-24 lg:h-28 lg:w-28 bg-warm-cream rounded-xl shrink-0 flex items-center justify-center">
                  <span className="sr-only">Sin foto</span>
                </div>
              )}
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                {room.badge && (
                  <span
                    className={
                      isMejorValor
                        ? 'self-start px-2 py-0.5 rounded-full bg-terracotta-soft text-terracotta-deep text-[10px] font-medium uppercase tracking-wide'
                        : 'self-start px-2 py-0.5 rounded-full bg-mustard text-ink-1 text-[10px] font-medium uppercase tracking-wide'
                    }
                  >
                    {room.badge}
                  </span>
                )}
                <h3 className="font-display text-lg text-ink-1">{room.name}</h3>
                <p className="text-xs text-ink-3">{room.capacity} personas</p>
                <p className="text-xs text-ink-3 line-clamp-2">{room.description}</p>
                <div className="mt-auto flex items-baseline gap-1">
                  <span className="font-mono text-base text-ink-1">
                    {formatCOPShort(displayAmount)}
                  </span>
                  <span className="text-xs text-ink-3">/ noche</span>
                  {ivaIncluded && (
                    <span className="text-[10px] text-ink-4 ml-0.5">IVA incl.</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail drawer — conditionally mounted so state resets on (re)open */}
      {selected && (
        <RoomTypeDetailDrawer
          room={selected}
          ivaContext={ivaContext}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
