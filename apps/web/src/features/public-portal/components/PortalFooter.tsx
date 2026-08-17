import { Link } from 'react-router-dom';
import type { HotelInfo } from '../types';

interface PortalFooterProps {
  hotelInfo: HotelInfo;
}

export function PortalFooter({ hotelInfo }: PortalFooterProps) {
  return (
    <footer className="mt-20 border-t border-warm-line bg-warm-cream">
      <div className="max-w-7xl mx-auto px-4 lg:px-12 py-10 flex flex-col gap-2 text-sm text-ink-3">
        <p className="font-display text-lg text-ink-1">{hotelInfo.hotelName}</p>
        <p>{hotelInfo.hotelAddress}</p>
        {/* Phase 12: phone from API; fallback to last-resort string so footer never shows blank */}
        <p>{hotelInfo.phone ?? '+57 (1) 555-0100'}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-ink-4">
            © 2026 {hotelInfo.hotelName}. Todos los derechos reservados.
          </p>
          <Link
            to="/login"
            className="text-xs text-ink-3 hover:text-terracotta underline underline-offset-2"
          >
            Acceso colaboradores
          </Link>
        </div>
      </div>
    </footer>
  );
}
