import type { ActionCard } from "@mpe-chatbot/shared";
import { ProductCard } from "./ProductCard.js";
import { OrderCard } from "./OrderCard.js";
import { AddressCard } from "./AddressCard.js";
import { ActionButtonsCard } from "./ActionButtonsCard.js";
import { LoginPromptCard } from "./LoginPromptCard.js";
import { ProductListCard } from "./ProductListCard.js";

export function ActionCardRenderer({
  card,
  apiUrl,
  onViewProductDetails,
}: {
  card: ActionCard;
  apiUrl: string;
  onViewProductDetails: (productId: number) => void;
}) {
  switch (card.type) {
    case "product":
      return <ProductCard card={card} apiUrl={apiUrl} />;
    case "order":
      return <OrderCard card={card} apiUrl={apiUrl} />;
    case "address_confirmation":
      return <AddressCard card={card} />;
    case "action_buttons":
      return <ActionButtonsCard card={card} apiUrl={apiUrl} />;
    case "login_prompt":
      return <LoginPromptCard card={card} />;
    case "product_list":
      return <ProductListCard card={card} onViewDetails={onViewProductDetails} />;
    default:
      return null;
  }
}
