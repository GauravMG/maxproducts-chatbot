import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { SitePageSummary } from "@mpe-chatbot/shared";

interface PageSearchRow {
  url: string;
  title: string;
  excerpt: string | null;
  score: number;
}

/** "blogs" restricts to blog posts only; "pages" restricts to everything else
 * (static pages, shop/category content) — used by the blogs vs website-info guided
 * modes so each only ever searches its own slice of content. Omit for no restriction. */
export type PageSourceFilter = "blogs" | "pages";

export async function searchPages(
  query: string,
  limit = 5,
  sourceFilter?: PageSourceFilter
): Promise<SitePageSummary[]> {
  const sourceCondition =
    sourceFilter === "blogs"
      ? Prisma.sql`AND "source" = 'wp_post'`
      : sourceFilter === "pages"
        ? Prisma.sql`AND "source" != 'wp_post'`
        : Prisma.empty;

  const rows = await prisma.$queryRaw<PageSearchRow[]>`
    SELECT "url", "title", "excerpt",
           ts_rank("searchVector", websearch_to_tsquery('english', ${query})) AS score
    FROM "SitePage"
    WHERE "searchVector" @@ websearch_to_tsquery('english', ${query})
    ${sourceCondition}
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    url: r.url,
    title: r.title,
    excerpt: r.excerpt ?? "",
    score: r.score,
  }));
}
