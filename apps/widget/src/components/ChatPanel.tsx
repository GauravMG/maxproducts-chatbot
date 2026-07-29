import type { WpWidgetContext } from "@mpe-chatbot/shared";
import { useChatStore } from "../state/chatStore.js";
import { getMenuOption, type MenuOption } from "../lib/menuOptions.js";
import { MessageList } from "./MessageList.js";
import { InputBar } from "./InputBar.js";

export function ChatPanel({
  apiUrl,
  context,
  sending,
  onSend,
  onClose,
  onNewChat,
  onViewProductDetails,
  onSelectMenuOption,
}: {
  apiUrl: string;
  context: WpWidgetContext | undefined;
  sending: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
  onNewChat: () => void;
  onViewProductDetails: (productId: number) => void;
  onSelectMenuOption: (option: MenuOption) => void;
}) {
  const mode = useChatStore((s) => s.mode);
  const setMode = useChatStore((s) => s.setMode);
  const activeOption = getMenuOption(mode);

  return (
    <div className="mpe-panel">
      <div className="mpe-header">
        <div>
          <div className="mpe-header-title">Max Power Europe Assistant</div>
          <div className="mpe-header-subtitle">
            {context?.loggedIn ? "Logged in" : "Browsing as guest"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className="mpe-close-btn" onClick={onNewChat} aria-label="Start a new chat" title="New chat">
            &#8635;
          </button>
          <button className="mpe-close-btn" onClick={onClose} aria-label="Close chat">
            &times;
          </button>
        </div>
      </div>
      {activeOption && (
        <div className="mpe-mode-bar">
          <span>
            {activeOption.icon} {activeOption.label}
          </span>
          <button className="mpe-mode-bar-back" onClick={() => setMode("menu")}>
            &larr; Menu
          </button>
        </div>
      )}
      <MessageList apiUrl={apiUrl} onViewProductDetails={onViewProductDetails} onSelectMenuOption={onSelectMenuOption} />
      <InputBar sending={sending} onSend={onSend} placeholder={activeOption?.placeholder} />
    </div>
  );
}
