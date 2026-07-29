import { describe, expect, it } from "vitest";
import { BackendPdfInvoiceStrategy } from "./backendPdfStrategy.js";
import { MockWpAdapter } from "../wp/mockAdapter.js";
import { verifyToken } from "../../auth/token.js";
import { env } from "../../config/env.js";

const DEALER = { userId: 101, token: "unused-in-mock-mode" };

describe("BackendPdfInvoiceStrategy", () => {
  it("issues a download URL embedding a verifiable, correctly-scoped token", async () => {
    const adapter = new MockWpAdapter();
    const strategy = new BackendPdfInvoiceStrategy(adapter);
    const { orders } = await adapter.listOrders(DEALER, 1, 1);
    const orderId = orders[0].id;

    const invoice = await strategy.getInvoice(DEALER, orderId);
    expect(invoice.url).toMatch(/^\/api\/invoices\//);
    expect(invoice.expiresAt).toBeInstanceOf(Date);
    expect(invoice.expiresAt!.getTime()).toBeGreaterThan(Date.now());

    const token = invoice.url.replace("/api/invoices/", "");
    const result = verifyToken<{ orderId: number; userId: number; wpToken: string }>(
      token,
      env.WP_SHARED_SECRET
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.orderId).toBe(orderId);
      expect(result.payload.userId).toBe(101);
    }
  });

  it("refuses to issue an invoice link for an order the customer doesn't own", async () => {
    const adapter = new MockWpAdapter();
    const strategy = new BackendPdfInvoiceStrategy(adapter);
    await expect(strategy.getInvoice(DEALER, 999999)).rejects.toMatchObject({ code: "not_found" });
  });
});
