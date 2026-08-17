import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RoomTypeDetailDrawer } from './RoomTypeDetailDrawer';
import type { RoomTypeCard } from '../types';
import type { IvaDisplayContext } from '../utils/displayPrice';
import { useReservationUiStore } from '../stores/reservationUiStore';

const ROOM_WITH_TWO_PHOTOS: RoomTypeCard = {
  id: 'rt-1',
  name: 'Doble Deluxe',
  capacity: 2,
  description: 'Habitación amplia con balcón privado, 28m², vista a los cerros orientales.',
  basePrice: 290000,
  photos: [
    { url: '/images/room_1.jpg', alt: 'Doble Deluxe' },
    { url: '/images/roomtype_2.jpg', alt: 'Doble Deluxe' },
  ],
  badge: 'Mejor valor',
  amenities: ['WiFi', 'TV', 'Desayuno', 'Balcón', 'Aire acondicionado'],
};

const IVA_OFF: IvaDisplayContext = { displayPricesWithIva: false, ivaRate: 0.19 };
const IVA_ON: IvaDisplayContext = { displayPricesWithIva: true, ivaRate: 0.19 };

function renderDrawer(room: RoomTypeCard, onClose = vi.fn(), ivaContext: IvaDisplayContext = IVA_OFF) {
  return render(
    <RoomTypeDetailDrawer room={room} ivaContext={ivaContext} onClose={onClose} />,
  );
}

describe('RoomTypeDetailDrawer', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    useReservationUiStore.setState({ datePickerRequestedAt: null });
  });

  it('renders the room name + badge + capacity + price + description', () => {
    renderDrawer(ROOM_WITH_TWO_PHOTOS);
    expect(screen.getByRole('heading', { name: 'Doble Deluxe' })).toBeInTheDocument();
    expect(screen.getByText('Mejor valor')).toBeInTheDocument();
    expect(screen.getByText(/Hasta 2 personas/)).toBeInTheDocument();
    expect(screen.getByText(/Habitación amplia con balcón/)).toBeInTheDocument();
    // Price formatted as COP
    expect(screen.getByText(/\$\s*290\.000/)).toBeInTheDocument();
  });

  it('renders all amenities as items', () => {
    renderDrawer(ROOM_WITH_TWO_PHOTOS);
    for (const a of ROOM_WITH_TWO_PHOTOS.amenities!) {
      expect(screen.getByText(a)).toBeInTheDocument();
    }
  });

  it('renders the hero photo + thumbnail strip when there are 2+ photos', () => {
    renderDrawer(ROOM_WITH_TWO_PHOTOS);
    // Hero = first photo
    const heroImgs = screen.getAllByAltText('Doble Deluxe');
    expect(heroImgs.length).toBeGreaterThanOrEqual(1);
    expect((heroImgs[0] as HTMLImageElement).src).toContain('/images/room_1.jpg');
    // Counter
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    // Thumbnails
    expect(screen.getByRole('button', { name: 'Ver foto 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver foto 2' })).toBeInTheDocument();
  });

  it('navigates to next photo on chevron-right click', () => {
    renderDrawer(ROOM_WITH_TWO_PHOTOS);
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('wraps around past the last photo back to the first', () => {
    renderDrawer(ROOM_WITH_TWO_PHOTOS);
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('hides the photo navigator and counter when there is exactly one photo', () => {
    const single = { ...ROOM_WITH_TWO_PHOTOS, photos: [ROOM_WITH_TWO_PHOTOS.photos[0]] };
    renderDrawer(single);
    expect(screen.queryByRole('button', { name: 'Foto siguiente' })).toBeNull();
    expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull();
  });

  it('shows a "Sin fotos aún" placeholder when the gallery is empty', () => {
    const noPhotos = { ...ROOM_WITH_TWO_PHOTOS, photos: [] };
    renderDrawer(noPhotos);
    expect(screen.getByText(/sin fotos a[uú]n/i)).toBeInTheDocument();
  });

  it('the "Reservar" CTA is a button (not a link) — does NOT navigate to /booking', () => {
    renderDrawer(ROOM_WITH_TWO_PHOTOS);
    // Must be a button, not an anchor
    const cta = screen.getByRole('button', { name: /reservar doble deluxe/i });
    expect(cta.tagName).toBe('BUTTON');
    expect(screen.queryByRole('link', { name: /reservar doble deluxe/i })).toBeNull();
  });

  it('the "Reservar" CTA calls onClose and triggers requestDatePicker in the store', () => {
    // Reset store state before the test
    useReservationUiStore.setState({ datePickerRequestedAt: null });
    const onClose = vi.fn();
    renderDrawer(ROOM_WITH_TWO_PHOTOS, onClose);
    const cta = screen.getByRole('button', { name: /reservar doble deluxe/i });
    fireEvent.click(cta);
    expect(onClose).toHaveBeenCalledOnce();
    expect(useReservationUiStore.getState().datePickerRequestedAt).not.toBeNull();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    renderDrawer(ROOM_WITH_TWO_PHOTOS, onClose);
    const backdrops = screen.getAllByRole('button', { name: 'Cerrar' });
    fireEvent.click(backdrops[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderDrawer(ROOM_WITH_TWO_PHOTOS, onClose);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('locks body scroll while open and restores on unmount', () => {
    const { unmount } = renderDrawer(ROOM_WITH_TWO_PHOTOS);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  // ─── 2026-05-29: IVA display ───────────────────────────────────────────────

  it('shows IVA-included price when displayPricesWithIva is true', () => {
    renderDrawer(ROOM_WITH_TWO_PHOTOS, vi.fn(), IVA_ON);
    // 290000 * 1.19 = 345100 → formatCOP → "$ 345.100" (locale varies)
    expect(screen.getByText(/345/)).toBeInTheDocument();
    expect(screen.getByText('IVA incluido')).toBeInTheDocument();
  });

  it('shows base price and no IVA note when displayPricesWithIva is false', () => {
    renderDrawer(ROOM_WITH_TWO_PHOTOS, vi.fn(), IVA_OFF);
    // Base 290000 → formatCOP → "$290.000"
    expect(screen.getByText(/290\.000/)).toBeInTheDocument();
    expect(screen.queryByText('IVA incluido')).toBeNull();
  });
});
