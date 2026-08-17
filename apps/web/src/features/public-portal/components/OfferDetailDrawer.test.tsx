import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { OfferDetailDrawer } from './OfferDetailDrawer';
import type { PublicOffer } from '../types';

const OFFER: PublicOffer = {
  id: 'offer_42',
  title: 'Escapada romántica',
  description: 'Habitación con vista a los cerros,\nbotella de vino + desayuno a la cama.',
  imageUrl: 'https://example.com/r2/offers/romantica.jpg',
  badge: '-20%',
  validFrom: '2026-05-01',
  validTo: '2026-08-31',
  ctaText: 'Reservar oferta',
  ctaLink: null,
  roomType: null,
};

function renderDrawer(offer: PublicOffer, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <OfferDetailDrawer offer={offer} onClose={onClose} />
    </MemoryRouter>,
  );
}

describe('OfferDetailDrawer', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('renders the offer title, badge, description, and validity', () => {
    renderDrawer(OFFER);
    expect(screen.getByRole('heading', { name: 'Escapada romántica' })).toBeInTheDocument();
    expect(screen.getByText('-20%')).toBeInTheDocument();
    expect(screen.getByText(/botella de vino/)).toBeInTheDocument();
    expect(screen.getByText(/v[aá]lido del .+ 2026 al .+ 2026/i)).toBeInTheDocument();
  });

  it('renders the offer image with the title as alt text', () => {
    renderDrawer(OFFER);
    const img = screen.getByAltText('Escapada romántica') as HTMLImageElement;
    expect(img.src).toBe(OFFER.imageUrl);
  });

  it('renders an internal /booking?offer=<id> CTA when ctaLink is null', () => {
    renderDrawer(OFFER);
    const cta = screen.getByRole('link', { name: /reservar oferta/i }) as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/booking?offer=offer_42');
  });

  it('renders an external CTA with target=_blank when ctaLink is absolute', () => {
    const offer: PublicOffer = {
      ...OFFER,
      ctaLink: 'https://reservas.example.com/promo',
      ctaText: 'Ver más',
    };
    renderDrawer(offer);
    const cta = screen.getByRole('link', { name: /ver más/i }) as HTMLAnchorElement;
    expect(cta.href).toBe('https://reservas.example.com/promo');
    expect(cta.target).toBe('_blank');
    expect(cta.rel).toContain('noopener');
  });

  it('defaults the CTA text to "Reservar" when ctaText is null', () => {
    renderDrawer({ ...OFFER, ctaText: null });
    expect(screen.getByRole('link', { name: /reservar/i })).toBeInTheDocument();
  });

  it('omits description when description is null', () => {
    renderDrawer({ ...OFFER, description: null });
    // Only the title and badge should be present; no body text beyond validity
    expect(screen.queryByText(/botella de vino/)).toBeNull();
  });

  it('omits the validity line when both dates are null', () => {
    renderDrawer({ ...OFFER, validFrom: null, validTo: null });
    expect(screen.queryByText(/v[aá]lido/i)).toBeNull();
  });

  it('renders "Válido desde" when only validFrom is set', () => {
    renderDrawer({ ...OFFER, validTo: null });
    expect(screen.getByText(/válido desde/i)).toBeInTheDocument();
  });

  it('renders "Válido hasta" when only validTo is set', () => {
    renderDrawer({ ...OFFER, validFrom: null });
    expect(screen.getByText(/válido hasta/i)).toBeInTheDocument();
  });

  it('omits the badge span when badge is null', () => {
    renderDrawer({ ...OFFER, badge: null });
    expect(screen.queryByText('-20%')).toBeNull();
  });

  it('calls onClose when the X button is clicked', () => {
    const onClose = vi.fn();
    renderDrawer(OFFER, onClose);
    // There are two "Cerrar" buttons: backdrop and the X. The X is the last one.
    const closeButtons = screen.getAllByRole('button', { name: 'Cerrar' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    renderDrawer(OFFER, onClose);
    const closeButtons = screen.getAllByRole('button', { name: 'Cerrar' });
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderDrawer(OFFER, onClose);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('locks body scroll while open and restores on unmount', () => {
    const { unmount } = renderDrawer(OFFER);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('has role="dialog" with aria-modal="true" and aria-labelledby pointing at the title', () => {
    renderDrawer(OFFER);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', `offer-detail-${OFFER.id}-title`);
    expect(document.getElementById(`offer-detail-${OFFER.id}-title`)).toHaveTextContent(
      'Escapada romántica',
    );
  });

  it('preserves newlines in description via whitespace-pre-line', () => {
    renderDrawer(OFFER);
    // The \n in description is rendered as-is; the text node still contains the newline
    const descEl = screen.getByText(/botella de vino/);
    expect(descEl.textContent).toContain('\n');
  });

  // ── Room type pill ──────────────────────────────────────────────────────────

  it('renders "Aplica a: <name>" pill in the detail panel when roomType is set', () => {
    renderDrawer({
      ...OFFER,
      roomType: { id: 'cuid0000000000000000000020', name: 'Suite Sumapaz' },
    });
    expect(screen.getByText('Aplica a: Suite Sumapaz')).toBeInTheDocument();
  });

  it('does NOT render a room type pill when roomType is null', () => {
    renderDrawer(OFFER);
    expect(screen.queryByText(/Aplica a:/)).toBeNull();
  });

  it('appends roomTypeId to the CTA href when roomType is set', () => {
    const CUID = 'cuid0000000000000000000021';
    renderDrawer({
      ...OFFER,
      roomType: { id: CUID, name: 'Doble Deluxe' },
    });
    const cta = screen.getByRole('link', { name: /reservar oferta/i }) as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe(
      `/booking?offer=${OFFER.id}&roomTypeId=${CUID}`,
    );
  });
});
