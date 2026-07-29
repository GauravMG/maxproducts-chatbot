import type { ActionCard } from "@mpe-chatbot/shared";
import { runAction } from "../../lib/runAction.js";

export function OrderCard({
  card,
  apiUrl,
}: {
  card: Extract<ActionCard, { type: "order" }>;
  apiUrl: string;
}) {
  const { order } = card;
  return (
    <div className="mpe-card">
      <div className="mpe-card-title">Order {order.number}</div>
      <div className="mpe-card-row">
        <span>Status</span>
        <span>{order.status}</span>
      </div>
      <div className="mpe-card-row">
        <span>Total</span>
        <span>
          {order.total.toFixed(2)} {order.currency}
        </span>
      </div>
      <div className="mpe-card-row">
        <span>Date</span>
        <span>{new Date(order.dateCreated).toLocaleDateString()}</span>
      </div>
      <div className="mpe-card-row">
        <span>Items</span>
        <span>{order.itemsSummary}</span>
      </div>
      <div className="mpe-card-actions">
        {card.actions.map((action) => (
          <button
            key={action.id}
            className={action.action === "download_invoice" ? "mpe-btn secondary" : "mpe-btn"}
            onClick={() => runAction(action, apiUrl)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
