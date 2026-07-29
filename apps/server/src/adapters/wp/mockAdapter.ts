import type { AccountDetails, Address, OrderSummary } from "@mpe-chatbot/shared";
import { PAGE_FIXTURES } from "./fixtures/pages.js";
import { PRODUCT_FIXTURES } from "./fixtures/products.js";
import { findMockCustomer } from "./fixtures/customers.js";
import type {
  InvoiceData,
  ProductRecord,
  SitePageRecord,
  WpAdapter,
  WpIdentityContext,
} from "./types.js";
import { WpAdapterError } from "./types.js";

function requireCustomer(identity: WpIdentityContext) {
  const customer = findMockCustomer(identity.userId);
  if (!customer) {
    throw new WpAdapterError(`No mock customer for userId ${identity.userId}`, "not_found");
  }
  return customer;
}

function toOrderSummary(order: { id: number; number: string; status: string; total: number; currency: string; dateCreated: string; itemsSummary: string }): OrderSummary {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    total: order.total,
    currency: order.currency,
    dateCreated: order.dateCreated,
    itemsSummary: order.itemsSummary,
  };
}

/**
 * Fully self-contained WpAdapter implementation backed by in-memory fixtures.
 * Active when WP_MODE=mock (the default) — no real WordPress instance required.
 */
export class MockWpAdapter implements WpAdapter {
  async listPages(): Promise<SitePageRecord[]> {
    return PAGE_FIXTURES;
  }

  async listProducts(): Promise<ProductRecord[]> {
    return PRODUCT_FIXTURES;
  }

  async getAccountDetails(identity: WpIdentityContext): Promise<AccountDetails> {
    return requireCustomer(identity).account;
  }

  async updateAccountDetails(
    identity: WpIdentityContext,
    data: Partial<AccountDetails>
  ): Promise<AccountDetails> {
    const customer = requireCustomer(identity);
    customer.account = { ...customer.account, ...data };
    return customer.account;
  }

  async getAddresses(identity: WpIdentityContext): Promise<{ billing: Address; shipping: Address }> {
    const customer = requireCustomer(identity);
    return { billing: customer.billing, shipping: customer.shipping };
  }

  async updateAddress(
    identity: WpIdentityContext,
    type: "billing" | "shipping",
    address: Address
  ): Promise<Address> {
    const customer = requireCustomer(identity);
    if (type === "billing") {
      customer.billing = address;
    } else {
      customer.shipping = address;
    }
    return address;
  }

  async listOrders(
    identity: WpIdentityContext,
    page: number,
    pageSize: number
  ): Promise<{ total: number; orders: OrderSummary[] }> {
    const customer = requireCustomer(identity);
    const sorted = [...customer.orders].sort(
      (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
    );
    const start = (page - 1) * pageSize;
    const pageOrders = sorted.slice(start, start + pageSize).map(toOrderSummary);
    return { total: customer.orders.length, orders: pageOrders };
  }

  async getOrderDetails(identity: WpIdentityContext, orderId: number) {
    const customer = requireCustomer(identity);
    const order = customer.orders.find((o) => o.id === orderId);
    if (!order) {
      throw new WpAdapterError(`Order ${orderId} not found for this customer`, "not_found");
    }
    return order;
  }

  async getInvoiceData(identity: WpIdentityContext, orderId: number): Promise<InvoiceData> {
    const order = await this.getOrderDetails(identity, orderId);
    return {
      orderId: order.id,
      orderNumber: order.number,
      dateCreated: order.dateCreated,
      currency: order.currency,
      lineItems: order.lineItems,
      total: order.total,
      billing: order.billing,
      shipping: order.shipping,
    };
  }

  async getInvoiceUrl(): Promise<string> {
    throw new WpAdapterError(
      "getInvoiceUrl is not available in mock mode — set INVOICE_STRATEGY=backend_pdf",
      "upstream_error"
    );
  }
}
