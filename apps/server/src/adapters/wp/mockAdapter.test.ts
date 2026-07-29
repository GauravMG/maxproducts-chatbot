import { describe, expect, it } from "vitest";
import { MockWpAdapter } from "./mockAdapter.js";
import { WpAdapterError } from "./types.js";

const DEALER = { userId: 101, token: "unused-in-mock-mode" };
const UNKNOWN = { userId: 99999, token: "unused" };

describe("MockWpAdapter", () => {
  it("lists a non-empty, realistic product catalog", async () => {
    const adapter = new MockWpAdapter();
    const products = await adapter.listProducts();
    expect(products.length).toBeGreaterThan(50);
    expect(products[0]).toHaveProperty("attributes.brand");
  });

  it("lists site pages", async () => {
    const adapter = new MockWpAdapter();
    const pages = await adapter.listPages();
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.some((p) => p.url.includes("maxpowereu.com"))).toBe(true);
  });

  it("returns and updates account details for a known customer", async () => {
    const adapter = new MockWpAdapter();
    const before = await adapter.getAccountDetails(DEALER);
    expect(before.email).toContain("@");

    const updated = await adapter.updateAccountDetails(DEALER, { phone: "+353 1 234 5678" });
    expect(updated.phone).toBe("+353 1 234 5678");

    const after = await adapter.getAccountDetails(DEALER);
    expect(after.phone).toBe("+353 1 234 5678");
  });

  it("updates a shipping address independently of billing", async () => {
    const adapter = new MockWpAdapter();
    const originalBilling = (await adapter.getAddresses(DEALER)).billing;

    const newShipping = {
      firstName: "Test",
      lastName: "User",
      address1: "1 Test Street",
      city: "Testville",
      postcode: "T1 T1T1",
      country: "IE",
    };
    await adapter.updateAddress(DEALER, "shipping", newShipping);

    const addresses = await adapter.getAddresses(DEALER);
    expect(addresses.shipping.address1).toBe("1 Test Street");
    expect(addresses.billing).toEqual(originalBilling);
  });

  it("paginates orders and rejects access to an unknown customer", async () => {
    const adapter = new MockWpAdapter();
    const { total, orders } = await adapter.listOrders(DEALER, 1, 2);
    expect(total).toBeGreaterThanOrEqual(orders.length);
    expect(orders.length).toBeLessThanOrEqual(2);

    await expect(adapter.listOrders(UNKNOWN, 1, 10)).rejects.toBeInstanceOf(WpAdapterError);
  });

  it("derives invoice data from an order the customer actually owns", async () => {
    const adapter = new MockWpAdapter();
    const { orders } = await adapter.listOrders(DEALER, 1, 1);
    const orderId = orders[0].id;

    const invoice = await adapter.getInvoiceData(DEALER, orderId);
    expect(invoice.orderId).toBe(orderId);
    expect(invoice.lineItems.length).toBeGreaterThan(0);
  });

  it("throws not_found for an order id that doesn't belong to the customer", async () => {
    const adapter = new MockWpAdapter();
    await expect(adapter.getOrderDetails(DEALER, 999999)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
