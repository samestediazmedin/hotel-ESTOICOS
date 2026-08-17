import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { RoomsSection } from './RoomsSection';
import type { RoomTypeCard } from '../types';
import type { IvaDisplayContext } from '../utils/displayPrice';

const ROOMS: RoomTypeCard[] = [
  {
    id: 'rt-1',
    name: 'Doble Estándar',
    capacity: 2,
    description: 'Habitación cómoda para dos.',
    basePrice: 290_000,
    photos: [],
    badge: null,
  },
];

const IVA_ON: IvaDisplayContext = { displayPricesWithIva: true, ivaRate: 0.19 };
const IVA_OFF: IvaDisplayContext = { displayPricesWithIva: false, ivaRate: 0.19 };

function renderSection(ivaContext: IvaDisplayContext) {
  return render(
    <MemoryRouter>
      <RoomsSection rooms={ROOMS} ivaContext={ivaContext} />
    </MemoryRouter>,
  );
}

describe('RoomsSection — IVA price display', () => {
  it('shows IVA-included price when displayPricesWithIva is true', () => {
    renderSection(IVA_ON);
    // 290000 * 1.19 = 345100 → formatCOPShort → "$345k"
    expect(screen.getByText('$345k')).toBeInTheDocument();
  });

  it('shows "IVA incl." note when displayPricesWithIva is true', () => {
    renderSection(IVA_ON);
    expect(screen.getByText('IVA incl.')).toBeInTheDocument();
  });

  it('shows the base price when displayPricesWithIva is false', () => {
    renderSection(IVA_OFF);
    // 290000 → formatCOPShort → "$290k"
    expect(screen.getByText('$290k')).toBeInTheDocument();
  });

  it('does NOT show "IVA incl." note when displayPricesWithIva is false', () => {
    renderSection(IVA_OFF);
    expect(screen.queryByText('IVA incl.')).toBeNull();
  });

  it('renders the room name', () => {
    renderSection(IVA_OFF);
    expect(screen.getByText('Doble Estándar')).toBeInTheDocument();
  });

  it('renders empty section when rooms array is empty', () => {
    render(
      <MemoryRouter>
        <RoomsSection rooms={[]} ivaContext={IVA_OFF} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Habitaciones' })).toBeInTheDocument();
  });
});
