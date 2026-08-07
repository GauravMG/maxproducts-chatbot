import {
  getProductDetailsInput,
  searchPagesInput,
  searchProductsInput,
  type ActionButton,
} from "@mpe-chatbot/shared";
import { searchPages } from "../../search/pages.js";
import { getProductDetails, searchProducts } from "../../search/products.js";
import { registerTool } from "./registry.js";

registerTool({
  name: "search_pages",
  description:
    "Search the website's informational pages/content (About, Contact, shipping & returns, blog posts, category descriptions) to answer questions about the site or company. Always use this instead of guessing when asked about site content, policies, or company info.",
  requiresAuth: false,
  schema: searchPagesInput,
  handler: async (input, ctx) => {
    // "blogs"/"website_info" modes restrict this to their own slice of content
    // (see search/pages.ts's PageSourceFilter) — outside a guided mode, no restriction.
    const sourceFilter = ctx.mode === "blogs" ? "blogs" : ctx.mode === "website_info" ? "pages" : undefined;
    const results = await searchPages(input.query, input.limit ?? 5, sourceFilter);
    return { data: { results } };
  },
});

registerTool({
  name: "search_products",
  description:
    "Search/filter the product catalog. Always call this for any product question instead of answering from memory. If the user gives a SKU or product code, pass it as `sku` — never append it to `query` as plain text, since `query` uses text search and a SKU combined with other words there matches nothing. Returns matched items plus a `facets` breakdown (category/brand counts, price range) — use facets to ask a clarifying question when there are many results instead of listing them all. When `total` is 0, check the `suggestions` field: if present, these are the closest things we actually carry (near-name matches or the same search with narrowing filters relaxed) — likely what the user meant, or the nearest alternative; describe 2-3 of them by name so the user can react. Once the user is looking at one specific product, call get_product_details with its id (or sku) to get a proper card and the full description.",
  requiresAuth: false,
  schema: searchProductsInput,
  handler: async (input) => {
    const result = await searchProducts(input);
    return { data: result };
  },
});

registerTool({
  name: "get_product_details",
  description:
    "Get full details for one specific product by id, slug, or exact sku, e.g. after the user picks one from a narrowed list, or gives an exact SKU. Attaches a product card with an 'open product page' button for the user.",
  requiresAuth: false,
  schema: getProductDetailsInput,
  handler: async (input) => {
    const product = await getProductDetails(input);
    if (!product) {
      return { data: { error: "not_found" } };
    }
    const actions: ActionButton[] = [
      {
        id: "open",
        label: "View product page",
        action: "open_product",
        payload: { productId: product.id, url: product.permalink },
      },
    ];
    return { data: product, actionCard: { type: "product", product, actions } };
  },
});
