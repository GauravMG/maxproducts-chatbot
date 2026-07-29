import type { Address, OrderSummary, ProductSummary } from "./wp.js";

export type ActionButtonAction =
  | "open_url"
  | "open_product"
  | "open_order"
  | "download_invoice"
  | "login"
  | "view_details";

export interface ActionButton {
  id: string;
  label: string;
  action: ActionButtonAction;
  payload: Record<string, unknown>;
}

export type ActionCard =
  | { type: "product"; product: ProductSummary; actions: ActionButton[] }
  | { type: "order"; order: OrderSummary; actions: ActionButton[] }
  | {
      type: "address_confirmation";
      addressType: "billing" | "shipping";
      address: Address;
    }
  | { type: "action_buttons"; buttons: ActionButton[] }
  | { type: "login_prompt"; loginUrl: string; message: string }
  // A narrowed batch of search results the user can pick from — attached deterministically
  // by the server (not left to the model) whenever a product search yields a manageable,
  // pickable set. Clicking an item calls a plain, non-LLM endpoint (see ChatActionRequest).
  | { type: "product_list"; products: ProductSummary[] };

/**
 * Declares intent up front so the server can restrict which tools the model is even
 * allowed to call for a given turn, instead of relying on prompt-following alone to
 * pick the right behavior out of every possible tool. "menu" = no mode selected yet,
 * full general-purpose assistant behavior (today's default, all tools available).
 */
export type ChatMode =
  | "menu"
  | "search_products"
  | "product_details"
  | "website_info"
  | "blogs"
  | "ecommerce";

export type ChatRole = "user" | "assistant";

export interface ChatMessageDTO {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string | null;
  actionCards?: ActionCard[];
  createdAt: string;
}

export interface WpWidgetContext {
  loggedIn: boolean;
  token?: string;
  expiresAt?: number;
  restBase?: string;
  refreshUrl?: string;
  loginUrl?: string;
}

export interface ChatStreamRequest {
  widgetSessionId: string;
  message: string;
  mode?: ChatMode;
  pageUrl?: string;
  pageTitle?: string;
}

/** Deterministic, non-LLM action — e.g. clicking a specific item in a product_list card.
 * Handled by POST /api/chat/action: a plain JSON request/response, no streaming, no
 * model involved, so it's instant and 100% reliable regardless of what the model would
 * have done. Currently only one action type exists; the shape leaves room for more. */
export interface ChatActionRequest {
  widgetSessionId: string;
  action: "view_product_details";
  productId: number;
}
