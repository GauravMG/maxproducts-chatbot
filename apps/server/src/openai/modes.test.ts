import { describe, expect, it } from "vitest";
import { getModeToolNames } from "./modes.js";

describe("getModeToolNames", () => {
  it("menu mode has no restriction (full tool set)", () => {
    expect(getModeToolNames("menu")).toBeUndefined();
  });

  it("search_products, product_details, and ecommerce modes all include both product tools", () => {
    for (const mode of ["search_products", "product_details", "ecommerce"] as const) {
      const tools = getModeToolNames(mode);
      expect(tools).toContain("search_products");
      expect(tools).toContain("get_product_details");
    }
  });

  it("website_info and blogs modes only expose search_pages", () => {
    for (const mode of ["website_info", "blogs"] as const) {
      expect(getModeToolNames(mode)).toEqual(["search_pages"]);
    }
  });
});
