import type {
  AccountDetails,
  Address,
  OrderDetail,
  OrderSummary,
  ProductDetail,
  ProductSummary,
} from "@mpe-chatbot/shared";

/** Trusted identity of the chat visitor, attached to every account-scoped adapter call. */
export interface WpIdentityContext {
  userId: number;
  /** Raw HMAC token from the widget — forwarded as-is to the WP plugin in live mode; unused by the mock adapter. */
  token: string;
}

export interface SitePageRecord {
  url: string;
  title: string;
  excerpt: string;
  content: string;
  source: "wp_page" | "wp_post" | "woo_category" | "woo_shop";
}

export interface ProductRecord extends ProductDetail {}

export interface InvoiceData {
  orderId: number;
  orderNumber: string;
  dateCreated: string;
  currency: string;
  lineItems: OrderDetail["lineItems"];
  total: number;
  billing: Address;
  shipping: Address;
}

/**
 * The single seam between the chatbot's business logic and WordPress/WooCommerce.
 * `mockAdapter` (default, WP_MODE=mock) is a fully self-contained fixture-backed
 * implementation. `liveAdapter` (WP_MODE=live) calls the real WooCommerce REST API
 * (catalog reads) and the mpe-chatbot companion WP plugin (account-scoped reads/writes).
 * Swapping implementations is a config change only — nothing above this layer knows
 * or cares which one is active.
 */
export interface WpAdapter {
  listPages(): Promise<SitePageRecord[]>;
  listProducts(): Promise<ProductRecord[]>;

  getAccountDetails(identity: WpIdentityContext): Promise<AccountDetails>;
  updateAccountDetails(
    identity: WpIdentityContext,
    data: Partial<AccountDetails>
  ): Promise<AccountDetails>;

  getAddresses(identity: WpIdentityContext): Promise<{ billing: Address; shipping: Address }>;
  updateAddress(
    identity: WpIdentityContext,
    type: "billing" | "shipping",
    address: Address
  ): Promise<Address>;

  listOrders(
    identity: WpIdentityContext,
    page: number,
    pageSize: number
  ): Promise<{ total: number; orders: OrderSummary[] }>;
  getOrderDetails(identity: WpIdentityContext, orderId: number): Promise<OrderDetail>;

  getInvoiceData(identity: WpIdentityContext, orderId: number): Promise<InvoiceData>;
  /** Only meaningful when INVOICE_STRATEGY=wp_plugin_url; throws if no WP invoice plugin is configured. */
  getInvoiceUrl(identity: WpIdentityContext, orderId: number): Promise<string>;
}

export class WpAdapterError extends Error {
  constructor(
    message: string,
    public code: "not_found" | "forbidden" | "upstream_error" = "upstream_error"
  ) {
    super(message);
    this.name = "WpAdapterError";
  }
}
