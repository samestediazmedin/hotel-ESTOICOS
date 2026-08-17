import { create } from 'zustand';
import type { PricingBreakdown } from '@/features/pricing/types';

// ─── Step shapes ──────────────────────────────────────────────────────────────

export interface WizardStep1 {
  checkIn: string;    // "YYYY-MM-DD"
  checkOut: string;   // "YYYY-MM-DD"
  roomTypeId?: string;
  adults: number;
}

export interface WizardStep2 {
  /** Optional — null when the staff creates a request without a specific room (assigned at check-in). */
  roomId: string | null;
  roomTypeId: string;
  /** Optional — only present when roomId is set. */
  roomNumber: string | null;
  roomTypeName: string;
  pricingBreakdown: PricingBreakdown;
}

export interface WizardStep3 {
  guestId?: string;
  guestData?: Record<string, unknown>;
  isNewGuest: boolean;
}

export interface WizardStep4 {
  pricingBreakdown: PricingBreakdown;
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface ReservationWizardState {
  isOpen: boolean;
  currentStep: 1 | 2 | 3 | 4;
  step1: Partial<WizardStep1>;
  step2: Partial<WizardStep2>;
  step3: Partial<WizardStep3>;
  step4: Partial<WizardStep4>;
  openWizard: (prefill?: Partial<WizardStep1> & Partial<WizardStep2>) => void;
  closeWizard: () => void;
  setStep1: (data: WizardStep1) => void;
  setStep2: (data: WizardStep2) => void;
  setStep3: (data: WizardStep3) => void;
  setStep4: (data: WizardStep4) => void;
  goBack: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Reservation wizard Zustand slice.
 *
 * Key rules (research §3.8):
 * - goBack() does NOT clear current step data — user returns to pre-filled form.
 * - closeWizard() DOES clear all step data.
 * - openWizard(prefill) accepts optional pre-filled Step1 + Step2 fields
 *   (e.g. from clicking an empty cell on the room rack — provides checkIn, roomId).
 */
export const useReservationWizardStore = create<ReservationWizardState>((set) => ({
  isOpen: false,
  currentStep: 1,
  step1: {},
  step2: {},
  step3: {},
  step4: {},

  openWizard: (prefill = {}) =>
    set({
      isOpen: true,
      currentStep: 1,
      step1: { adults: 1, ...prefill },
      step2: prefill.roomId
        ? {
            roomId: prefill.roomId,
            roomTypeId: prefill.roomTypeId,
            roomNumber: prefill.roomNumber,
            roomTypeName: prefill.roomTypeName,
          }
        : {},
      step3: {},
      step4: {},
    }),

  closeWizard: () =>
    set({
      isOpen: false,
      currentStep: 1,
      step1: {},
      step2: {},
      step3: {},
      step4: {},
    }),

  setStep1: (data) => set({ step1: data, currentStep: 2 }),
  setStep2: (data) => set({ step2: data, currentStep: 3 }),
  setStep3: (data) => set({ step3: data, currentStep: 4 }),
  setStep4: (data) => set({ step4: data }),

  // CRITICAL: goBack does NOT clear step data — research §3.8 explicit rule.
  // Step components re-hydrate their forms from the store on mount.
  goBack: () =>
    set((s) => ({
      currentStep: Math.max(1, s.currentStep - 1) as 1 | 2 | 3 | 4,
    })),
}));
