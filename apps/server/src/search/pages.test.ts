import { describe, expect, it } from "vitest";
import { searchPages } from "./pages.js";
import { prisma } from "../db/prisma.js";

describe("searchPages", () => {
  it("finds relevant pages for a topical query", async () => {
    const results = await searchPages("returns policy");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => /return/i.test(r.title) || /return/i.test(r.excerpt))).toBe(true);
  });

  it("ranks the most relevant result first", async () => {
    // Dataset-agnostic: whatever the top page for "returns policy" turns out to be,
    // searching its own exact title should rank that same page first.
    const seed = await searchPages("returns policy", 1);
    expect(seed.length).toBeGreaterThan(0);
    const results = await searchPages(seed[0].title);
    expect(results[0].url).toBe(seed[0].url);
  });

  it("respects the limit parameter", async () => {
    const results = await searchPages("cordless", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("returns an empty array for a query matching nothing", async () => {
    const results = await searchPages("zzzznonexistenttopicxyz123");
    expect(results).toEqual([]);
  });

  it("is not vulnerable to SQL injection via the query param", async () => {
    const results = await searchPages("'; DROP TABLE \"SitePage\"; --");
    expect(Array.isArray(results)).toBe(true);

    const stillWorks = await searchPages("returns policy");
    expect(stillWorks.length).toBeGreaterThan(0);
  });

  it("finds a page via loose OR fallback when the phrasing mixes generic words with a real topic", async () => {
    // Strict AND-matching every word (including "tell me about your") fails since those
    // words don't appear in the actual page content — the loose OR fallback should still
    // find the return-policy page from the real topic words alone.
    const results = await searchPages("tell me about your return policy");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => /return/i.test(r.title))).toBe(true);
  });

  it("returns a contentSnippet pulled from the page body, not just the short excerpt", async () => {
    const results = await searchPages("returns policy", 1);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].contentSnippet).toBeTruthy();
  });

  it("omitting query returns the most recently updated content instead of searching for nothing", async () => {
    const count = await prisma.sitePage.count();
    if (count === 0) return;

    const results = await searchPages(undefined, 5);
    expect(results.length).toBeGreaterThan(0);
    // Every result should carry no relevance score (nothing was actually searched for).
    expect(results.every((r) => r.score === undefined)).toBe(true);

    const dates = await Promise.all(
      results.map(async (r) => (await prisma.sitePage.findUnique({ where: { url: r.url } }))!.updatedAt.getTime())
    );
    expect([...dates]).toEqual([...dates].sort((a, b) => b - a));
  });

  it("omitting query still respects sourceFilter", async () => {
    const results = await searchPages(undefined, 20, "blogs");
    for (const r of results) {
      const row = await prisma.sitePage.findUnique({ where: { url: r.url } });
      expect(row?.source).toBe("wp_post");
    }
  });

  it("sourceFilter restricts results to their own slice of content (blogs vs website info)", async () => {
    // Broad, generic query so we get whatever's available across both slices, then
    // confirm each filtered call only ever returns its own source.
    const unfiltered = await prisma.sitePage.count();
    if (unfiltered === 0) return;

    const blogResults = await searchPages("power", 50, "blogs");
    const pageResults = await searchPages("power", 50, "pages");

    for (const r of blogResults) {
      const row = await prisma.sitePage.findUnique({ where: { url: r.url } });
      expect(row?.source).toBe("wp_post");
    }
    for (const r of pageResults) {
      const row = await prisma.sitePage.findUnique({ where: { url: r.url } });
      expect(row?.source).not.toBe("wp_post");
    }
  });
});
