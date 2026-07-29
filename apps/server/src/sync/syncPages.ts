import { prisma } from "../db/prisma.js";
import { getWpAdapter } from "../adapters/wp/index.js";

export async function syncPages(): Promise<{ count: number }> {
  const adapter = getWpAdapter();
  const pages = await adapter.listPages();

  // SitePage is a full mirror of the adapter's current content, not an accumulating
  // log — remove anything no longer in the source (deleted/unpublished pages, or stale
  // rows left over from switching WP_MODE between mock and live).
  const currentUrls = pages.map((p) => p.url);
  await prisma.sitePage.deleteMany({ where: { url: { notIn: currentUrls } } });

  for (const page of pages) {
    await prisma.sitePage.upsert({
      where: { url: page.url },
      create: {
        url: page.url,
        title: page.title,
        excerpt: page.excerpt,
        content: page.content,
        source: page.source,
      },
      update: {
        title: page.title,
        excerpt: page.excerpt,
        content: page.content,
        source: page.source,
        syncedAt: new Date(),
      },
    });
  }

  return { count: pages.length };
}
