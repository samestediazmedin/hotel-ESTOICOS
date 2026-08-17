/**
 * BookingFormPage tests — Phase 2 ratePlanId forwarding
 *
 * Asserts that:
 * 1. ratePlanId from URL is included in the POST /api/public/bookings payload.
 * 2. ratePlanName is shown in the "Resumen de tu reserva" card.
 * 3. When ratePlanId is absent (legacy/BAR path), the payload still submits OK.
 * 4. Existing offer lock banner behaviour is preserved.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw-server';
import { BookingFormPage } from '../BookingFormPage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_SEARCH =
  '?roomTypeId=rt-doble&checkIn=2026-06-10&checkOut=2026-06-12&adults=2&total=476000';

let capturedPayload: unknown = null;

function setupBookingHandler(status = 200) {
  server.use(
    http.get('/api/public/csrf-token', () =>
      HttpResponse.json({ csrfToken: 'test-csrf-token' }),
    ),
    http.post('/api/public/bookings', async ({ request }) => {
      capturedPayload = await request.json();
      if (status === 200) {
        return HttpResponse.json({
          reservationId: 'res-001',
          guestName: 'Juan Pérez',
          total: 476000,
        });
      }
      return HttpResponse.json({ message: 'Conflict' }, { status });
    }),
  );
}

// No offer needed for most tests
function setupNoOfferHandler() {
  server.use(
    http.get('/api/public/offers/:id', () =>
      HttpResponse.json({ id: 'x', roomType: null }),
    ),
  );
}

function renderPage(search = BASE_SEARCH) {
  capturedPayload = null;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/booking/checkout${search}`]}>
        <Routes>
          <Route path="/booking/checkout" element={<BookingFormPage />} />
          <Route
            path="/booking/confirmation"
            element={<div data-testid="confirmation-page">Confirmed</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * Fill out the minimum required fields in the guest form.
 *
 * We use getElementById for fields whose label text collides with the
 * contact-preference radio labels rendered inside the open <details> section
 * ("Correo electrónico" → EMAIL radio; "Teléfono" → PHONE radio).
 * All form inputs carry stable id attributes, so this is safe.
 */
function fillForm() {
  const get = (id: string) => document.getElementById(id) as HTMLInputElement;

  fireEvent.change(get('fullName'), { target: { value: 'Juan Pérez' } });
  fireEvent.change(get('email'), { target: { value: 'juan@example.com' } });
  fireEvent.change(get('phone'), { target: { value: '+573001234567' } });
  fireEvent.change(get('documentNumber'), { target: { value: '12345678' } });
  fireEvent.change(get('nationality'), { target: { value: 'CO' } });
  fireEvent.change(get('dateOfBirth'), { target: { value: '1990-01-01' } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BookingFormPage — ratePlanId forwarding', () => {
  beforeEach(() => {
    capturedPayload = null;
    setupNoOfferHandler();
  });

  it('shows the ratePlanName in the summary card when present in URL', async () => {
    setupBookingHandler();
    renderPage(`${BASE_SEARCH}&ratePlanId=rp-luna-001&ratePlanName=Luna+de+Miel`);

    await waitFor(() =>
      expect(screen.getByText('Luna de Miel')).toBeInTheDocument(),
    );
    // The label "Tarifa" must also appear in the grid
    expect(screen.getByText('Tarifa')).toBeInTheDocument();
  });

  it('does NOT show a Tarifa row in the summary when ratePlanName is absent', async () => {
    setupBookingHandler();
    renderPage(BASE_SEARCH);

    // Wait for CSRF to load (summary renders immediately)
    await waitFor(() =>
      expect(screen.getByText(/resumen de tu reserva/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText('Tarifa')).toBeNull();
  });

  it('includes ratePlanId in the POST payload when present in URL', async () => {
    setupBookingHandler();
    renderPage(`${BASE_SEARCH}&ratePlanId=rp-luna-001&ratePlanName=Luna+de+Miel`);

    // Wait for the submit button to be enabled (CSRF token loaded)
    const submitBtn = await screen.findByRole('button', { name: /confirmar reserva/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());

    fillForm();
    fireEvent.click(submitBtn);

    await waitFor(() => expect(capturedPayload).not.toBeNull(), { timeout: 3000 });
    expect((capturedPayload as Record<string, unknown>).ratePlanId).toBe('rp-luna-001');
  });

  it('omits ratePlanId from the payload when not present in URL', async () => {
    setupBookingHandler();
    renderPage(BASE_SEARCH);

    const submitBtn = await screen.findByRole('button', { name: /confirmar reserva/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());

    fillForm();
    fireEvent.click(submitBtn);

    await waitFor(() => expect(capturedPayload).not.toBeNull(), { timeout: 3000 });
    // undefined values are stripped by JSON.stringify so the key should not be present
    expect(Object.hasOwn(capturedPayload as object, 'ratePlanId')).toBe(false);
  });

  it('navigates to /booking/confirmation on successful submission', async () => {
    setupBookingHandler();
    renderPage(`${BASE_SEARCH}&ratePlanId=rp-luna-001&ratePlanName=Luna+de+Miel`);

    const submitBtn = await screen.findByRole('button', { name: /confirmar reserva/i });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());

    fillForm();
    fireEvent.click(submitBtn);

    await waitFor(() =>
      expect(screen.getByTestId('confirmation-page')).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});

describe('BookingFormPage — offer lock banner preservation', () => {
  it('shows the room type lock banner when the offer targets a specific room type', async () => {
    setupBookingHandler();
    server.use(
      http.get('/api/public/csrf-token', () =>
        HttpResponse.json({ csrfToken: 'test-csrf-token' }),
      ),
      http.get('/api/public/offers/offer_rt', () =>
        HttpResponse.json({
          id: 'offer_rt',
          roomType: { id: 'rt-suite', name: 'Suite Sumapaz' },
        }),
      ),
    );

    renderPage(`${BASE_SEARCH}&offer=offer_rt`);

    await waitFor(() =>
      expect(screen.getByText(/esta oferta aplica únicamente a/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('Suite Sumapaz')).toBeInTheDocument();
  });
});
