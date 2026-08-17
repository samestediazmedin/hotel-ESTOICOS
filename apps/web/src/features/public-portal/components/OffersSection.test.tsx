import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OffersSection } from './OffersSection';
import type { PublicOffer } from '../types';

const OFFER_BASE: PublicOffer = {
  id: 'offer_1',
  title: 'Escapada romántica',
  description: 'Habitación con vista a los cerros, botella de vino + desayuno a la cama.',
  imageUrl: 'https://example.com/r2/offers/test.jpg',
  badge: '-20%',
  validFrom: '2026-05-01',
  validTo: '2026-08-31',
  ctaText: 'Reservar oferta',
  ctaLink: null,
  roomType: null,
};

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('OffersSection', () => {
  it('renders null when there are no offers (defensive guard)', () => {
    const { container } = renderWithRouter(<OffersSection offers={[]} />);
    expect(container.querySelector('#ofertas')).toBeNull();
  });

  it('renders the Ofertas heading + #ofertas anchor when there is at least one offer', () => {
    const { container } = renderWithRouter(<OffersSection offers={[OFFER_BASE]} />);
    expect(container.querySelector('#ofertas')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Ofertas' })).toBeInTheDocument();
  });

  it('renders the offer card with title, description, image, and badge', () => {
    renderWithRouter(<OffersSection offers={[OFFER_BASE]} />);
    expect(screen.getByText('Escapada romántica')).toBeInTheDocument();
    expect(screen.getByText(/botella de vino/)).toBeInTheDocument();
    expect(screen.getByText('-20%')).toBeInTheDocument();
    // The card image uses aria-label on the button; the img uses alt=title
    const img = screen.getByAltText('Escapada romántica') as HTMLImageElement;
    expect(img.src).toBe(OFFER_BASE.imageUrl);
  });

  it('uses ctaText when provided (otherwise "Reservar")', () => {
    renderWithRouter(<OffersSection offers={[OFFER_BASE]} />);
    expect(screen.getByText('Reservar oferta')).toBeInTheDocument();
  });

  it('defaults the CTA to "Reservar" when ctaText is null', () => {
    const offer = { ...OFFER_BASE, ctaText: null };
    renderWithRouter(<OffersSection offers={[offer]} />);
    expect(screen.getByText('Reservar')).toBeInTheDocument();
  });

  it('builds an internal /booking?offer=<id> link when ctaLink is null', () => {
    const offer = { ...OFFER_BASE, ctaLink: null };
    renderWithRouter(<OffersSection offers={[offer]} />);
    const link = screen.getByRole('link', { name: /reservar/i }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/booking?offer=offer_1');
  });

  it('uses an external link with target=_blank when ctaLink is absolute', () => {
    const offer = { ...OFFER_BASE, ctaLink: 'https://reservas.example.com/promo' };
    renderWithRouter(<OffersSection offers={[offer]} />);
    const link = screen.getByRole('link', { name: /reservar/i }) as HTMLAnchorElement;
    expect(link.href).toBe('https://reservas.example.com/promo');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('renders the formatted validity range in Spanish', () => {
    renderWithRouter(<OffersSection offers={[OFFER_BASE]} />);
    // Match the localised pattern without coupling to exact month abbreviation casing
    expect(screen.getByText(/v[aá]lido del .+ 2026 al .+ 2026/i)).toBeInTheDocument();
  });

  it('renders "Válido desde" when only validFrom is set', () => {
    const offer = { ...OFFER_BASE, validTo: null };
    renderWithRouter(<OffersSection offers={[offer]} />);
    expect(screen.getByText(/válido desde/i)).toBeInTheDocument();
  });

  it('renders "Válido hasta" when only validTo is set', () => {
    const offer = { ...OFFER_BASE, validFrom: null };
    renderWithRouter(<OffersSection offers={[offer]} />);
    expect(screen.getByText(/válido hasta/i)).toBeInTheDocument();
  });

  it('does not render a validity line when both dates are null', () => {
    const offer = { ...OFFER_BASE, validFrom: null, validTo: null };
    renderWithRouter(<OffersSection offers={[offer]} />);
    expect(screen.queryByText(/válido/i)).not.toBeInTheDocument();
  });

  it('renders multiple offer cards in a grid', () => {
    const offers: PublicOffer[] = [
      { ...OFFER_BASE, id: 'a', title: 'Promo A' },
      { ...OFFER_BASE, id: 'b', title: 'Promo B' },
      { ...OFFER_BASE, id: 'c', title: 'Promo C' },
    ];
    renderWithRouter(<OffersSection offers={offers} />);
    expect(screen.getByText('Promo A')).toBeInTheDocument();
    expect(screen.getByText('Promo B')).toBeInTheDocument();
    expect(screen.getByText('Promo C')).toBeInTheDocument();
  });

  // ── Drawer integration ──────────────────────────────────────────────────────

  it('clicking the card opens OfferDetailDrawer', () => {
    renderWithRouter(<OffersSection offers={[OFFER_BASE]} />);
    // Drawer is not yet present
    expect(screen.queryByRole('dialog')).toBeNull();
    // Click the card button (aria-label "Ver detalle de <title>")
    fireEvent.click(screen.getByRole('button', { name: /ver detalle de escapada romántica/i }));
    // Drawer is now mounted
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('pressing Escape closes the drawer', () => {
    renderWithRouter(<OffersSection offers={[OFFER_BASE]} />);
    fireEvent.click(screen.getByRole('button', { name: /ver detalle de escapada romántica/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking the CTA link does NOT open the drawer (stopPropagation)', () => {
    renderWithRouter(<OffersSection offers={[OFFER_BASE]} />);
    // Click the CTA link directly — stopPropagation should prevent the card
    // button's onClick from firing.
    const cta = screen.getByRole('link', { name: /reservar oferta/i });
    fireEvent.click(cta);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // ── Room type pill ──────────────────────────────────────────────────────────

  it('renders "Aplica a: <name>" pill when offer has a roomType', () => {
    const offer: PublicOffer = {
      ...OFFER_BASE,
      roomType: { id: 'cuid0000000000000000000010', name: 'Suite Sumapaz' },
    };
    renderWithRouter(<OffersSection offers={[offer]} />);
    expect(screen.getByText('Aplica a: Suite Sumapaz')).toBeInTheDocument();
  });

  it('does NOT render a room type pill when roomType is null', () => {
    renderWithRouter(<OffersSection offers={[OFFER_BASE]} />);
    expect(screen.queryByText(/Aplica a:/)).toBeNull();
  });

  it('appends roomTypeId to the CTA href when offer has a roomType', () => {
    const CUID = 'cuid0000000000000000000011';
    const offer: PublicOffer = {
      ...OFFER_BASE,
      ctaText: 'Reservar',
      ctaLink: null,
      roomType: { id: CUID, name: 'Doble Deluxe' },
    };
    renderWithRouter(<OffersSection offers={[offer]} />);
    const link = screen.getByRole('link', { name: /reservar/i }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(
      `/booking?offer=${offer.id}&roomTypeId=${CUID}`,
    );
  });
});
