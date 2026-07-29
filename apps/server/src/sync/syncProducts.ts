import { prisma } from "../db/prisma.js";
import { getWpAdapter } from "../adapters/wp/index.js";

export async function syncProducts(): Promise<{ count: number }> {
  const adapter = getWpAdapter();
  const products = await adapter.listProducts();

  // ProductCache is a full mirror of the adapter's current catalog, not an accumulating
  // log — remove anything that's no longer in the source (e.g. deleted/unpublished
  // products, or stale rows left over from switching WP_MODE between mock and live).
  const currentIds = products.map((p) => p.id);
  await prisma.productCache.deleteMany({ where: { wooProductId: { notIn: currentIds } } });

  for (const p of products) {
    await prisma.productCache.upsert({
      where: { wooProductId: p.id },
      create: {
        wooProductId: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        description: p.description,
        shortDescription: p.shortDescription,
        price: p.price,
        regularPrice: p.regularPrice,
        salePrice: p.salePrice,
        currency: p.currency,
        category: p.category,
        categories: p.categories,
        attributes: p.attributes,
        stockStatus: p.stockStatus,
        permalink: p.permalink,
        imageUrl: p.imageUrl,
      },
      update: {
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        description: p.description,
        shortDescription: p.shortDescription,
        price: p.price,
        regularPrice: p.regularPrice,
        salePrice: p.salePrice,
        currency: p.currency,
        category: p.category,
        categories: p.categories,
        attributes: p.attributes,
        stockStatus: p.stockStatus,
        permalink: p.permalink,
        imageUrl: p.imageUrl,
        syncedAt: new Date(),
      },
    });
  }

  return { count: products.length };
}
