import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type {
  ProductDetail,
  ProductFacets,
  ProductSummary,
  SearchProductsInput,
} from "@mpe-chatbot/shared";

const PAGE_SIZE = 8;

interface ProductRow {
  wooProductId: number;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  shortDescription: string | null;
  price: Prisma.Decimal;
  regularPrice: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  currency: string;
  category: string;
  categories: unknown;
  attributes: unknown;
  stockStatus: string;
  permalink: string;
  imageUrl: string | null;
}

const PRODUCT_COLUMNS = Prisma.sql`
  "wooProductId", "name", "slug", "sku", "description", "shortDescription",
  "price", "regularPrice", "salePrice", "currency", "category", "categories",
  "attributes", "stockStatus", "permalink", "imageUrl"
`;

function mapRow(row: ProductRow): ProductSummary {
  return {
    id: row.wooProductId,
    slug: row.slug,
    name: row.name,
    sku: row.sku ?? undefined,
    price: Number(row.price),
    regularPrice: row.regularPrice ? Number(row.regularPrice) : undefined,
    salePrice: row.salePrice ? Number(row.salePrice) : undefined,
    currency: row.currency,
    category: row.category,
    categories: (row.categories as string[]) ?? [],
    attributes: (row.attributes as Record<string, string>) ?? {},
    stockStatus: row.stockStatus as ProductSummary["stockStatus"],
    permalink: row.permalink,
    imageUrl: row.imageUrl ?? undefined,
  };
}

function buildConditions(
  filters: SearchProductsInput,
  opts: { excludeCategory?: boolean; excludeBrand?: boolean } = {}
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (filters.query) {
    conditions.push(
      Prisma.sql`"searchVector" @@ websearch_to_tsquery('english', ${filters.query})`
    );
  }
  if (filters.category && !opts.excludeCategory) {
    conditions.push(Prisma.sql`"category" ILIKE ${`%${filters.category}%`}`);
  }
  if (filters.minPrice !== undefined) {
    conditions.push(Prisma.sql`"price" >= ${filters.minPrice}`);
  }
  if (filters.maxPrice !== undefined) {
    conditions.push(Prisma.sql`"price" <= ${filters.maxPrice}`);
  }
  if (filters.sku) {
    // SKU is not part of the tsvector (it's an identifier, not searchable prose) —
    // matched separately so a SKU-only (or SKU + other filters) query still works.
    conditions.push(Prisma.sql`"sku" ILIKE ${`%${filters.sku}%`}`);
  }
  if (filters.brand && !opts.excludeBrand) {
    conditions.push(Prisma.sql`"attributes" @> ${JSON.stringify({ brand: filters.brand })}::jsonb`);
  }
  if (filters.attributes) {
    for (const [key, value] of Object.entries(filters.attributes)) {
      conditions.push(Prisma.sql`"attributes" @> ${JSON.stringify({ [key]: value })}::jsonb`);
    }
  }

  return conditions;
}

function whereClause(conditions: Prisma.Sql[]): Prisma.Sql {
  return conditions.length === 0 ? Prisma.sql`TRUE` : Prisma.join(conditions, " AND ");
}

async function computeFacets(filters: SearchProductsInput): Promise<ProductFacets> {
  const categoryWhere = whereClause(buildConditions(filters, { excludeCategory: true }));
  const categoryRows = await prisma.$queryRaw<{ category: string; count: bigint }[]>`
    SELECT "category", count(*)::bigint AS count FROM "ProductCache"
    WHERE ${categoryWhere}
    GROUP BY "category" ORDER BY count DESC LIMIT 6
  `;

  const brandWhere = whereClause(buildConditions(filters, { excludeBrand: true }));
  const brandRows = await prisma.$queryRaw<{ brand: string | null; count: bigint }[]>`
    SELECT "attributes"->>'brand' AS brand, count(*)::bigint AS count FROM "ProductCache"
    WHERE ${brandWhere}
    GROUP BY "attributes"->>'brand' ORDER BY count DESC LIMIT 6
  `;

  const allWhere = whereClause(buildConditions(filters));
  const priceRows = await prisma.$queryRaw<{ min: number | null; max: number | null }[]>`
    SELECT min("price")::float AS min, max("price")::float AS max FROM "ProductCache" WHERE ${allWhere}
  `;

  return {
    categories: categoryRows.map((r) => ({ name: r.category, count: Number(r.count) })),
    brands: brandRows
      .filter((r): r is { brand: string; count: bigint } => Boolean(r.brand))
      .map((r) => ({ name: r.brand, count: Number(r.count) })),
    priceRange:
      priceRows[0]?.min !== null && priceRows[0]?.min !== undefined
        ? { min: priceRows[0].min, max: priceRows[0].max as number }
        : null,
  };
}

export async function searchProducts(
  filters: SearchProductsInput
): Promise<{ total: number; items: ProductSummary[]; facets: ProductFacets }> {
  const page = filters.page ?? 1;
  const where = whereClause(buildConditions(filters));

  const countRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count FROM "ProductCache" WHERE ${where}
  `;
  const total = Number(countRows[0]?.count ?? 0);

  const itemRows = await prisma.$queryRaw<ProductRow[]>`
    SELECT ${PRODUCT_COLUMNS} FROM "ProductCache"
    WHERE ${where}
    ORDER BY "updatedAt" DESC
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `;

  const facets = await computeFacets(filters);

  return { total, items: itemRows.map(mapRow), facets };
}

export async function getProductDetails(input: {
  productId?: number;
  slug?: string;
  sku?: string;
}): Promise<ProductDetail | null> {
  const rows = input.productId
    ? await prisma.$queryRaw<ProductRow[]>`
        SELECT ${PRODUCT_COLUMNS} FROM "ProductCache" WHERE "wooProductId" = ${input.productId} LIMIT 1
      `
    : input.slug
      ? await prisma.$queryRaw<ProductRow[]>`
          SELECT ${PRODUCT_COLUMNS} FROM "ProductCache" WHERE "slug" = ${input.slug} LIMIT 1
        `
      : await prisma.$queryRaw<ProductRow[]>`
          SELECT ${PRODUCT_COLUMNS} FROM "ProductCache" WHERE "sku" = ${input.sku} LIMIT 1
        `;

  const row = rows[0];
  if (!row) return null;

  return {
    ...mapRow(row),
    description: row.description ?? "",
    shortDescription: row.shortDescription ?? "",
  };
}
