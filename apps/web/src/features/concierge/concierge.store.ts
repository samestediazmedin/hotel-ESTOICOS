import { create } from 'zustand';
import type { ConciergeMessage, VenueCardData } from './types';

// ─── State interface ──────────────────────────────────────────────────────────

interface ConciergeState {
  messages: ConciergeMessage[];
  isStreaming: boolean;
  csrfToken: string | null;
  /** True when 20/hr IP rate limit is reached */
  isOverLimit: boolean;
  /** True when daily token budget is exhausted */
  isCircuitBreaker: boolean;

  /** Whether the ConciergeDrawer slide-over is open (used by FAB + drawer globally) */
  isDrawerOpen: boolean;

  // ── Actions ─────────────────────────────────────────────────────────────────
  openDrawer: () => void;
  closeDrawer: () => void;
  addMessage: (m: ConciergeMessage) => void;
  appendContentDelta: (id: string, text: string) => void;
  markMessageDone: (id: string) => void;
  setMessageText: (id: string, text: string) => void;
  attachToolResults: (id: string, results: VenueCardData[]) => void;
  setCsrfToken: (t: string) => void;
  setStreaming: (v: boolean) => void;
  setOverLimit: (v: boolean) => void;
  setCircuitBreaker: (v: boolean) => void;
  setMessageError: (id: string, err: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useConciergeStore = create<ConciergeState>((set) => ({
  messages: [],
  isStreaming: false,
  csrfToken: null,
  isOverLimit: false,
  isCircuitBreaker: false,
  isDrawerOpen: false,

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),

  appendContentDelta: (id, text) =>
    set((s) => ({
      messages: s.messages.map((msg) =>
        msg.id === id ? { ...msg, text: msg.text + text } : msg,
      ),
    })),

  markMessageDone: (id) =>
    set((s) => ({
      messages: s.messages.map((msg) =>
        msg.id === id ? { ...msg, isStreaming: false } : msg,
      ),
    })),

  setMessageText: (id, text) =>
    set((s) => ({
      messages: s.messages.map((msg) =>
        msg.id === id ? { ...msg, text } : msg,
      ),
    })),

  attachToolResults: (id, results) =>
    set((s) => ({
      messages: s.messages.map((msg) =>
        msg.id === id
          ? { ...msg, toolResults: [...(msg.toolResults ?? []), ...results] }
          : msg,
      ),
    })),

  setCsrfToken: (t) => set({ csrfToken: t }),
  setStreaming: (v) => set({ isStreaming: v }),
  setOverLimit: (v) => set({ isOverLimit: v }),
  setCircuitBreaker: (v) => set({ isCircuitBreaker: v }),

  setMessageError: (id, err) =>
    set((s) => ({
      messages: s.messages.map((msg) =>
        msg.id === id ? { ...msg, error: err, isStreaming: false } : msg,
      ),
    })),
}));
