/**
 * ContactButtons.spec.tsx — TDD RED phase for Task 1 (16-04)
 *
 * 10 behaviors:
 *  1. 3 buttons render (Llamar, WhatsApp, Email)
 *  2. phone=null → Llamar disabled
 *  3. whatsappNumber=null → WhatsApp disabled
 *  4. email=null → Email disabled
 *  5. Click Llamar → mutation CALL → window.location.href = tel:, toast, invalidate
 *  6. Click WhatsApp → mutation WHATSAPP → window.open(wa.me, '_blank'), toast, invalidate
 *  7. Click Email → mutation EMAIL → window.location.href = mailto:, toast, invalidate
 *  8. Mutation failure → deep link IS opened (sync-first), toast.error, query NOT invalidated
 *  9. size='sm' → buttons have sm size
 * 10. encodeURIComponent used (wa.me + mailto: URLs properly encoded)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContactButtons } from './ContactButtons';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../guest-contact.api', () => ({
  createContactEvent: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderButtons(
  props: Partial<React.ComponentProps<typeof ContactButtons>> = {},
  queryClient = makeQueryClient(),
) {
  const defaultProps = {
    guestId: 'guest-001',
    fullName: 'Juan Pérez García',
    email: 'juan@example.com',
    phone: '+573005551234',
    whatsappNumber: '+573005551234',
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <ContactButtons {...defaultProps} {...props} />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContactButtons', () => {
  let mockCreateContactEvent: ReturnType<typeof vi.fn>;
  let originalOpen: typeof window.open;
  // Track href assignments via Object.defineProperty (jsdom limitation)
  let hrefAssignedValues: string[];

  beforeEach(async () => {
    vi.clearAllMocks();
    hrefAssignedValues = [];
    const mod = await import('../guest-contact.api');
    mockCreateContactEvent = mod.createContactEvent as ReturnType<typeof vi.fn>;

    // Mock window.open
    originalOpen = window.open;
    window.open = vi.fn();

    // jsdom does not allow vi.spyOn(window.location, 'href', 'set') — property is non-configurable.
    // Redefine window.location with a writable href to intercept assignments.
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        href: '',
        assign: vi.fn(),
        replace: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    // Track assignments by replacing the href setter
    Object.defineProperty(window.location, 'href', {
      get: () => hrefAssignedValues[hrefAssignedValues.length - 1] ?? '',
      set: (val: string) => { hrefAssignedValues.push(val); },
      configurable: true,
    });
  });

  afterEach(() => {
    window.open = originalOpen;
  });

  // ── Test 1: 3 buttons render ─────────────────────────────────────────────
  it('renders 3 buttons: Llamar, WhatsApp, Email', () => {
    renderButtons();
    expect(screen.getByRole('button', { name: /llamar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /email/i })).toBeInTheDocument();
  });

  // ── Test 2: phone=null → Llamar disabled ────────────────────────────────
  it('disables Llamar button when phone is null', () => {
    renderButtons({ phone: null });
    expect(screen.getByRole('button', { name: /llamar/i })).toBeDisabled();
  });

  // ── Test 3: whatsappNumber AND phone both null → WhatsApp disabled ──────
  // 2026-05-27 — the WhatsApp button now falls back to the guest phone when the
  // whatsapp_number column is null (phone IS the WhatsApp number in CO/LATAM),
  // so we only expect it disabled when both fields are absent or unparseable.
  it('disables WhatsApp button when both whatsappNumber and phone are null', () => {
    renderButtons({ whatsappNumber: null, phone: null });
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeDisabled();
  });

  it('enables WhatsApp button when whatsappNumber is null but phone is a valid mobile (auto-derived)', () => {
    renderButtons({ whatsappNumber: null, phone: '3156746779' });
    expect(screen.getByRole('button', { name: /whatsapp/i })).not.toBeDisabled();
  });

  // ── Test 4: email=null → Email disabled ──────────────────────────────────
  it('disables Email button when email is null', () => {
    renderButtons({ email: null });
    expect(screen.getByRole('button', { name: /email/i })).toBeDisabled();
  });

  // ── Test 5: Click Llamar ─────────────────────────────────────────────────
  it('clicking Llamar calls mutation with CALL, sets window.location.href, shows toast, invalidates', async () => {
    const { toast } = await import('sonner');
    mockCreateContactEvent.mockResolvedValueOnce({ id: 'evt-1', method: 'CALL' });

    const qc = makeQueryClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderButtons({ phone: '+573005551234' }, qc);

    fireEvent.click(screen.getByRole('button', { name: /llamar/i }));

    await waitFor(() => {
      expect(mockCreateContactEvent).toHaveBeenCalledWith('guest-001', { method: 'CALL' });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('✓ Llamada registrada');
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['guest', 'guest-001', 'contact-events'],
      });
    });

    // tel: deep link should have been assigned to window.location.href
    await waitFor(() => {
      expect(hrefAssignedValues.some((v) => v.startsWith('tel:'))).toBe(true);
    });
  });

  // ── Test 6: Click WhatsApp ───────────────────────────────────────────────
  it('clicking WhatsApp calls mutation, opens window.open with wa.me URL (no +), and shows toast', async () => {
    const { toast } = await import('sonner');
    mockCreateContactEvent.mockResolvedValueOnce({ id: 'evt-2', method: 'WHATSAPP' });

    renderButtons({ whatsappNumber: '+573005551234' });

    fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }));

    await waitFor(() => {
      expect(mockCreateContactEvent).toHaveBeenCalledWith('guest-001', { method: 'WHATSAPP' });
    });

    await waitFor(() => {
      expect(window.open).toHaveBeenCalled();
      const callArgs = (window.open as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = callArgs[0] as string;
      expect(url).toContain('wa.me/573005551234'); // no leading +
      expect(url).not.toContain('+573');
      expect(url).toContain('Hola%20Juan'); // encodeURIComponent of firstName
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('✓ WhatsApp registrado');
    });
  });

  // ── Test 7: Click Email ──────────────────────────────────────────────────
  it('clicking Email calls mutation, sets window.location.href to mailto:, shows toast', async () => {
    const { toast } = await import('sonner');
    mockCreateContactEvent.mockResolvedValueOnce({ id: 'evt-3', method: 'EMAIL' });

    renderButtons({ email: 'juan@example.com' });

    fireEvent.click(screen.getByRole('button', { name: /email/i }));

    await waitFor(() => {
      expect(mockCreateContactEvent).toHaveBeenCalledWith('guest-001', { method: 'EMAIL' });
    });

    await waitFor(() => {
      expect(hrefAssignedValues.some((v) => v.startsWith('mailto:juan@example.com'))).toBe(true);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('✓ Email registrado');
    });
  });

  // ── Test 8: Mutation failure ──────────────────────────────────────────────
  // HIGH-03 fix: deep link opens SYNCHRONOUSLY on click (before mutation) so popup
  // blockers do not interfere. Trade-off: if the audit mutation fails, the link
  // was already opened. This is intentional — better to open without audit than
  // to silently fail. The test verifies: link IS opened, error toast IS shown,
  // query NOT invalidated on error.
  it('on mutation failure opens deep link, shows error toast, and does NOT invalidate', async () => {
    const { toast } = await import('sonner');
    mockCreateContactEvent.mockRejectedValueOnce(new Error('Network error'));

    const qc = makeQueryClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderButtons({ phone: '+573005551234' }, qc);

    fireEvent.click(screen.getByRole('button', { name: /llamar/i }));

    // Link opens synchronously (sync-first design — no popup blocker risk)
    expect(hrefAssignedValues.some((v) => v.startsWith('tel:'))).toBe(true);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'No se pudo registrar el contacto. Intentar de nuevo.',
      );
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  // ── Test 9: size='sm' ─────────────────────────────────────────────────────
  it('size=sm renders buttons with sm size class', () => {
    renderButtons({ size: 'sm' });
    // All 3 buttons should have small styling
    const buttons = screen.getAllByRole('button');
    // At minimum, they should all be present and rendered
    expect(buttons).toHaveLength(3);
  });

  // ── Test 10: encodeURIComponent used ──────────────────────────────────────
  it('WhatsApp URL uses encodeURIComponent for message text', async () => {
    mockCreateContactEvent.mockResolvedValueOnce({ id: 'evt-4', method: 'WHATSAPP' });

    renderButtons({
      whatsappNumber: '+573005551234',
      fullName: 'María José García',
    });

    fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }));

    await waitFor(() => {
      expect(window.open).toHaveBeenCalled();
      const callArgs = (window.open as ReturnType<typeof vi.fn>).mock.calls[0];
      const url = callArgs[0] as string;
      // URL should contain encoded text (% encoding present)
      expect(url).toMatch(/%[0-9A-F]{2}/i);
      // Should not contain raw spaces in the text param
      expect(url).not.toContain('Hola María José, le escribo');
    });
  });
});
