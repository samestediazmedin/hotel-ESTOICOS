import { useSearchParams, Link } from 'react-router-dom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * BookingConfirmationPage — success screen at /booking/confirmation.
 *
 * Reads reservationId, guestName, total from URL search params.
 * Shows green confirmation with reservation number and email reminder.
 */
export function BookingConfirmationPage() {
  const [searchParams] = useSearchParams();

  const reservationId = searchParams.get('reservationId') ?? '';
  const guestName = decodeURIComponent(searchParams.get('guestName') ?? '');
  const total = Number.parseFloat(searchParams.get('total') ?? '0');

  if (!reservationId) {
    return (
      <div className="min-h-screen bg-[#f9f5f0] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No se encontró información de la reserva.</p>
          <Link to="/booking" className="text-[#c45a3a] underline">Hacer una reserva</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f5f0] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-md p-10 w-full max-w-lg text-center">
        {/* Pending review icon (clock — request received, awaiting confirmation) */}
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-serif font-semibold text-gray-800 mb-2">
          ¡Recibimos tu solicitud{guestName ? `, ${guestName}` : ''}!
        </h1>
        <p className="text-gray-500 mb-6">Te contactaremos en breve para confirmar tu reserva.</p>

        {/* Request details */}
        <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-600">Número de solicitud</span>
            <span className="font-mono font-semibold text-gray-800 text-sm">{reservationId}</span>
          </div>
          {total > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total estimado</span>
              <span className="font-bold text-[#c45a3a] text-lg">{formatCOP(total)}</span>
            </div>
          )}
        </div>

        {/* Next steps */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-8 text-left">
          <p className="text-sm text-amber-900 font-medium mb-2">¿Qué sigue?</p>
          <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
            <li>Nuestro equipo revisará tu solicitud y te contactará por WhatsApp, llamada o correo.</li>
            <li>Confirmaremos la disponibilidad y, si es necesario, ajustaremos las fechas contigo.</li>
            <li>Tu habitación se asignará al momento del check-in.</li>
          </ul>
        </div>

        <Link
          to="/booking"
          className="inline-block bg-[#c45a3a] text-white py-3 px-8 rounded-lg font-medium hover:bg-[#a84830] transition-colors"
        >
          Enviar otra solicitud
        </Link>
      </div>
    </div>
  );
}
