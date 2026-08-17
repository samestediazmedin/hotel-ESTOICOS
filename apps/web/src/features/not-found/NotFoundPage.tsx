import { Link } from 'react-router-dom';

/**
 * NotFoundPage — friendly 404 (2026-06-02)
 *
 * Previously unknown URLs hit `<Navigate to="/" replace />`, which left the
 * user staring at a blank warm-paper screen for 2-3 s while the public portal
 * hydrated (system-config, room-types, photos, offers queries). Now we render
 * an instant, zero-query 404 with an explicit way home.
 *
 * UX rule (2026-05-22 carry-over): unauthenticated users are guided to the
 * public portal, NOT to /login. Login stays reachable only via the Staff
 * button or direct URL.
 */
export function NotFoundPage() {
  return (
    <div className="hos min-h-screen bg-warm-paper flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <p className="font-display italic text-7xl text-terracotta leading-none">404</p>
        <h1 className="mt-4 font-display text-3xl text-ink-1 leading-tight">
          Página no encontrada
        </h1>
        <p className="mt-3 text-ink-3 text-sm leading-relaxed">
          La dirección que buscás no existe o fue movida. Podés volver al
          inicio para seguir navegando.
        </p>
        <Link
          to="/"
          replace
          className="mt-8 inline-flex items-center justify-center rounded-lg bg-terracotta px-6 py-3 text-warm-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
