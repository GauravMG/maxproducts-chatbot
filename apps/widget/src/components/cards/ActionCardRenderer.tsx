import type { ActionCard } from "@mpe-chatbot/shared";
import { ProductCard } from "./ProductCard.js";
import { OrderCard } from "./OrderCard.js";
import { AddressCard } from "./AddressCard.js";
import { ActionButtonsCard } from "./ActionButtonsCard.js";
import { LoginPromptCard } from "./LoginPromptCard.js";

export function ActionCardRenderer({ card, apiUrl }: { card: ActionCard; apiUrl: string }) {
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
    default:
      return null;
  }
}
