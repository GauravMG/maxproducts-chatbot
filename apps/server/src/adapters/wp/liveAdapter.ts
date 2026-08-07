import axios, { type AxiosInstance } from "axios";
import type { AccountDetails, Address, OrderDetail, OrderSummary } from "@mpe-chatbot/shared";
import { env } from "../../config/env.js";
import type {
  InvoiceData,
  ProductRecord,
  SitePageRecord,
  WpAdapter,
  WpIdentityContext,
} from "./types.js";
import { WpAdapterError } from "./types.js";

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
  middot: "·",
};

// WP/WooCommerce REST responses commonly leave titles/category names HTML-entity-encoded
// (e.g. "Grinding &amp; Sanding") even in fields that aren't literal markup — decode the
// common named entities plus numeric ones so they render as plain, correct text.
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const codePoint =
        code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return HTML_ENTITIES[code.toLowerCase()] ?? match;
  });
}

// A blanket tag-strip (see stripAndDecode below) throws away every attribute, including
// `href` — so a page's actual link targets (e.g. social media icons in a "Follow us"
// section, which often have no visible text at all) were previously lost entirely, even
// though the destination URL is exactly what a question like "social media links" needs.
// Rewriting anchors to "text (href)" (or just the bare href when there's no visible text)
// before the generic strip keeps that URL in the plain text the search index sees.
export function preserveLinkHrefs(html: string): string {
  return html.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    return text ? `${text} (${href})` : href;
  });
}

interface WcProduct {
  id: number;
  slug: string;
  name: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  description: string;
  short_description: string;
  categories: { id: number; name: string }[];
  attributes: { name: string; options: string[] }[];
  // Populated by WooCommerce brand plugins (e.g. Perfect Brands for WooCommerce,
  // core WC brand taxonomy) as a separate taxonomy field, not under `attributes`.
  brands?: { id: number; name: string }[];
  stock_status: string;
  permalink: string;
  images: { src: string }[];
}

function mapWcProduct(p: WcProduct): ProductRecord {
  const attributes: Record<string, string> = {};
  for (const attr of p.attributes ?? []) {
    attributes[attr.name.toLowerCase()] = decodeHtmlEntities(attr.options?.[0] ?? "");
  }
  // Prefer the dedicated brand taxonomy field when a brand plugin populates it; fall
  // back to a regular "Brand" attribute for stores that model it that way instead.
  if (p.brands?.[0]?.name) {
    attributes.brand = decodeHtmlEntities(p.brands[0].name);
  }
  const category = decodeHtmlEntities(p.categories?.[0]?.name ?? "Uncategorized");
  return {
    id: p.id,
    slug: p.slug,
    name: decodeHtmlEntities(p.name),
    sku: p.sku,
    price: Number(p.price || 0),
    regularPrice: p.regular_price ? Number(p.regular_price) : undefined,
    salePrice: p.sale_price ? Number(p.sale_price) : undefined,
    currency: "EUR",
    category,
    categories: (p.categories ?? []).map((c) => decodeHtmlEntities(c.name)),
    attributes,
    stockStatus: (p.stock_status as ProductRecord["stockStatus"]) ?? "instock",
    permalink: p.permalink,
    imageUrl: p.images?.[0]?.src,
    description: p.description ?? "",
    shortDescription: p.short_description ?? "",
  };
}

/**
 * Calls the real WooCommerce REST API (public/store-wide catalog reads, using
 * WC_CONSUMER_KEY/SECRET) and the mpe-chatbot companion WP plugin (account-scoped
 * reads/writes, authenticated per-request via the visitor's HMAC token — see
 * wp-plugin/mpe-chatbot). Active when WP_MODE=live.
 */
export class LiveWpAdapter implements WpAdapter {
  private readonly wp: AxiosInstance;
  private readonly wc: AxiosInstance;
  private readonly plugin: AxiosInstance;

  constructor() {
    // Catalog sync (listPages/listProducts) runs as a background CLI job, not inline
    // during a chat response, so a generous timeout is fine — shared WooCommerce
    // hosting can take several seconds to render a full page of product data.
    // Plain WP REST API (public content: pages/posts) — no auth needed for published content.
    this.wp = axios.create({ baseURL: `${env.WP_SITE_URL}/wp-json/wp/v2`, timeout: 30_000 });
    this.wc = axios.create({
      baseURL: `${env.WP_SITE_URL}/wp-json/wc/v3`,
      auth: { username: env.WC_CONSUMER_KEY, password: env.WC_CONSUMER_SECRET },
      timeout: 30_000,
    });
    this.plugin = axios.create({
      baseURL: `${env.WP_SITE_URL}/wp-json/${env.WP_REST_NAMESPACE}`,
      timeout: 10_000,
    });
  }

  private pluginAuthHeaders(identity: WpIdentityContext) {
    return { Authorization: `Bearer ${identity.token}` };
  }

  private async pluginRequest<T>(
    method: "get" | "put",
    path: string,
    identity: WpIdentityContext,
    data?: unknown
  ): Promise<T> {
    try {
      const res = await this.plugin.request<T>({
        method,
        url: path,
        data,
        headers: this.pluginAuthHeaders(identity),
      });
      return res.data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 403) {
          throw new WpAdapterError("Not authorized for this resource", "forbidden");
        }
        if (err.response?.status === 404) {
          throw new WpAdapterError("Resource not found", "not_found");
        }
      }
      throw new WpAdapterError(`WP plugin request failed: ${(err as Error).message}`);
    }
  }

  async listPages(): Promise<SitePageRecord[]> {
    // Public WP REST API — pages + posts. Requires no auth (read-only, published content).
    const [pages, posts] = await Promise.all([
      this.wp.get("/pages", { params: { per_page: 100, status: "publish" } }),
      this.wp.get("/posts", { params: { per_page: 100, status: "publish" } }),
    ]);
    // <script>/<style> tags need their inner content dropped too, not just the tags
    // themselves — some pages embed a JS widget (e.g. a custom "recent posts" fetcher),
    // and the generic tag-strip below only removes markup, leaving raw JS/CSS source
    // sitting in what's supposed to be plain page text: it pollutes the search index and
    // can outrank the actual content when ranking a query.
    const stripScriptsAndStyles = (html: string): string => html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
    const stripAndDecode = (html: string | undefined): string =>
      decodeHtmlEntities(preserveLinkHrefs(stripScriptsAndStyles(html ?? "")).replace(/<[^>]+>/g, "")).trim();
    const mapEntry = (entry: any, source: SitePageRecord["source"]): SitePageRecord => ({
      url: entry.link,
      title: stripAndDecode(entry.title?.rendered),
      excerpt: stripAndDecode(entry.excerpt?.rendered),
      content: stripAndDecode(entry.content?.rendered),
      source,
    });
    return [
      ...(pages.data as any[]).map((e) => mapEntry(e, "wp_page")),
      ...(posts.data as any[]).map((e) => mapEntry(e, "wp_post")),
    ];
  }

  async listProducts(): Promise<ProductRecord[]> {
    const products: ProductRecord[] = [];
    let page = 1;
    // WooCommerce REST API caps per_page at 100; paginate through the full catalog.
    for (;;) {
      const res = await this.wc.get<WcProduct[]>("/products", { params: { per_page: 100, page } });
      if (res.data.length === 0) break;
      products.push(...res.data.map(mapWcProduct));
      if (res.data.length < 100) break;
      page += 1;
    }
    return products;
  }

  async getAccountDetails(identity: WpIdentityContext): Promise<AccountDetails> {
    return this.pluginRequest<AccountDetails>("get", "/account", identity);
  }

  async updateAccountDetails(
    identity: WpIdentityContext,
    data: Partial<AccountDetails>
  ): Promise<AccountDetails> {
    return this.pluginRequest<AccountDetails>("put", "/account", identity, data);
  }

  async getAddresses(identity: WpIdentityContext): Promise<{ billing: Address; shipping: Address }> {
    return this.pluginRequest<{ billing: Address; shipping: Address }>("get", "/addresses", identity);
  }

  async updateAddress(
    identity: WpIdentityContext,
    type: "billing" | "shipping",
    address: Address
  ): Promise<Address> {
    return this.pluginRequest<Address>("put", `/addresses/${type}`, identity, address);
  }

  async listOrders(
    identity: WpIdentityContext,
    page: number,
    pageSize: number
  ): Promise<{ total: number; orders: OrderSummary[] }> {
    return this.pluginRequest<{ total: number; orders: OrderSummary[] }>(
      "get",
      `/orders?page=${page}&per_page=${pageSize}`,
      identity
    );
  }

  async getOrderDetails(identity: WpIdentityContext, orderId: number): Promise<OrderDetail> {
    return this.pluginRequest<OrderDetail>("get", `/orders/${orderId}`, identity);
  }

  async getInvoiceData(identity: WpIdentityContext, orderId: number): Promise<InvoiceData> {
    return this.pluginRequest<InvoiceData>("get", `/orders/${orderId}/invoice-data`, identity);
  }

  async getInvoiceUrl(identity: WpIdentityContext, orderId: number): Promise<string> {
    const res = await this.pluginRequest<{ url: string }>(
      "get",
      `/orders/${orderId}/invoice-url`,
      identity
    );
    return res.url;
  }
}
