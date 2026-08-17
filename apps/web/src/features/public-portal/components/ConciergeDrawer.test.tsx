import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConciergeDrawer } from './ConciergeDrawer';

// ─── Mock ConciergeContent ────────────────────────────────────────────────────
// The drawer tests focus on drawer behaviour (open/close, a11y, backdrop).
// ConciergeContent pulls in QueryClient, MSW handlers and jsdom stubs that
// belong to its own test suite — mocking it here keeps the drawer tests clean.

vi.mock('@/features/concierge/ConciergeContent', () => ({
  ConciergeContent: () => <div data-testid="concierge-content-mock">Chat content</div>,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderDrawer(open: boolean, onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConciergeDrawer open={open} onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConciergeDrawer', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('renders the dialog with title when open=true', () => {
    renderDrawer(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Concierge IA')).toBeInTheDocument();
  });

  it('renders the embedded chat content', () => {
    renderDrawer(true);
    expect(screen.getByTestId('concierge-content-mock')).toBeInTheDocument();
  });

  it('is off-screen (translate-x-full) when open=false', () => {
    renderDrawer(false);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('translate-x-full');
    expect(dialog.className).not.toContain('translate-x-0');
  });

  it('is on-screen (translate-x-0) when open=true', () => {
    renderDrawer(true);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('translate-x-0');
    expect(dialog.className).not.toContain('translate-x-full');
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = renderDrawer(true, onClose);
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderDrawer(true, onClose);
    const closeBtn = screen.getByRole('button', { name: /Cerrar concierge/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    renderDrawer(true, onClose);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll when open', () => {
    renderDrawer(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when closed', () => {
    const { rerender } = renderDrawer(true);
    expect(document.body.style.overflow).toBe('hidden');

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ConciergeDrawer open={false} onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(document.body.style.overflow).toBe('');
  });
});
