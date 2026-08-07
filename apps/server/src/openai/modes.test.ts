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

  it("blogs mode only exposes search_pages", () => {
    expect(getModeToolNames("blogs")).toEqual(["search_pages"]);
  });

  it("website_info mode exposes search_pages plus list_categories (grounds catalog-structure questions in real data)", () => {
    expect(getModeToolNames("website_info")).toEqual(["search_pages", "list_categories"]);
  });
});
