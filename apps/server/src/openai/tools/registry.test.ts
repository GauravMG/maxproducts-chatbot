import { describe, expect, it } from "vitest";
import "./index.js"; // registers all tools as a side effect
import { getAllTools, getTool, toOpenAITools } from "./registry.js";

const EXPECTED_TOOL_NAMES = [
  "search_pages",
  "list_categories",
  "search_products",
  "get_product_details",
  "get_account_details",
  "update_account_details",
  "get_addresses",
  "update_address",
  "list_orders",
  "get_order_details",
  "get_invoice",
];

const EXPECTED_AUTH_REQUIRED = new Set([
  "get_account_details",
  "update_account_details",
  "get_addresses",
  "update_address",
  "list_orders",
  "get_order_details",
  "get_invoice",
]);

describe("tool registry", () => {
  it("registers exactly the expected tools", () => {
    const names = getAllTools()
      .map((t) => t.name)
      .sort();
    expect(names).toEqual([...EXPECTED_TOOL_NAMES].sort());
  });

  it("marks account tools requiresAuth:true and informational tools requiresAuth:false", () => {
    for (const tool of getAllTools()) {
      expect(tool.requiresAuth).toBe(EXPECTED_AUTH_REQUIRED.has(tool.name));
    }
  });

  it("produces a valid OpenAI function-calling tool array", () => {
    const tools = toOpenAITools();
    expect(tools).toHaveLength(EXPECTED_TOOL_NAMES.length);
    for (const t of tools) {
      expect(t.type).toBe("function");
      expect(t.function.name).toBeTruthy();
      expect(t.function.description.length).toBeGreaterThan(10);
      expect(t.function.parameters).toBeTypeOf("object");
    }
  });

  it("rejects invalid arguments via each tool's zod schema", () => {
    const updateAddress = getTool("update_address")!;
    const badResult = updateAddress.schema.safeParse({ type: "not-a-real-type", address: {} });
    expect(badResult.success).toBe(false);

    const getProductDetails = getTool("get_product_details")!;
    // Neither productId nor slug provided — should fail the .refine() check.
    expect(getProductDetails.schema.safeParse({}).success).toBe(false);
    expect(getProductDetails.schema.safeParse({ productId: 1000 }).success).toBe(true);
  });

  it("accepts well-formed arguments", () => {
    const updateAddress = getTool("update_address")!;
    const result = updateAddress.schema.safeParse({
      type: "billing",
      address: {
        firstName: "A",
        lastName: "B",
        address1: "1 Main St",
        city: "Cork",
        postcode: "T12",
        country: "IE",
      },
    });
    expect(result.success).toBe(true);
  });
});
