import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { SitePageSummary } from "@mpe-chatbot/shared";

interface PageSearchRow {
  url: string;
  title: string;
  excerpt: string | null;
  snippet: string | null;
  content: string;
  score: number;
}

// A relevant fact can sit anywhere in a page — e.g. social links live in a "Follow us"
// footer section, far from any word ts_headline's fragment window would center on — so
// fragment-based snippets aren't reliable on their own. Real page content on this site
// tops out under 10k characters (~2-2.5k tokens) even for the largest landing page, so
// it's cheap to just send the whole thing uncapped for the single best-ranked match,
// where correctness matters most — this cap is a safety net against a pathologically
// huge future page, not an expected truncation point for real content today. Lower-ranked
// results (probably not the actual answer) still get the cheaper fragment-based snippet.
const FULL_CONTENT_CAP = 20_000;

interface RecentPageRow {
  url: string;
  title: string;
  excerpt: string | null;
}

/** "blogs" restricts to blog posts only; "pages" restricts to everything else
 * (static pages, shop/category content) — used by the blogs vs website-info guided
 * modes so each only ever searches its own slice of content. Omit for no restriction. */
export type PageSourceFilter = "blogs" | "pages";

function sourceCondition(sourceFilter?: PageSourceFilter): Prisma.Sql {
  return sourceFilter === "blogs"
    ? Prisma.sql`AND "source" = 'wp_post'`
    : sourceFilter === "pages"
      ? Prisma.sql`AND "source" != 'wp_post'`
      : Prisma.empty;
}

/** No topic to search on (e.g. "show me recent blog posts") — searching for nothing
 * would be a category error, not a real query, so just return what's newest instead. */
async function mostRecent(limit: number, sourceFilter?: PageSourceFilter): Promise<SitePageSummary[]> {
  const rows = await prisma.$queryRaw<RecentPageRow[]>`
    SELECT "url", "title", "excerpt" FROM "SitePage"
    WHERE TRUE ${sourceCondition(sourceFilter)}
    ORDER BY "updatedAt" DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ url: r.url, title: r.title, excerpt: r.excerpt ?? "" }));
}

/** Turns "recent blogs" into a tsquery that ORs the individual words instead of ANDing
 * them (websearch_to_tsquery's default) — a real topic word or two mixed in with generic
 * request words ("show me", "recent", "about") should still find a match on the topic
 * word alone, instead of the whole thing failing because not every word is in the page. */
function looseOrQuery(query: string): string {
  return query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" | ");
}

async function runSearch(
  tsQuery: Prisma.Sql,
  limit: number,
  sourceFilter?: PageSourceFilter
): Promise<PageSearchRow[]> {
  return prisma.$queryRaw<PageSearchRow[]>`
    SELECT "url", "title", "excerpt", "content",
           ts_headline('english', "content", ${tsQuery},
             'StartSel=, StopSel=, MaxFragments=3, MaxWords=60, MinWords=15, FragmentDelimiter= [...] ') AS snippet,
           ts_rank("searchVector", ${tsQuery}) AS score
    FROM "SitePage"
    WHERE "searchVector" @@ ${tsQuery}
    ${sourceCondition(sourceFilter)}
    ORDER BY score DESC
    LIMIT ${limit}
  `;
}

function mapRows(rows: PageSearchRow[]): SitePageSummary[] {
  return rows.map((r, i) => ({
    url: r.url,
    title: r.title,
    excerpt: r.excerpt ?? "",
    // Best match gets the full page body (cheap at this site's page sizes); everyone
    // else gets the cheaper fragment-based snippet, good enough for a lower-confidence hit.
    contentSnippet: i === 0 ? r.content.slice(0, FULL_CONTENT_CAP) : r.snippet || undefined,
    score: r.score,
  }));
}

export async function searchPages(
  query: string | undefined,
  limit = 5,
  sourceFilter?: PageSourceFilter
): Promise<SitePageSummary[]> {
  if (!query?.trim()) {
    return mostRecent(limit, sourceFilter);
  }

  const strictQuery = Prisma.sql`websearch_to_tsquery('english', ${query})`;
  const strictRows = await runSearch(strictQuery, limit, sourceFilter);
  if (strictRows.length > 0) {
    return mapRows(strictRows);
  }

  const loose = looseOrQuery(query);
  if (!loose) {
    return [];
  }
  try {
    const looseQuery = Prisma.sql`to_tsquery('english', ${loose})`;
    const looseRows = await runSearch(looseQuery, limit, sourceFilter);
    return mapRows(looseRows);
  } catch {
    // to_tsquery throws if every word turned out to be a stopword with no lexeme left
    // (e.g. a query like "the a is") — genuinely nothing sensible to search for then.
    return [];
  }
}
