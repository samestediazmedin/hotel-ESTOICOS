import { create } from 'zustand';
import type { ChatMessage, SuggestedAction, ToolResultEntry } from './types';

// ─── State interface ──────────────────────────────────────────────────────────

interface ContextPanelState {
  activeContext: string | null;
  /** Tool names called this conversation turn */
  sources: string[];
  suggestedActions: SuggestedAction[];
}

interface AiChatState {
  /** Panel open/closed */
  isOpen: boolean;
  /** Currently loaded conversation ID (null = new chat not yet persisted) */
  activeConversationId: string | null;
  /** All chat messages in display order */
  messages: ChatMessage[];
  /** True while the assistant is streaming a response */
  isStreaming: boolean;
  /** Right-side context panel state */
  contextPanel: ContextPanelState;

  // ── Panel controls ──────────────────────────────────────────────────────────
  open: () => void;
  close: () => void;

  // ── Conversation ────────────────────────────────────────────────────────────
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  appendMessage: (m: ChatMessage) => void;

  // ── Message mutation ────────────────────────────────────────────────────────
  appendContentDelta: (messageId: string, text: string) => void;
  addToolResultToMessage: (messageId: string, entry: ToolResultEntry) => void;
  markMessageDone: (messageId: string) => void;
  markMessageError: (messageId: string) => void;

  // ── Streaming flag ──────────────────────────────────────────────────────────
  setStreaming: (s: boolean) => void;

  // ── Context panel ───────────────────────────────────────────────────────────
  resetContext: () => void;
  addSource: (toolName: string) => void;
  addSuggestedAction: (a: SuggestedAction) => void;
  setActiveContext: (c: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAiChatStore = create<AiChatState>((set) => ({
  isOpen: false,
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  contextPanel: {
    activeContext: null,
    sources: [],
    suggestedActions: [],
  },

  // ── Panel controls ──────────────────────────────────────────────────────────
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  // ── Conversation ────────────────────────────────────────────────────────────
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),

  // ── Message mutation ────────────────────────────────────────────────────────
  appendContentDelta: (messageId, text) =>
    set((s) => ({
      messages: s.messages.map((msg) =>
        msg.id === messageId ? { ...msg, text: msg.text + text } : msg,
      ),
    })),

  addToolResultToMessage: (messageId, entry) =>
    set((s) => ({
      messages: s.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, toolResults: [...msg.toolResults, entry] }
          : msg,
      ),
    })),

  markMessageDone: (messageId) =>
    set((s) => ({
      messages: s.messages.map((msg) =>
        msg.id === messageId ? { ...msg, isStreaming: false } : msg,
      ),
    })),

  markMessageError: (messageId) =>
    set((s) => ({
      messages: s.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, isStreaming: false, isError: true }
          : msg,
      ),
    })),

  // ── Streaming flag ──────────────────────────────────────────────────────────
  setStreaming: (isStreaming) => set({ isStreaming }),

  // ── Context panel ───────────────────────────────────────────────────────────
  resetContext: () =>
    set({
      contextPanel: { activeContext: null, sources: [], suggestedActions: [] },
    }),

  addSource: (toolName) =>
    set((s) => ({
      contextPanel: {
        ...s.contextPanel,
        sources: s.contextPanel.sources.includes(toolName)
          ? s.contextPanel.sources
          : [...s.contextPanel.sources, toolName],
      },
    })),

  addSuggestedAction: (a) =>
    set((s) => ({
      contextPanel: {
        ...s.contextPanel,
        suggestedActions: [...s.contextPanel.suggestedActions, a],
      },
    })),

  setActiveContext: (c) =>
    set((s) => ({
      contextPanel: { ...s.contextPanel, activeContext: c },
    })),
}));
