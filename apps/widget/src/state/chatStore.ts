import { create } from "zustand";
import type { ActionCard, ChatMessageDTO, ChatMode } from "@mpe-chatbot/shared";

export interface ChatMessageView {
  id: string;
  role: "user" | "assistant";
  content: string;
  actionCards?: ActionCard[];
  streaming?: boolean;
}

function genId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface ChatState {
  open: boolean;
  mode: ChatMode;
  messages: ChatMessageView[];
  sending: boolean;
  toolHint: string | null;
  error: string | null;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setMode: (mode: ChatMode) => void;
  addUserMessage: (content: string) => void;
  startAssistantMessage: () => string;
  appendToken: (id: string, delta: string) => void;
  setToolHint: (hint: string | null) => void;
  attachActionCards: (id: string, cards: ActionCard[]) => void;
  finalizeAssistantMessage: (id: string, content: string | null, actionCards?: ActionCard[]) => void;
  /** Injects a message received outside the normal streaming flow — e.g. the
   * deterministic, non-LLM response from clicking an item in a product_list card. */
  appendMessage: (message: ChatMessageDTO) => void;
  setSending: (sending: boolean) => void;
  setError: (error: string | null) => void;
  resetConversation: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  open: false,
  mode: "menu",
  messages: [],
  sending: false,
  toolHint: null,
  error: null,

  toggleOpen: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
  setMode: (mode) => set({ mode }),

  addUserMessage: (content) =>
    set((s) => ({
      messages: [...s.messages, { id: genId(), role: "user", content }],
    })),

  startAssistantMessage: () => {
    const id = genId();
    set((s) => ({
      messages: [...s.messages, { id, role: "assistant", content: "", streaming: true }],
    }));
    return id;
  },

  appendToken: (id, delta) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
    })),

  setToolHint: (hint) => set({ toolHint: hint }),

  attachActionCards: (id, cards) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, actionCards: cards } : m)),
    })),

  finalizeAssistantMessage: (id, content, actionCards) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? { ...m, content: content ?? m.content, actionCards: actionCards ?? m.actionCards, streaming: false }
          : m
      ),
      toolHint: null,
    })),

  appendMessage: (message) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: message.id,
          role: message.role,
          content: message.content ?? "",
          actionCards: message.actionCards,
          streaming: false,
        },
      ],
    })),

  setSending: (sending) => set({ sending }),
  setError: (error) => set({ error }),

  resetConversation: () => set({ messages: [], mode: "menu", toolHint: null, error: null, sending: false }),
}));
