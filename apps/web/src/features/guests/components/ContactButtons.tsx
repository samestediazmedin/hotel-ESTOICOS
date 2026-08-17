/**
 * ContactButtons — reusable 3-button contact strip (Phase 16-04, GCC-10)
 *
 * Renders Llamar / WhatsApp / Email buttons for a guest.
 * On click:
 *  1. POSTs a contact event via createContactEvent (tracked audit trail)
 *  2. On success: opens the corresponding deep link
 *  3. Shows Spanish success toast via sonner
 *  4. Invalidates ['guest', guestId, 'contact-events'] query
 *
 * Each button is disabled when the corresponding contact data is null.
 *
 * Deep link behavior (per CONTEXT.md + research trap anti-pattern):
 *  - tel: + mailto:  → window.location.href (same-tab, OS handles)
 *  - wa.me           → window.open(url, '_blank') (new tab — must NOT use location.href)
 *
 * Zero hex colors. Token utilities only.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Phone, MessageCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createContactEvent } from '../guest-contact.api';
import type { ContactMethod } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContactButtonsProps {
  guestId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  size?: 'sm' | 'md';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOAST_TEXT: Record<ContactMethod, string> = {
  CALL: '✓ Llamada registrada',
  WHATSAPP: '✓ WhatsApp registrado',
  EMAIL: '✓ Email registrado',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * normalizePhoneToE164 — frontend mirror of the backend helper of the same name.
 * Lets the WhatsApp button work for legacy guests whose whatsapp_number column is
 * NULL but whose phone column contains a usable number (Colombian mobile or
 * already-E.164). Returns null when the input cannot be interpreted safely.
 */
function normalizePhoneToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const stripped = raw.replace(/[\s()\-.]/g, '');
  if (/^\+[1-9]\d{6,14}$/.test(stripped)) return stripped;
  if (/^00[1-9]\d{6,14}$/.test(stripped)) return '+' + stripped.slice(2);
  if (/^[0-9]{10}$/.test(stripped)) return '+57' + stripped; // Colombian mobile default
  if (/^[1-9]\d{10,14}$/.test(stripped)) return '+' + stripped;
  return null;
}

// ─── Deep link builder ────────────────────────────────────────────────────────

interface DeepLinkGuest {
  phone?: string | null;
  email?: string | null;
  whatsappNumber?: string | null;
  fullName: string;
}

function buildDeepLink(method: ContactMethod, guest: DeepLinkGuest): string {
  const firstName = guest.fullName.split(' ')[0];

  switch (method) {
    case 'CALL':
      return `tel:${guest.phone ?? ''}`;

    case 'WHATSAPP': {
      // Strip leading + from E.164 number — wa.me requires digits only (research trap pitfall #6)
      const stripped = (guest.whatsappNumber ?? '').replace(/^\+/, '');
      const text = encodeURIComponent(
        `Hola ${firstName}, le escribo desde el Hotel Sumapaz. `,
      );
      return `https://wa.me/${stripped}?text=${text}`;
    }

    case 'EMAIL': {
      const subject = encodeURIComponent('Hotel Sumapaz');
      const body = encodeURIComponent(`Estimado/a ${guest.fullName},`);
      return `mailto:${guest.email ?? ''}?subject=${subject}&body=${body}`;
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContactButtons({
  guestId,
  fullName,
  email,
  phone,
  whatsappNumber,
  size = 'md',
}: ContactButtonsProps) {
  const queryClient = useQueryClient();
  const btnSize = size === 'sm' ? 'sm' : 'default';

  // If the guest record never captured a WhatsApp number, fall back to a
  // normalised version of their phone — in Colombia the mobile phone IS the
  // WhatsApp number, so this avoids the button being uselessly disabled for
  // 100% of bookings made through the public form (which does not ask for a
  // separate WhatsApp number).
  const effectiveWhatsapp = whatsappNumber ?? normalizePhoneToE164(phone);

  const mutation = useMutation({
    mutationFn: (method: ContactMethod) =>
      createContactEvent(guestId, { method }),

    onSuccess: (_data, variables) => {
      toast.success(TOAST_TEXT[variables]);
      void queryClient.invalidateQueries({
        queryKey: ['guest', guestId, 'contact-events'],
      });
    },

    onError: () => {
      toast.error('No se pudo registrar el contacto. Intentar de nuevo.');
    },
  });

  /**
   * Handle contact button click.
   *
   * Deep link is opened SYNCHRONOUSLY from the click handler — BEFORE the async
   * mutation — so popup blockers (Chrome, Firefox, Safari) do not block window.open.
   * Popup blockers only allow window.open inside a synchronous user gesture.
   * The audit mutation is fire-and-forget: if it fails, the link still opened.
   *
   * WhatsApp → window.open(_blank): wa.me must NOT use location.href (breaks navigation).
   * CALL / EMAIL → window.location.href: OS handles tel:/mailto: in same tab.
   */
  const handleContact = (method: ContactMethod) => {
    const link = buildDeepLink(method, {
      phone,
      email,
      whatsappNumber: effectiveWhatsapp,
      fullName,
    });

    // Open BEFORE async to pass popup blocker check
    if (method === 'WHATSAPP') {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = link;
    }

    // Audit trail — fire-and-forget
    mutation.mutate(method);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Llamar */}
      <Button
        type="button"
        variant="outline"
        size={btnSize}
        disabled={!phone || mutation.isPending}
        onClick={() => handleContact('CALL')}
        aria-label="Llamar"
        title={phone ? `Llamar a ${phone}` : 'Sin número de teléfono'}
      >
        <Phone className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        Llamar
      </Button>

      {/* WhatsApp — uses effectiveWhatsapp so phone-derived numbers light up the button */}
      <Button
        type="button"
        variant="outline"
        size={btnSize}
        disabled={!effectiveWhatsapp || mutation.isPending}
        onClick={() => handleContact('WHATSAPP')}
        aria-label="WhatsApp"
        title={effectiveWhatsapp ? `WhatsApp a ${effectiveWhatsapp}` : 'Sin número de WhatsApp'}
      >
        <MessageCircle className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        WhatsApp
      </Button>

      {/* Email */}
      <Button
        type="button"
        variant="outline"
        size={btnSize}
        disabled={!email || mutation.isPending}
        onClick={() => handleContact('EMAIL')}
        aria-label="Email"
        title={email ? `Enviar email a ${email}` : 'Sin dirección de email'}
      >
        <Mail className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        Email
      </Button>
    </div>
  );
}
