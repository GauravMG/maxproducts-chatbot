import { useCallback } from "react";
import { useWpIdentity } from "./hooks/useWpIdentity.js";
import { useChatStream } from "./hooks/useChatStream.js";
import { useChatStore } from "./state/chatStore.js";
import { fetchProductDetailsAction, getOrCreateWidgetSessionId, resetWidgetSessionId } from "./api/client.js";
import type { MenuOption } from "./lib/menuOptions.js";
import { ChatButton } from "./components/ChatButton.js";
import { ChatPanel } from "./components/ChatPanel.js";

export interface WidgetProps {
  apiUrl: string;
}

export function Widget({ apiUrl }: WidgetProps) {
  const open = useChatStore((s) => s.open);
  const toggleOpen = useChatStore((s) => s.toggleOpen);
  const setOpen = useChatStore((s) => s.setOpen);
  const resetConversation = useChatStore((s) => s.resetConversation);

  const { context } = useWpIdentity();
  const { sendMessage, sending } = useChatStream(apiUrl, context);

  const handleNewChat = () => {
    resetWidgetSessionId();
    resetConversation();
  };

  const handleViewProductDetails = useCallback(
    async (productId: number) => {
      const store = useChatStore.getState();
      store.setError(null);
      try {
        const message = await fetchProductDetailsAction(apiUrl, getOrCreateWidgetSessionId(), productId);
        store.appendMessage(message);
      } catch (err) {
        store.setError(`Couldn't load that product's details: ${(err as Error).message}`);
      }
    },
    [apiUrl]
  );

  const handleSelectMenuOption = useCallback(
    (option: MenuOption) => {
      // setMode is a synchronous zustand update, so sendMessage (which reads the
      // current mode via getState() the moment it runs) is guaranteed to see it.
      useChatStore.getState().setMode(option.mode);
      sendMessage(option.starterMessage);
    },
    [sendMessage]
  );

  return (
    <div className="mpe-root">
      {open ? (
        <ChatPanel
          apiUrl={apiUrl}
          context={context}
          sending={sending}
          onSend={sendMessage}
          onClose={() => setOpen(false)}
          onNewChat={handleNewChat}
          onViewProductDetails={handleViewProductDetails}
          onSelectMenuOption={handleSelectMenuOption}
        />
      ) : (
        <ChatButton onClick={toggleOpen} />
      )}
    </div>
  );
}
