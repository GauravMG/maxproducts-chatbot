import type { ChatMessageView } from "../state/chatStore.js";
import { formatMessageText } from "../lib/formatText.js";
import { ActionCardRenderer } from "./cards/ActionCardRenderer.js";

export function MessageBubble({
  message,
  apiUrl,
}: {
  message: ChatMessageView;
  apiUrl: string;
}) {
  // Some messages carry only action cards, no text — skip the empty text bubble for those.
  const showTextBubble = message.content || message.streaming;

  return (
    <>
      {showTextBubble && (
        <div className={`mpe-bubble-row ${message.role}`}>
          <div className={`mpe-bubble ${message.role}`}>
            {message.content ? (
              formatMessageText(message.content)
            ) : (
              <span className="mpe-typing">
                <span />
                <span />
                <span />
              </span>
            )}
          </div>
        </div>
      )}
      {message.actionCards?.map((card, i) => (
        <div className="mpe-bubble-row assistant" key={i}>
          <ActionCardRenderer card={card} apiUrl={apiUrl} />
        </div>
      ))}
    </>
  );
}
