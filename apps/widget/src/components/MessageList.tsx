import { useEffect, useRef } from "react";
import { useChatStore } from "../state/chatStore.js";
import type { MenuOption } from "../lib/menuOptions.js";
import { MessageBubble } from "./MessageBubble.js";
import { MenuOptions } from "./MenuOptions.js";

export function MessageList({
  apiUrl,
  onViewProductDetails,
  onSelectMenuOption,
}: {
  apiUrl: string;
  onViewProductDetails: (productId: number) => void;
  onSelectMenuOption: (option: MenuOption) => void;
}) {
  const messages = useChatStore((s) => s.messages);
  const mode = useChatStore((s) => s.mode);
  const toolHint = useChatStore((s) => s.toolHint);
  const error = useChatStore((s) => s.error);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, toolHint, mode]);

  return (
    <div className="mpe-messages">
      {messages.length === 0 && (
        <div className="mpe-bubble-row assistant">
          <div className="mpe-bubble assistant">
            Hi! I'm the Max Power Europe assistant. Pick an option below, or just type your question.
          </div>
        </div>
      )}
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} apiUrl={apiUrl} onViewProductDetails={onViewProductDetails} />
      ))}
      {mode === "menu" && <MenuOptions onSelect={onSelectMenuOption} />}
      {toolHint && <div className="mpe-tool-hint">Looking up {toolHint.replace(/_/g, " ")}...</div>}
      {error && <div className="mpe-error-banner">{error}</div>}
      <div ref={bottomRef} />
    </div>
  );
}
