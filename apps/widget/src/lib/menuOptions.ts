import type { ChatMode } from "@mpe-chatbot/shared";

export interface MenuOption {
  mode: Exclude<ChatMode, "menu">;
  icon: string;
  label: string;
  description: string;
  placeholder: string;
  /** Sent as a real user message the moment this option is picked, so the bot
   * immediately responds and kicks off the guided flow instead of waiting silently
   * for the visitor to type something first. */
  starterMessage: string;
}

// Account management (view/update address, orders, invoices) is intentionally left out
// of the menu for now — the underlying tools exist and still work if asked about
// directly in "menu" mode, this is just about what's promoted as a guided flow today.
export const MENU_OPTIONS: MenuOption[] = [
  {
    mode: "search_products",
    icon: "🔍",
    label: "Search products",
    description: "Browse the catalog and narrow down by category, brand, or price",
    placeholder: "What are you looking for?",
    starterMessage: "I'd like to search for products.",
  },
  {
    mode: "product_details",
    icon: "📦",
    label: "Product details",
    description: "Get full details on a specific product you already have in mind",
    placeholder: "Which product? (name or description)",
    starterMessage: "I'd like to see details for a specific product.",
  },
  {
    mode: "website_info",
    icon: "ℹ️",
    label: "Website info",
    description: "Ask about policies, shipping, company info, or site content",
    placeholder: "What would you like to know?",
    starterMessage: "I have a question about the website.",
  },
  {
    mode: "blogs",
    icon: "📰",
    label: "Search blogs",
    description: "Find articles and guides from the blog",
    placeholder: "What topic are you interested in?",
    starterMessage: "Show me some blog articles.",
  },
  {
    mode: "ecommerce",
    icon: "🛒",
    label: "Buy a product",
    description: "Find something specific and go straight to the product page to buy it",
    placeholder: "What would you like to buy?",
    starterMessage: "I'd like to buy a product.",
  },
];

export function getMenuOption(mode: ChatMode): MenuOption | undefined {
  return MENU_OPTIONS.find((o) => o.mode === mode);
}
