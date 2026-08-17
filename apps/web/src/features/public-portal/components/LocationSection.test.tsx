import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LocationSection } from './LocationSection';

describe('LocationSection', () => {
  const address = 'Centro Internacional, Bogotá';

  it('mounts an OpenStreetMap iframe with the hotel marker', () => {
    render(<LocationSection address={address} />);
    const iframe = screen.getByTitle(`Mapa de ${address}`) as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.src).toContain('openstreetmap.org/export/embed.html');
    expect(iframe.src).toContain('layer=mapnik');
    // marker=4.622724,-74.066401 URL-encoded
    expect(iframe.src).toContain('marker=4.622724%2C-74.066401');
    // bbox present (lon,lat,lon,lat order)
    expect(iframe.src).toMatch(/bbox=-74\.0734.+4\.6157.+-74\.0594.+4\.6297/);
  });

  it('renders the "Ver en mapa" external link with rel/noopener', () => {
    render(<LocationSection address={address} />);
    const link = screen.getByRole('link', { name: /ver en mapa/i }) as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.href).toContain('openstreetmap.org');
    expect(link.href).toContain('mlat=4.622724');
    expect(link.href).toContain('mlon=-74.066401');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
  });

  it('renders the address text', () => {
    render(<LocationSection address={address} />);
    expect(screen.getByText(address)).toBeInTheDocument();
  });

  it('renders all four landmarks with their distances', () => {
    render(<LocationSection address={address} />);
    const landmarks = [
      ['Parque Nacional', '3 min caminando'],
      ['Museo Nacional', '7 min caminando'],
      ['Cerro de Monserrate', '10 min en taxi'],
      ['Aeropuerto El Dorado', '30 min en taxi'],
    ];
    for (const [name, distance] of landmarks) {
      expect(screen.getByText(name)).toBeInTheDocument();
      expect(screen.getByText(distance)).toBeInTheDocument();
    }
  });

  it('preserves the #ubicacion anchor id (top nav scroll target)', () => {
    const { container } = render(<LocationSection address={address} />);
    expect(container.querySelector('#ubicacion')).not.toBeNull();
  });

  it('renders the "Ubicación" heading and "Cerca del hotel" subheading', () => {
    render(<LocationSection address={address} />);
    expect(screen.getByRole('heading', { name: 'Ubicación' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cerca del hotel' })).toBeInTheDocument();
  });

  it('does not render the old "Mapa interactivo · v1.2" placeholder', () => {
    render(<LocationSection address={address} />);
    expect(screen.queryByText(/mapa interactivo · v1\.2/i)).not.toBeInTheDocument();
  });
});
