import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HeroGallery } from './HeroGallery';
import type { Photo } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PHOTOS: Photo[] = [
  { url: '/img/hotel_1.jpg', alt: 'Fachada del hotel' },
  { url: '/img/hotel_2.jpg', alt: 'Lobby principal' },
  { url: '/img/hotel_3.jpg', alt: 'Piscina' },
  { url: '/img/hotel_4.jpg', alt: 'Restaurante' },
  { url: '/img/hotel_5.jpg', alt: 'Jardín' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderGallery(photos: Photo[] = PHOTOS) {
  return render(<HeroGallery photos={photos} />);
}

// ---------------------------------------------------------------------------
// Empty-state
// ---------------------------------------------------------------------------

describe('HeroGallery — empty state', () => {
  it('renders a placeholder div when photos array is empty', () => {
    renderGallery([]);
    expect(screen.getByLabelText('Sin fotos disponibles')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Grid rendering
// ---------------------------------------------------------------------------

describe('HeroGallery — grid layout', () => {
  it('renders clickable photo buttons for the visible grid cells', () => {
    renderGallery();
    // The first photo should appear at least once as a button trigger
    const buttons = screen.getAllByRole('button', { name: 'Fachada del hotel' });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the "Ver las N fotos" button(s)', () => {
    renderGallery();
    const ctaButtons = screen.getAllByRole('button', { name: /ver las 5 fotos/i });
    // One for desktop grid, one for mobile grid
    expect(ctaButtons.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Opening the lightbox
// ---------------------------------------------------------------------------

describe('HeroGallery — opens lightbox', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('clicking a photo button opens the lightbox', () => {
    renderGallery();
    const photoBtn = screen.getAllByRole('button', { name: 'Fachada del hotel' })[0];
    fireEvent.click(photoBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('clicking "Ver las N fotos" opens the lightbox', () => {
    renderGallery();
    const cta = screen.getAllByRole('button', { name: /ver las 5 fotos/i })[0];
    fireEvent.click(cta);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lightbox opens at the correct photo index', () => {
    renderGallery();
    // Click the second photo (index 1 — "Lobby principal")
    const photoBtn = screen.getAllByRole('button', { name: 'Lobby principal' })[0];
    fireEvent.click(photoBtn);
    // Counter should show "2 / 5"
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });

  it('"Ver las N fotos" opens at index 0 (counter shows 1 / 5)', () => {
    renderGallery();
    const cta = screen.getAllByRole('button', { name: /ver las 5 fotos/i })[0];
    fireEvent.click(cta);
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
  });

  it('locks body scroll when the lightbox is open', () => {
    renderGallery();
    const photoBtn = screen.getAllByRole('button', { name: 'Fachada del hotel' })[0];
    fireEvent.click(photoBtn);
    expect(document.body.style.overflow).toBe('hidden');
  });
});

// ---------------------------------------------------------------------------
// Closing the lightbox
// ---------------------------------------------------------------------------

describe('HeroGallery — closes lightbox', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  function openLightbox() {
    renderGallery();
    fireEvent.click(screen.getAllByRole('button', { name: 'Fachada del hotel' })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  }

  it('X button closes the lightbox', () => {
    openLightbox();
    // There are two "Cerrar" buttons: backdrop + X header button
    const closeBtns = screen.getAllByRole('button', { name: 'Cerrar' });
    // The last one is the X icon in the header
    fireEvent.click(closeBtns[closeBtns.length - 1]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('backdrop click closes the lightbox', () => {
    openLightbox();
    const closeBtns = screen.getAllByRole('button', { name: 'Cerrar' });
    // The first one is the backdrop
    fireEvent.click(closeBtns[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ESC key closes the lightbox', () => {
    openLightbox();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('restores body scroll when the lightbox closes via ESC', () => {
    openLightbox();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Navigation inside the lightbox
// ---------------------------------------------------------------------------

describe('HeroGallery — lightbox navigation', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  function openAtFirst() {
    renderGallery();
    fireEvent.click(screen.getAllByRole('button', { name: /ver las 5 fotos/i })[0]);
  }

  it('next chevron advances to the next photo', () => {
    openAtFirst();
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });

  it('prev chevron goes to previous photo', () => {
    openAtFirst();
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Foto anterior' }));
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
  });

  it('navigation wraps around at the end (last → first)', () => {
    openAtFirst();
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    }
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
  });

  it('clicking a thumbnail updates the active index', () => {
    openAtFirst();
    fireEvent.click(screen.getByRole('button', { name: 'Ver foto 3' }));
    expect(screen.getByText('3 / 5')).toBeInTheDocument();
  });

  it('renders all thumbnails (5 buttons with aria-label "Ver foto N")', () => {
    openAtFirst();
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByRole('button', { name: `Ver foto ${i}` })).toBeInTheDocument();
    }
  });

  it('hides chevrons and thumbnail strip when there is only one photo', () => {
    // With a single photo the grid renders just the one clickable photo button
    // (no overlay / "Ver las N fotos" button because guards prevent rendering it).
    render(<HeroGallery photos={[PHOTOS[0]]} />);
    // There should be photo buttons but no "Ver las N fotos" (the guard skips that cell)
    const photoBtn = screen.getAllByRole('button', { name: 'Fachada del hotel' })[0];
    fireEvent.click(photoBtn);
    // Lightbox should open with 1 photo → no chevrons, no thumbnails
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Foto siguiente' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver foto 1' })).toBeNull();
  });
});
