import type { ActionCard } from "@mpe-chatbot/shared";

export function ProductListCard({
  card,
  onViewDetails,
}: {
  card: Extract<ActionCard, { type: "product_list" }>;
  onViewDetails: (productId: number) => void;
}) {
  return (
    <div className="mpe-card mpe-product-list">
      {card.products.map((p) => (
        <div key={p.id} className="mpe-list-item">
          <div className="mpe-list-item-info">
            <div className="mpe-list-item-name">{p.name}</div>
            <div className="mpe-list-item-meta">
              {p.sku && <span>SKU: {p.sku}</span>}
              {p.price > 0 && (
                <span>
                  {p.sku ? " · " : ""}
                  {p.price.toFixed(2)} {p.currency}
                </span>
              )}
            </div>
          </div>
          <button className="mpe-btn secondary mpe-list-item-btn" onClick={() => onViewDetails(p.id)}>
            View details
          </button>
        </div>
      ))}
    </div>
  );
}
