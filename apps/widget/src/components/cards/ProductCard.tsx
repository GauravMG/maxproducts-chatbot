import type { ActionCard } from "@mpe-chatbot/shared";
import { runAction } from "../../lib/runAction.js";

export function ProductCard({
  card,
  apiUrl,
}: {
  card: Extract<ActionCard, { type: "product" }>;
  apiUrl: string;
}) {
  const { product } = card;
  return (
    <div className="mpe-card">
      {product.imageUrl && <img className="mpe-card-img" src={product.imageUrl} alt={product.name} />}
      <div className="mpe-card-title">{product.name}</div>
      <div className="mpe-card-row">
        <span>{product.category}</span>
        <span>
          {product.price > 0 ? (
            product.salePrice ? (
              <>
                <s>{product.regularPrice?.toFixed(2)}</s> {product.salePrice.toFixed(2)} {product.currency}
              </>
            ) : (
              `${product.price.toFixed(2)} ${product.currency}`
            )
          ) : (
            "Price on request"
          )}
        </span>
      </div>
      <div className="mpe-card-row">
        <span>{product.attributes.brand}</span>
        <span>{product.stockStatus === "instock" ? "In stock" : "Out of stock"}</span>
      </div>
      <div className="mpe-card-actions">
        {card.actions.map((action) => (
          <button key={action.id} className="mpe-btn" onClick={() => runAction(action, apiUrl)}>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
