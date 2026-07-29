import { describe, expect, it, beforeAll } from "vitest";
import "./index.js";
import { getTool, type ToolContext } from "./registry.js";
import { prisma } from "../../db/prisma.js";

// Exercises each tool's actual handler (schema validation -> business logic -> audit
// logging -> action card) directly, the same code path the orchestrator calls after a
// model tool-call — without needing a live OpenAI round trip for every scenario.

const ANON_CTX: ToolContext = { sessionId: "unused-by-informational-handlers", mode: "menu" };
let AUTH_CTX: ToolContext;

beforeAll(async () => {
  // ActionAuditLog.sessionId is a real FK to ChatSession.id (a generated UUID) — the
  // write-tool tests below need an actual row, not an arbitrary string.
  const session = await prisma.chatSession.upsert({
    where: { widgetSessionId: "integration-test-session" },
    create: { widgetSessionId: "integration-test-session" },
    update: {},
  });
  AUTH_CTX = {
    sessionId: session.id,
    mode: "menu",
    wpIdentity: { userId: 101, email: "aidan@murphytools.example", name: "Aidan Murphy", token: "t" },
  };
});

describe("informational tools", () => {
  it("search_pages returns ranked results", async () => {
    const tool = getTool("search_pages")!;
    const input = tool.schema.parse({ query: "returns policy" });
    const result = await tool.handler(input, ANON_CTX);
    expect((result.data as any).results.length).toBeGreaterThan(0);
  });

  it("search_products returns items + facets", async () => {
    const tool = getTool("search_products")!;
    const input = tool.schema.parse({ category: "Cordless Power Tools" });
    const result = await tool.handler(input, ANON_CTX);
    const data = result.data as any;
    expect(data.total).toBeGreaterThan(0);
    expect(data.facets.categories.length).toBeGreaterThan(0);
  });

  it("get_product_details attaches a product action card", async () => {
    const search = getTool("search_products")!;
    const searchInput = search.schema.parse({ category: "Cordless Power Tools" });
    const { data } = await search.handler(searchInput, ANON_CTX);
    const productId = (data as any).items[0].id;

    const tool = getTool("get_product_details")!;
    const input = tool.schema.parse({ productId });
    const result = await tool.handler(input, ANON_CTX);

    expect(result.actionCard?.type).toBe("product");
    if (result.actionCard?.type === "product") {
      expect(result.actionCard.product.id).toBe(productId);
      expect(result.actionCard.actions[0].action).toBe("open_product");
      expect(result.actionCard.actions[0].payload.url).toContain("maxpowereu.com");
    }
  });

  it("get_product_details returns an error payload (not a throw) for an unknown id", async () => {
    const tool = getTool("get_product_details")!;
    const input = tool.schema.parse({ productId: 999999999 });
    const result = await tool.handler(input, ANON_CTX);
    expect((result.data as any).error).toBe("not_found");
    expect(result.actionCard).toBeUndefined();
  });
});

describe("account tools (authenticated)", () => {
  it("get_account_details / update_account_details round-trip", async () => {
    const get = getTool("get_account_details")!;
    const before = await get.handler(get.schema.parse({}), AUTH_CTX);
    expect((before.data as any).email).toContain("@");

    const update = getTool("update_account_details")!;
    const input = update.schema.parse({ phone: "+353 87 000 1111" });
    const updated = await update.handler(input, AUTH_CTX);
    expect((updated.data as any).phone).toBe("+353 87 000 1111");

    const log = await prisma.actionAuditLog.findFirst({
      where: { sessionId: AUTH_CTX.sessionId, actionType: "update_account" },
      orderBy: { createdAt: "desc" },
    });
    expect(log?.status).toBe("success");
  });

  it("update_address attaches an address_confirmation card and audits it", async () => {
    const tool = getTool("update_address")!;
    const input = tool.schema.parse({
      type: "shipping",
      address: {
        firstName: "Aidan",
        lastName: "Murphy",
        address1: "99 Integration Test Way",
        city: "Cork",
        postcode: "T12 TEST",
        country: "IE",
      },
    });
    const result = await tool.handler(input, AUTH_CTX);
    expect(result.actionCard?.type).toBe("address_confirmation");

    const log = await prisma.actionAuditLog.findFirst({
      where: { sessionId: AUTH_CTX.sessionId, actionType: "update_shipping_address" },
      orderBy: { createdAt: "desc" },
    });
    expect(log?.status).toBe("success");
  });

  it("list_orders -> get_order_details -> get_invoice full chain, with a matching action card each step", async () => {
    const list = getTool("list_orders")!;
    const { data: listData } = await list.handler(list.schema.parse({}), AUTH_CTX);
    const orderId = (listData as any).orders[0].id;

    const getOrder = getTool("get_order_details")!;
    const orderResult = await getOrder.handler(getOrder.schema.parse({ orderId }), AUTH_CTX);
    expect(orderResult.actionCard?.type).toBe("order");

    const getInvoice = getTool("get_invoice")!;
    const invoiceResult = await getInvoice.handler(getInvoice.schema.parse({ orderId }), AUTH_CTX);
    expect(invoiceResult.actionCard?.type).toBe("action_buttons");
    if (invoiceResult.actionCard?.type === "action_buttons") {
      expect(invoiceResult.actionCard.buttons[0].payload.url).toMatch(/^\/api\/invoices\//);
    }

    const log = await prisma.actionAuditLog.findFirst({
      where: { sessionId: AUTH_CTX.sessionId, actionType: "download_invoice" },
      orderBy: { createdAt: "desc" },
    });
    expect(log?.status).toBe("success");
  });

  it("get_order_details throws for an order that doesn't belong to this customer, and logs failure for get_invoice", async () => {
    const getOrder = getTool("get_order_details")!;
    await expect(getOrder.handler(getOrder.schema.parse({ orderId: 999999 }), AUTH_CTX)).rejects.toBeTruthy();

    const getInvoice = getTool("get_invoice")!;
    await expect(
      getInvoice.handler(getInvoice.schema.parse({ orderId: 999999 }), AUTH_CTX)
    ).rejects.toBeTruthy();

    const log = await prisma.actionAuditLog.findFirst({
      where: { sessionId: AUTH_CTX.sessionId, actionType: "download_invoice", status: "failure" },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeTruthy();
  });
});
