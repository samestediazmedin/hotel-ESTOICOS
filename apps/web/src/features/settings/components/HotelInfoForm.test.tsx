import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HotelInfoForm } from './HotelInfoForm';
import type { AdminSystemConfig } from '../types';

const INITIAL: AdminSystemConfig = {
  name: 'Hotel Sumapaz',
  address: 'La Candelaria, Bogotá',
  tagline: 'Boutique en el corazón de Bogotá',
  description: 'Un hotel boutique.',
  phone: '+57 (1) 555-0100',
  tags: ['Boutique'],
  displayPricesWithIva: true,
};

function renderForm(initial: AdminSystemConfig = INITIAL) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HotelInfoForm initial={initial} />
    </QueryClientProvider>,
  );
}

describe('HotelInfoForm — displayPricesWithIva toggle', () => {
  it('renders the IVA toggle switch', () => {
    renderForm();
    expect(
      screen.getByRole('switch', { name: /mostrar precios con iva incluido/i }),
    ).toBeInTheDocument();
  });

  it('switch is checked when initial displayPricesWithIva is true', () => {
    renderForm();
    const sw = screen.getByRole('switch', { name: /mostrar precios con iva incluido/i });
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('switch is unchecked when initial displayPricesWithIva is false', () => {
    renderForm({ ...INITIAL, displayPricesWithIva: false });
    const sw = screen.getByRole('switch', { name: /mostrar precios con iva incluido/i });
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('toggling the switch flips aria-checked', () => {
    renderForm();
    const sw = screen.getByRole('switch', { name: /mostrar precios con iva incluido/i });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('renders the descriptive hint about IVA note', () => {
    renderForm();
    // Both the toggle label and the hint contain "IVA incluido" — at least one should render
    expect(screen.getAllByText(/iva incluido/i).length).toBeGreaterThanOrEqual(1);
  });
});
