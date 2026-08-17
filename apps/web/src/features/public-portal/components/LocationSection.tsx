import { MapPin } from 'lucide-react';

const LANDMARKS = [
  { name: 'Parque Nacional', distance: '3 min caminando' },
  { name: 'Museo Nacional', distance: '7 min caminando' },
  { name: 'Cerro de Monserrate', distance: '10 min en taxi' },
  { name: 'Aeropuerto El Dorado', distance: '30 min en taxi' },
];

// Hotel coordinates (Bogotá)
const HOTEL_LAT = 4.622724;
const HOTEL_LON = -74.066401;

// Tight bounding box centered on the hotel for the embed view
const BBOX = {
  minLon: -74.0734,
  minLat: 4.6157,
  maxLon: -74.0594,
  maxLat: 4.6297,
};

const EMBED_URL =
  `https://www.openstreetmap.org/export/embed.html` +
  `?bbox=${BBOX.minLon}%2C${BBOX.minLat}%2C${BBOX.maxLon}%2C${BBOX.maxLat}` +
  `&layer=mapnik&marker=${HOTEL_LAT}%2C${HOTEL_LON}`;

const OPEN_LINK = `https://www.openstreetmap.org/?mlat=${HOTEL_LAT}&mlon=${HOTEL_LON}#map=17/${HOTEL_LAT}/${HOTEL_LON}`;

interface LocationSectionProps {
  address: string;
}

export function LocationSection({ address }: LocationSectionProps) {
  return (
    <section id="ubicacion" className="scroll-mt-20">
      <h2 className="font-display text-2xl lg:text-3xl text-ink-1 mb-6">Ubicación</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interactive map */}
        <div className="rounded-2xl overflow-hidden border border-warm-line bg-warm-cream h-64 lg:h-72 relative">
          <iframe
            title={`Mapa de ${address}`}
            src={EMBED_URL}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a
            href={OPEN_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-warm-white/95 px-3 py-1 text-xs text-ink-1 shadow-sm hover:bg-warm-white border border-warm-line"
          >
            <MapPin className="w-3 h-3 text-terracotta" />
            Ver en mapa
          </a>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-lg text-ink-1 mb-2">Cerca del hotel</h3>
          <div className="text-xs text-ink-3 mb-2">{address}</div>
          {LANDMARKS.map((landmark) => (
            <div
              key={landmark.name}
              className="flex items-baseline justify-between py-2 border-b border-warm-line last:border-0"
            >
              <span className="text-sm text-ink-1">{landmark.name}</span>
              <span className="text-xs font-mono text-ink-3">{landmark.distance}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
