import type { ActionCard } from "@mpe-chatbot/shared";
import { runAction } from "../../lib/runAction.js";

export function ActionButtonsCard({
  card,
  apiUrl,
}: {
  card: Extract<ActionCard, { type: "action_buttons" }>;
  apiUrl: string;
}) {
  return (
    <div className="mpe-card-actions">
      {card.buttons.map((action) => (
        <button key={action.id} className="mpe-btn" onClick={() => runAction(action, apiUrl)}>
          {action.label}
        </button>
      ))}
    </div>
  );
}
