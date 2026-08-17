import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { DesignSystemPage } from './DesignSystemPage';

describe('DesignSystemPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders without crashing', () => {
    render(<DesignSystemPage />);
    expect(screen.getByTestId('design-system-page')).toBeInTheDocument();
  });

  it('renders all 6 status pills with Spanish labels', () => {
    render(<DesignSystemPage />);
    const expected: Array<[string, string]> = [
      ['status-pill-available',   'Disponible'],
      ['status-pill-reserved',    'Reservada'],
      ['status-pill-occupied',    'Ocupada'],
      ['status-pill-cleaning',    'Limpieza'],
      ['status-pill-maintenance', 'Mantenimiento'],
      ['status-pill-blocked',     'Bloqueada'],
    ];
    for (const [testid, label] of expected) {
      const pill = screen.getByTestId(testid);
      expect(pill).toBeInTheDocument();
      expect(within(pill).getByText(label)).toBeInTheDocument();
    }
  });

  it('clicking ThemeToggle flips data-theme on documentElement', async () => {
    const user = userEvent.setup();
    render(<DesignSystemPage />);
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    const toggle = screen.getByRole('button', { name: /modo oscuro/i });
    await user.click(toggle);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    const toggleAgain = screen.getByRole('button', { name: /modo claro/i });
    await user.click(toggleAgain);
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('persists theme choice to localStorage', async () => {
    const user = userEvent.setup();
    render(<DesignSystemPage />);
    await user.click(screen.getByRole('button', { name: /modo oscuro/i }));
    expect(window.localStorage.getItem('hos-theme')).toBe('dark');
    await user.click(screen.getByRole('button', { name: /modo claro/i }));
    expect(window.localStorage.getItem('hos-theme')).toBe('light');
  });

  it('renders all 7 Button variants by visible label', () => {
    render(<DesignSystemPage />);
    const variants = ['default', 'terracotta', 'destructive', 'outline', 'secondary', 'ghost', 'link'];
    for (const v of variants) {
      // At least one button with the variant name as text content
      const matches = screen.getAllByText(v, { selector: 'button' });
      expect(matches.length).toBeGreaterThan(0);
    }
  });
});
