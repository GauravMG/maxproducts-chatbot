import { describe, expect, it } from "vitest";
import { getModeToolNames, shouldAttachProductList } from "./modes.js";

describe("getModeToolNames", () => {
  it("menu mode has no restriction (full tool set)", () => {
    expect(getModeToolNames("menu")).toBeUndefined();
  });

  it("search_products mode excludes get_product_details entirely", () => {
    const tools = getModeToolNames("search_products");
    expect(tools).toContain("search_products");
    expect(tools).not.toContain("get_product_details");
  });

  it("product_details and ecommerce modes include both product tools", () => {
    for (const mode of ["product_details", "ecommerce"] as const) {
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

describe("shouldAttachProductList", () => {
  it("search_products mode: attaches for 1-8 results, not for 0 or >8", () => {
    expect(shouldAttachProductList("search_products", 0)).toBe(false);
    expect(shouldAttachProductList("search_products", 1)).toBe(true);
    expect(shouldAttachProductList("search_products", 8)).toBe(true);
    expect(shouldAttachProductList("search_products", 9)).toBe(false);
  });

  it("product_details/ecommerce modes: only attaches for genuine ambiguity (2-8), not a single match", () => {
    for (const mode of ["product_details", "ecommerce"] as const) {
      expect(shouldAttachProductList(mode, 0)).toBe(false);
      expect(shouldAttachProductList(mode, 1)).toBe(false); // single match -> get_product_details handles it
      expect(shouldAttachProductList(mode, 2)).toBe(true);
      expect(shouldAttachProductList(mode, 8)).toBe(true);
      expect(shouldAttachProductList(mode, 9)).toBe(false);
    }
  });

  it("menu/website_info/blogs modes never attach a product list", () => {
    for (const mode of ["menu", "website_info", "blogs"] as const) {
      expect(shouldAttachProductList(mode, 3)).toBe(false);
    }
  });
});
