import { z } from "zod";

// Every tool exposed to the OpenAI model is defined here as a zod input schema.
// The server converts these to JSON Schema for the OpenAI tools array AND uses
// them to validate model-generated arguments before executing anything.

export const searchPagesInput = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "Natural-language search topic about site content/pages. Omit entirely when the user has no specific topic — e.g. \"show me recent blog posts\", \"what's new\" — this returns the most recently updated content instead of searching for nothing."
    ),
  limit: z.number().int().min(1).max(10).optional().describe("Max results, default 5"),
});

export const searchProductsInput = z.object({
  query: z.string().optional().describe("Free-text keyword search, e.g. product name. Do NOT put a SKU/product code here — use `sku` instead, since SKUs aren't part of the text search index and combining them with `query` causes zero matches."),
  category: z.string().optional().describe("Exact or partial category name to filter by"),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  sku: z
    .string()
    .optional()
    .describe("Filter by SKU/product code (partial match). Use this whenever the user provides a SKU, instead of putting it in `query`."),
  brand: z.string().optional().describe("Filter by attributes.brand"),
  attributes: z
    .record(z.string(), z.string())
    .optional()
    .describe("Additional attribute filters, e.g. { voltage: '18V' }"),
  page: z.number().int().min(1).optional(),
});

export const getProductDetailsInput = z
  .object({
    productId: z.number().int().optional(),
    slug: z.string().optional(),
    sku: z.string().optional().describe("Exact SKU/product code, when known — resolves ambiguous same-name products directly"),
  })
  .refine((v) => v.productId !== undefined || v.slug !== undefined || v.sku !== undefined, {
    message: "productId, slug, or sku is required",
  });

export const emptyInput = z.object({});

export const updateAccountDetailsInput = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(3).optional(),
});

const addressInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postcode: z.string().min(1),
  country: z.string().min(2),
  phone: z.string().optional(),
});

export const updateAddressInput = z.object({
  type: z.enum(["billing", "shipping"]),
  address: addressInput,
});

export const listOrdersInput = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(20).optional(),
});

export const orderIdInput = z.object({
  orderId: z.number().int(),
});

export const productIdInput = z.object({
  productId: z.number().int(),
});

export type SearchPagesInput = z.infer<typeof searchPagesInput>;
export type SearchProductsInput = z.infer<typeof searchProductsInput>;
export type GetProductDetailsInput = z.infer<typeof getProductDetailsInput>;
export type UpdateAccountDetailsInput = z.infer<typeof updateAccountDetailsInput>;
export type UpdateAddressInput = z.infer<typeof updateAddressInput>;
export type ListOrdersInput = z.infer<typeof listOrdersInput>;
export type OrderIdInput = z.infer<typeof orderIdInput>;
export type ProductIdInput = z.infer<typeof productIdInput>;
