import { useCallback } from "react";
import type { WpWidgetContext } from "@mpe-chatbot/shared";
import { getOrCreateWidgetSessionId, streamChat } from "../api/client.js";
import { useChatStore } from "../state/chatStore.js";

export function useChatStream(apiUrl: string, context: WpWidgetContext | undefined) {
  const sending = useChatStore((s) => s.sending);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || useChatStore.getState().sending) return;

      const widgetSessionId = getOrCreateWidgetSessionId();
      const store = useChatStore.getState();
      store.setError(null);
      store.addUserMessage(trimmed);
      store.setSending(true);
      const assistantId = store.startAssistantMessage();

      await streamChat({
        apiUrl,
        widgetSessionId,
        message: trimmed,
        mode: store.mode,
        token: context?.loggedIn ? context.token : undefined,
        onEvent: (event) => {
          const s = useChatStore.getState();
          switch (event.type) {
            case "token":
              s.appendToken(assistantId, event.delta);
              break;
            case "tool_call_start":
              s.setToolHint(event.toolName);
              break;
            case "tool_call_result":
              s.setToolHint(null);
              break;
            case "action_cards":
              s.attachActionCards(assistantId, event.cards);
              break;
            case "message_complete":
              s.finalizeAssistantMessage(assistantId, event.message.content, event.message.actionCards);
              break;
            case "error":
              s.setError(event.message);
              break;
            case "done":
              s.setSending(false);
              break;
          }
        },
      });

      useChatStore.getState().setSending(false);
    },
    [apiUrl, context]
  );

  return { sendMessage, sending };
}
