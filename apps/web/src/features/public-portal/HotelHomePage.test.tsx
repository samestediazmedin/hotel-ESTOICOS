import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HotelHomePage } from './HotelHomePage';

/**
 * Phase 12 — renderPage wraps HotelHomePage in QueryClientProvider.
 * HotelHomePage calls useHotelInfo / useRoomTypes / useHotelPhotos / useOffers / useReviews
 * (TanStack Query), so all rendering tests require a QueryClient in scope.
 *
 * NOTE: These tests run in jsdom without a real backend. The queries will fail
 * and the component renders error/fallback states. We test the component's
 * resilience rather than mocking the network layer.
 */
function renderPage(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <HotelHomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HotelHomePage', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders the main page structure without crashing', () => {
    const { container } = renderPage('/');
    // The page should render the nav and main content areas
    expect(container.querySelector('nav')).not.toBeNull();
    expect(container.querySelector('main')).not.toBeNull();
  });

  it('exposes the inicio anchor section id', () => {
    const { container } = renderPage('/');
    // #inicio is always rendered regardless of query state
    expect(container.querySelector('#inicio')).not.toBeNull();
  });

  it('does not render the removed "Restaurante" section', () => {
    const { container } = renderPage('/');
    expect(container.querySelector('#restaurante')).toBeNull();
  });

  it('does not render the "Ofertas" section when there are no active offers', () => {
    const { container } = renderPage('/');
    // useOffers placeholderData is [] → section must NOT mount.
    expect(container.querySelector('#ofertas')).toBeNull();
  });

  it('renders the top navigation with the always-visible anchor labels', async () => {
    renderPage('/');
    // 2026-05-28 — "Restaurante" removed; "Ofertas" appears only when there are offers.
    const labels = ['Inicio', 'Habitaciones', 'Concierge', 'Ubicación'];
    for (const label of labels) {
      const elements = await screen.findAllByText(label, {}, { timeout: 3000 });
      expect(elements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders the ReservationWidget Reservar CTA (mobile + desktop variants both mount)', async () => {
    renderPage('/');
    // Widget is mounted twice (desktop sidebar + mobile bar) — at least one Reservar button exists
    const reservarButtons = await screen.findAllByText(/reservar/i, {}, { timeout: 3000 });
    expect(reservarButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('removes data-theme attribute on mount (dark-mode leak prevention)', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    renderPage('/');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });
});
