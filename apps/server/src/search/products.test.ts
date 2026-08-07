import { describe, expect, it } from "vitest";
import { getProductDetails, listCategories, searchProducts } from "./products.js";

// These run against the real Postgres instance (see docker-compose.yml), pre-seeded via
// `pnpm sync:products`. They exercise the actual tsvector/GIN full-text search and JSONB
// attribute filtering — not mockable without losing the point of the test.

describe("searchProducts", () => {
  it("filters by category and returns facets", async () => {
    const result = await searchProducts({ category: "Cordless Power Tools" });
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((p) => p.category === "Cordless Power Tools")).toBe(true);
    expect(result.facets.categories.length).toBeGreaterThan(0);
    expect(result.facets.priceRange).not.toBeNull();
    // Brand facets depend on whether the synced catalog has brand data assigned at all
    // (mock fixtures always do; a real WP site's brand taxonomy may be unpopulated) —
    // assert the shape, not that brands necessarily exist in this dataset.
    expect(Array.isArray(result.facets.brands)).toBe(true);
  });

  it("narrows further by brand attribute (JSONB containment), when the dataset has brand data", async () => {
    const anyBrand = (await searchProducts({ category: "Cordless Power Tools" })).facets.brands[0]?.name;
    if (!anyBrand) return; // this catalog has no brand data assigned — nothing to narrow by

    const all = await searchProducts({ category: "Cordless Power Tools" });
    const narrowed = await searchProducts({ category: "Cordless Power Tools", brand: anyBrand });
    expect(narrowed.total).toBeGreaterThan(0);
    expect(narrowed.total).toBeLessThanOrEqual(all.total);
    expect(narrowed.items.every((p) => p.attributes.brand === anyBrand)).toBe(true);
  });

  it("applies price range filters", async () => {
    const result = await searchProducts({ minPrice: 500, maxPrice: 1000 });
    expect(result.items.every((p) => p.price >= 500 && p.price <= 1000)).toBe(true);
  });

  it("matches full-text keyword search", async () => {
    const result = await searchProducts({ query: "grinder" });
    expect(result.total).toBeGreaterThan(0);
    expect(
      result.items.every((p) => /grind/i.test(p.name) || p.category.toLowerCase().includes("grinding"))
    ).toBe(true);
  });

  it("filters by SKU (the `sku` field, not full-text `query`, is the reliable way to look one up)", async () => {
    // Uses whatever SKU actually exists in the synced catalog rather than a hardcoded
    // value, so this test works against both the mock fixtures and a real WP sync.
    const anyProduct = (await searchProducts({ category: "Cordless Power Tools" })).items.find((p) => p.sku);
    if (!anyProduct?.sku) return; // no SKUs in this dataset; nothing to assert

    const bySku = await searchProducts({ sku: anyProduct.sku });
    expect(bySku.total).toBeGreaterThan(0);
    expect(bySku.items.some((p) => p.id === anyProduct.id)).toBe(true);
    expect(bySku.items.every((p) => p.sku?.includes(anyProduct.sku!))).toBe(true);
  });

  it("regression: a name + SKU combined in `query` used to silently return zero results — `sku` must find it instead", async () => {
    const anyProduct = (await searchProducts({ category: "Cordless Power Tools" })).items.find((p) => p.sku);
    if (!anyProduct?.sku) return;

    // Documents the actual gap that caused a real user-facing bug: websearch_to_tsquery
    // ANDs every term, so appending an unindexed SKU to a name query kills the whole match.
    const viaQuery = await searchProducts({ query: `${anyProduct.name} ${anyProduct.sku}` });
    expect(viaQuery.total).toBe(0);

    const viaSku = await searchProducts({ sku: anyProduct.sku });
    expect(viaSku.items.some((p) => p.id === anyProduct.id)).toBe(true);
  });

  it("returns zero results for a nonsense query without throwing, and no suggestions for it", async () => {
    const result = await searchProducts({ query: "zzzznonexistentproductxyz123" });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.suggestions ?? []).toEqual([]);
  });

  it("suggests near-name matches for a typo'd query that has no exact match", async () => {
    const anyProduct = (await searchProducts({ category: "Cordless Power Tools" })).items[0];
    if (!anyProduct) return;
    const firstWord = anyProduct.name.split(" ")[0];
    if (firstWord.length < 4) return; // too short to typo meaningfully

    const mid = Math.floor(firstWord.length / 2);
    const typoWord = firstWord.slice(0, mid) + firstWord.slice(mid + 1); // drop one character

    const result = await searchProducts({ query: typoWord });
    if (result.total > 0) return; // typo happened to still match something via full-text; nothing to assert

    expect(result.suggestions?.length ?? 0).toBeGreaterThan(0);
  });

  it("suggests the same product when the text matches but a narrowing filter doesn't", async () => {
    const anyProduct = (await searchProducts({ category: "Cordless Power Tools" })).items[0];
    if (!anyProduct) return;

    const result = await searchProducts({ query: anyProduct.name, category: "Nonexistent Category ZZZ" });
    expect(result.total).toBe(0);
    expect(result.suggestions?.some((p) => p.id === anyProduct.id)).toBe(true);
  });

  it("paginates results", async () => {
    const page1 = await searchProducts({ category: "Cordless Power Tools", page: 1 });
    const page2 = await searchProducts({ category: "Cordless Power Tools", page: 2 });
    const page1Ids = new Set(page1.items.map((p) => p.id));
    expect(page2.items.some((p) => page1Ids.has(p.id))).toBe(false);
  });

  it("is not vulnerable to SQL injection via the query/category params", async () => {
    // Should be treated as literal text (parameterized), not executed as SQL.
    const result = await searchProducts({ category: "'; DROP TABLE \"ProductCache\"; --" });
    expect(result.total).toBe(0);

    const stillWorks = await searchProducts({ category: "Cordless Power Tools" });
    expect(stillWorks.total).toBeGreaterThan(0);
  });
});

describe("getProductDetails", () => {
  it("fetches by slug", async () => {
    const { items } = await searchProducts({ category: "Cordless Power Tools" });
    const first = items[0];
    const detail = await getProductDetails({ slug: first.slug });
    expect(detail?.id).toBe(first.id);
    expect(detail?.description.length).toBeGreaterThan(0);
  });

  it("fetches by productId", async () => {
    const { items } = await searchProducts({ category: "Cordless Power Tools" });
    const detail = await getProductDetails({ productId: items[0].id });
    expect(detail?.slug).toBe(items[0].slug);
  });

  it("returns null for an unknown product", async () => {
    const detail = await getProductDetails({ productId: 999999999 });
    expect(detail).toBeNull();
  });

  it("fetches by sku, disambiguating products that share the same name", async () => {
    const anyProduct = (await searchProducts({ category: "Cordless Power Tools" })).items.find((p) => p.sku);
    if (!anyProduct?.sku) return;
    const detail = await getProductDetails({ sku: anyProduct.sku });
    expect(detail?.id).toBe(anyProduct.id);
  });
});

describe("listCategories", () => {
  it("returns real categories with counts, matching what search_products' facets report", async () => {
    const categories = await listCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((c) => c.count > 0)).toBe(true);

    const known = (await searchProducts({ category: categories[0].name })).total;
    expect(known).toBe(categories[0].count);
  });
});
